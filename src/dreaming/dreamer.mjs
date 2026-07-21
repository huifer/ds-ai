// ~/pi-discord-agents/src/dreaming/dreamer.mjs
// 「遐思」主入口 — 三阶段编排（Light/REM/Deep，phases/*.mjs 已实现真实算法）。
//
// 编排链路:基础结构 + budget + 锁 + run record + Discord 通知。
// phases/light|rem|deep.mjs 已实现真实算法（信号收集 / Pi 反思 / 5信号评分 + 影子试用）。
//
// 三阶段:
//   Light  → 收集信号(journal/记忆采样/投票回流)
//   REM    → 让 Pi 在候选上做主题反思(发 prompt,等产物 JSON)
//   Deep   → 5 信号评分 + 影子试用 + 写入 artifacts + 写入遐思录
//
// 约束:
//   - 单次梦 wall-clock ≤ 15 min(perDreamTimeoutMs)
//   - 单次梦 LLM call ≤ 8(perDreamLLMCalls)
//   - 每日总 token ≤ cfg.dreaming.dailyTokenBudget
//   - 任何阶段失败 → catch → 写 run.status=failed → 推 Discord 🌧️ → 不影响下次

import { writeFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PATHS, TYPES, ALL_TYPES } from './paths.mjs';
import { acquireLock } from './locks.mjs';
import { loadPrompt } from './prompts.mjs';

// 增强模块（懒加载）
let _nightmareMitigator = null;
let _dreamToMemory = null;
let _voteFeedback = null;
let _selfImprover = null;

async function getNightmareMitigator() {
  if (!_nightmareMitigator) {
    const mod = await import('./enhancement/nightmare-mitigation.mjs');
    _nightmareMitigator = mod.createNightmareMitigator({ log });
  }
  return _nightmareMitigator;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function todayKey(tzOffsetHours = 8) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const tzMs = utcMs + tzOffsetHours * 3600_000;
  const d = new Date(tzMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function newDreamId(type, tzOffsetHours = 8) {
  const t = todayKey(tzOffsetHours);
  const rand = Math.random().toString(36).slice(2, 8);
  return `xiasi-${t}-${type}-${rand}`;
}

export async function createDreamer({
  cfg,
  dreamingPi,
  discord = null,
  memoryStore = null,
  journal = null,
  embedder = null,
  artifacts = null,
  budget = null,
  diary = null,
  log = () => {},
  // 增强参数
  goodDreamMode = false,  // 启用好梦模式
  enableNightmareMitigation = true,  // 启用噩梦干预
  nightmareThreshold = -0.2,  // 噩梦极性阈值
} = {}) {
  const xc = cfg.dreaming;

  // 阶段模块
  const lightMod = await import('./phases/light.mjs');
  const remMod   = await import('./phases/rem.mjs');
  const deepMod  = await import('./phases/deep.mjs');
  const yuYanMod = await import('./phases/yu-yan.mjs');  // 预言模块

  const PER_DREAM_TIMEOUT_MS = 15 * 60 * 1000;
  const PER_DREAM_LLM_CALLS   = 8;

  async function ensureRunDir(dateKey) {
    const dir = join(PATHS.runsDir, dateKey);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async function writeRunRecord(record) {
    const dir = await ensureRunDir(record.dateKey);
    const file = join(dir, `${record.id}.json`);
    await writeFile(file, JSON.stringify(record, null, 2), 'utf8');
    return file;
  }

  async function pushDiscord(content, opts = {}) {
    if (!discord || !xc.channelId) {
      log(`[dreamer] (no-push) ${content.slice(0, 80).replace(/\n/g, ' ')}`);
      return;
    }
    try {
      const msg = await discord.send(xc.channelId, content);
      log(`[dreamer] ✓ pushed to #📜-夜游记: ${content.slice(0, 60).replace(/\n/g, ' ')}…`);
      return msg;
    } catch (e) {
      log('[dreamer] Discord 推送失败(非致命):', e.message);
    }
  }

  async function pushDiscordWithButtons(content, artifactIds = []) {
    if (!discord || !xc.channelId) return;
    if (typeof discord.sendWithButtons !== 'function') {
      return await pushDiscord(content);
    }
    const buttons = [];
    if (artifactIds[0]) buttons.push({ customId: `xiasi:vote:up:${artifactIds[0]}`, label: '👍 有意思', style: 'success' });
    if (artifactIds[0]) buttons.push({ customId: `xiasi:vote:down:${artifactIds[0]}`, label: '👎 不准', style: 'danger' });
    if (artifactIds[0]) buttons.push({ customId: `xiasi:vote:star:${artifactIds[0]}`, label: '⭐ 收藏', style: 'primary' });
    if (artifactIds.length) {
      buttons.push({ customId: `xiasi:archive:${artifactIds[0]}`, label: '🗂 归档', style: 'secondary' });
    }
    try {
      const msg = await discord.sendWithButtons(xc.channelId, content, buttons);
      log(`[dreamer] ✓ pushed (with ${buttons.length} buttons) to #📜-夜游记`);
      return msg;
    } catch (e) {
      log('[dreamer] 带按钮推送失败(降级为纯文本):', e.message);
      return await pushDiscord(content);
    }
  }

  function pushStartNotice(type) {
    if (xc.silent) return Promise.resolve();
    const t = TYPES[type];
    if (!t) return Promise.resolve();
    return pushDiscord(`${t.emoji} **遐思·${t.cn}** · 开始 · ${todayKey(xc.tzOffsetHours || 8)}`);
  }

  function pushDoneNotice(type, summary) {
    const t = TYPES[type] || { cn: type, emoji: '✨' };
    const lines = [
      `✨ **遐思·${t.cn}** · 完成 · ${summary.durationMs ? Math.round(summary.durationMs / 1000) + 's' : '?'}`,
    ];
    if (summary.artifactCount != null) lines.push(`产物:${summary.artifactCount} 条`);
    if (summary.tokensTotal != null) lines.push(`token:${summary.tokensTotal}`);
    if (summary.topTitle) lines.push(`top:「${summary.topTitle}」`);
    if (summary.topScores) {
      const s = summary.topScores;
      lines.push(`评分:新颖 ${s.novelty} · 连贯 ${s.coherence} · 实用 ${s.utility} · 扎根 ${s.grounding} · ✨惊喜 ${s.surprise} · 总分 ${s.total}`);
    }
    const content = lines.join('\n');
    // PR4:带按钮
    if (summary.artifactIds?.length && discord?.sendWithButtons) {
      return pushDiscordWithButtons(content, summary.artifactIds);
    }
    return pushDiscord(content);
  }

  function pushFailNotice(type, reason) {
    const t = TYPES[type] || { cn: type, emoji: '⚠️' };
    return pushDiscord(`🌧️ **遐思·${t.cn}** · 今夜未能入梦\n\`\`\`\n${String(reason).slice(0, 400)}\n\`\`\``);
  }

  function pushBudgetNotice() {
    return pushDiscord(`🌕 **梦境已满** — 今日 token 预算用完,余梦待明日`);
  }

  // ---- 核心:跑一次梦 ----

  /**
   * @param {object} opts
   * @param {'lian-zhu'|'gui-cang'|'ming-tai'|'yu-yan'} opts.type
   * @param {'scheduled'|'manual'|'command'} [opts.triggeredBy='manual']
   * @param {string} [opts.theme]   // ming-tai 用
   */
  async function run({ type, triggeredBy = 'manual', theme = null } = {}) {
    if (!xc.enabled) {
      log(`[dreamer] 跳过 ${type} — dreaming.enabled=false`);
      return { ok: false, reason: 'disabled' };
    }
    if (!TYPES[type]) {
      return { ok: false, reason: `unknown type: ${type}` };
    }
    if (xc.types && !xc.types.includes(type)) {
      return { ok: false, reason: `type not allowed: ${type}` };
    }

    // 预算检查
    if (budget?.isOver()) {
      log(`[dreamer] 跳过 ${type} — 今日 token 预算用完`);
      await pushBudgetNotice();
      return { ok: false, reason: 'budget-over' };
    }

    const dateKey = todayKey(xc.tzOffsetHours || 8);
    const id = newDreamId(type, xc.tzOffsetHours || 8);

    const record = {
      id,
      type,
      theme,
      triggeredBy,
      dateKey,
      startedAt: new Date().toISOString(),
      durationMs: null,
      endedAt: null,
      status: 'running',
      phases: {},
      artifacts: [],
      tokens: { in: 0, out: 0, total: 0 },
      errors: [],
      budgetSnapshot: budget?.snapshot ? await budget.snapshot() : null,
    };

    // 锁(同 id 防重入,实际不会撞,但防御性)
    const release = await acquireLock(id, { ttlMs: PER_DREAM_TIMEOUT_MS + 60_000 });
    if (!release) {
      log(`[dreamer] 跳过 ${id} — 锁已被持有`);
      return { ok: false, reason: 'locked' };
    }

    await writeRunRecord(record);
    await pushStartNotice(type);
    log(`[dreamer] ▶ ${id} (${triggeredBy})`);

    const startWall = Date.now();
    let topTitle = null;
    let artifactCount = 0;
    let remArtifacts = [];  // PR4: 提到外层,供 diary 和 return 使用

    try {
      // ---- Light ----
      let lightCtx;
      try {
        lightCtx = await lightMod.collect({ type, journal, memoryStore, log });
        record.phases.light = {
          status: 'ok',
          signals: lightCtx.signals?.length || 0,
          candidates: lightCtx.candidates?.length || 0,
          mood: lightCtx.mood?.mood || null,
        };
        log(`[dreamer] light ok · signals=${record.phases.light.signals} candidates=${record.phases.light.candidates} mood=${record.phases.light.mood}`);
      } catch (e) {
        record.phases.light = { status: 'failed', error: e.message };
        log(`[dreamer] light failed: ${e.message}`);
        throw e;
      }

      // ---- REM(主菜) or yu-yan ----
      let yuYanMode = false;
      try {
        // yu-yan 类型使用独立的预言模块
        if (type === 'yu-yan') {
          log(`[dreamer] 使用 yu-yan 预言模式`);
          remArtifacts = await yuYanMod.run({
            type,
            theme,
            lightCtx,
            dreamingPi,
            loadPrompt,
            budget,
            xc,
            log,
            id,
          });
          yuYanMode = true;
        } else {
          // 普通类型使用 REM 模块，可选好梦模式
          remArtifacts = await remMod.run({
            type,
            theme,
            lightCtx,
            dreamingPi,
            loadPrompt,
            budget,
            perDreamLLMCalls: PER_DREAM_LLM_CALLS,
            xc,
            log,
            id,
            goodDreamMode,
          });

          // ---- 噩梦干预（可选）----
          if (enableNightmareMitigation && remArtifacts.length > 0) {
            const mitigator = await getNightmareMitigator();
            const check = mitigator.process(remArtifacts);

            if (check.needsIntervention) {
              log(`[dreamer] 检测到 ${check.interventionCount} 条需要干预的洞察`);
              record.phases.nightmareCheck = {
                status: 'ok',
                detected: check.interventionCount,
                mitigated: check.interventionCount,
              };

              // 用正向洞察替换负向的
              if (check.passed.length > 0) {
                remArtifacts = check.passed;
                log(`[dreamer] 保留 ${remArtifacts.length} 条正向洞察`);
              }
            }

            // 标注所有洞察的极性
            remArtifacts = mitigator.annotate(remArtifacts);
          }
        }

        record.phases.rem = {
          status: 'ok',
          candidatesIn: remArtifacts.length,
          llmCalls: remArtifacts.reduce((s, a) => s + (a._llmCalls || 0), 0),
          goodDreamMode,
          yuYanMode,
        };
        log(`[dreamer] rem ok · ${remArtifacts.length} candidates`);
      } catch (e) {
        record.phases.rem = { status: 'failed', error: e.message };
        log(`[dreamer] rem failed: ${e.message}`);
        throw e;
      }

      // ---- Deep(评分 + 写产物)----
      try {
        const deepOut = await deepMod.run({
          type,
          remArtifacts,
          dreamingPi,
          loadPrompt,
          budget,
          artifacts,
          memoryStore,        // 只读,验证 cite
          embedder,           // 算 Novelty
          xc,
          log,
          id,
        });
        record.phases.deep = {
          status: 'ok',
          scored: deepOut.scored?.length || 0,
          kept:   deepOut.kept?.length || 0,
        };
        record.artifacts = deepOut.kept?.map(a => a.id) || [];
        artifactCount = record.artifacts.length;
        topTitle = deepOut.kept?.[0]?.title || null;
        log(`[dreamer] deep ok · scored=${record.phases.deep.scored} kept=${record.phases.deep.kept}`);
      } catch (e) {
        record.phases.deep = { status: 'failed', error: e.message };
        log(`[dreamer] deep failed: ${e.message}`);
        throw e;
      }

      record.status = 'completed';
    } catch (e) {
      record.status = 'failed';
      record.errors.push(e.message);
      await pushFailNotice(type, e.message);
    } finally {
      record.durationMs = Date.now() - startWall;
      record.endedAt = new Date().toISOString();

      // 累计 token(让 budget 记账)
      const tokensIn  = record.phases.rem?.tokensIn  || 0;
      const tokensOut = record.phases.rem?.tokensOut || 0;
      record.tokens = { in: tokensIn, out: tokensOut, total: tokensIn + tokensOut };
      if (budget && tokensIn + tokensOut > 0) {
        try {
          await budget.record({ tokensIn, tokensOut });
          record.budgetAfter = await budget.snapshot();
        } catch {}
      }

      await writeRunRecord(record);
      log(`[dreamer] ■ ${id} status=${record.status} duration=${record.durationMs}ms`);

      // 通知
      if (record.status === 'completed') {
        const topScores = (() => {
          // 从 kept 拿 top artifact 的 scores
          // kept 在 deep 阶段完成后被记入 record.deep.keptIds (artifact IDs)
          // 但没存分数;需要从 deep 内部拿到,这里简化:跳过
          return null;
        })();
        await pushDoneNotice(type, {
          durationMs: record.durationMs,
          artifactCount,
          tokensTotal: record.tokens.total,
          topTitle,
          topScores,
          artifactIds: record.artifacts,
        });

        // PR4.1:推送每条产物的完整内容到 #📜-夜游记
        if (record.artifacts?.length && artifacts) {
          try {
            // 先等 500ms 避免限流
            await new Promise(r => setTimeout(r, 500));
            for (let i = 0; i < record.artifacts.length; i++) {
              const aid = record.artifacts[i];
              try {
                const artifact = await artifacts.get(aid);
                if (!artifact) continue;
                const title = artifact.meta.title || '(无标题)';
                const score = (artifact.meta.scores?.total || 0).toFixed(2);
                const shadow = artifact.meta.shadowVerdict ? ` [${artifact.meta.shadowVerdict}]` : '';
                const content = artifact.body;
                const lines = [
                  `━━━━ 产物 ${i + 1}/${record.artifacts.length} · ${title} ${shadow} · 评分 ${score}`,
                  `ID: \`${aid}\``,
                  ``,
                  content,
                ];
                // 拆分推送(避免超限)
                const chunk = lines.join('\n');
                if (chunk.length <= 2000) {
                  await pushDiscord(chunk);
                } else {
                  // 如果太长,只推前 2000 字
                  await pushDiscord(chunk.slice(0, 2000) + '\n\n(内容过长,完整见本地 data/dreams/artifacts/)');
                }
                await new Promise(r => setTimeout(r, 300));
              } catch (e) {
                log(`[dreamer] 推送产物 ${aid} 失败(非致命): ${e.message}`);
              }
            }
          } catch (e) {
            log('[dreamer] 推送产物内容失败(非致命):', e.message);
          }
        }

        // PR4:写遐思录(append 日记风格文字)
        if (diary) {
          try {
            const topInsight = topTitle || null;
            const theme = remArtifacts?.[0]?.theme || null;
            const topScores = remArtifacts?.[0]
              ? { coherence: remArtifacts[0].selfCoherence, utility: remArtifacts[0].selfUtility }
              : null;
            await diary.append({
              type,
              dreamId: id,
              dateKey,
              dateStr: dateKey,
              durationStr: record.durationMs ? `${Math.round(record.durationMs / 1000)}s` : '?',
              theme,
              artifactCount,
              topInsight,
              scores: topScores,
            });
          } catch (e) {
            log('[dreamer] 写遐思录失败(非致命):', e.message);
          }
        }
      }

      try { await release(); } catch {}
    }

    return {
      ok: record.status === 'completed',
      id: record.id,
      status: record.status,
      type: record.type,
      artifactCount,
      artifacts: record.artifacts || [],  // PR4: 返回产物 ID 数组
      topTitle,
      topInsight: topTitle,  // 别名
      theme: remArtifacts?.[0]?.theme || null,
      tokens: record.tokens || { in: 0, out: 0, total: 0 },
      durationMs: record.durationMs,
      errors: record.errors,
    };
  }

  // ---- 状态查询 ----

  async function status({ limit = 10 } = {}) {
    const runs = [];
    try {
      const dayDirs = (await readdir(PATHS.runsDir)).sort().reverse().slice(0, 7);
      for (const day of dayDirs) {
        const dayDir = join(PATHS.runsDir, day);
        const files = (await readdir(dayDir)).sort().reverse();
        for (const f of files) {
          if (!f.endsWith('.json')) continue;
          try {
            const r = JSON.parse(await readFile(join(dayDir, f), 'utf8'));
            runs.push({
              id: r.id,
              type: r.type,
              status: r.status,
              startedAt: r.startedAt,
              durationMs: r.durationMs,
              tokens: r.tokens?.total || 0,
              artifactCount: r.artifacts?.length || 0,
            });
            if (runs.length >= limit) break;
          } catch {}
        }
        if (runs.length >= limit) break;
      }
    } catch {}
    return {
      enabled: xc.enabled,
      budget: budget ? await budget.snapshot() : null,
      runs,
    };
  }

  async function shutdown() {
    // 当前阶段模块无状态,以后扩展时在这里清理
    log('[dreamer] shutdown');
  }

  return {
    run,
    status,
    shutdown,
    TYPES,
    ALL_TYPES,
  };
}