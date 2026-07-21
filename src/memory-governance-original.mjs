// ~/pi-discord-agents/src/memory-governance.mjs
// 记忆治理：过期、清理、维护
//
// 核心功能：
//   - 自动检测过期记忆
//   - 归档长期未访问记忆
//   - 删除冗余的历史版本
//   - 矛盾记忆处理
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

// 过期规则
const EXPIRATION_RULES = [
  {
    id: 'expire-by-date',
    name: '时间过期',
    priority: 1,
    condition: (meta) => {
      if (!meta.expiresAt) return false;
      return new Date(meta.expiresAt) < new Date();
    },
    action: 'expire',
    reason: (meta) => `过期日期: ${meta.expiresAt}`,
  },
  {
    id: 'expire-long-unused',
    name: '长期未访问',
    priority: 2,
    condition: (meta, now) => {
      if (!meta.lastAccessedAt) return false;
      const daysSinceAccess = (now - new Date(meta.lastAccessedAt).getTime()) / 86400_000;
      // 不同 kind 有不同的未访问阈值
      const thresholds = {
        decision: 365,
        constraint: 365,
        preference: 180,
        fact: 90,
        build: 90,
        reflection: 90,
        definition: 180,
        idea: 60,
        project: 120,
        context: 30,
        todo: 60,
      };
      return daysSinceAccess > (thresholds[meta.kind] || 90);
    },
    action: 'archive',
    reason: (meta) => `未访问超过阈值 (${meta.kind})`,
  },
  {
    id: 'expire-low-confidence',
    name: '低置信度',
    priority: 3,
    condition: (meta) => {
      if (meta.confidence >= 0.6) return false;
      if ((meta.accessCount || 0) >= 5) return false;
      return true;
    },
    action: 'review',
    reason: (meta) => `置信度过低 (${meta.confidence}) 且访问次数不足 (${meta.accessCount || 0})`,
  },
  {
    id: 'expire-contradictory',
    name: '矛盾记忆',
    priority: 4,
    condition: (meta, allMetas) => {
      // 检测同 subject + kind 但内容矛盾的记忆
      const sameSubject = allMetas.filter(m =>
        m.subject === meta.subject &&
        m.kind === meta.kind &&
        m.status === 'active' &&
        m.id !== meta.id
      );

      for (const other of sameSubject) {
        if (isContradictory(meta.content, other.content)) {
          return true;
        }
      }
      return false;
    },
    action: 'conflict',
    reason: (meta, allMetas) => {
      const sameSubject = allMetas.filter(m =>
        m.subject === meta.subject &&
        m.kind === meta.kind &&
        m.status === 'active' &&
        m.id !== meta.id
      );
      const contradictory = sameSubject.find(m => isContradictory(meta.content, m.content));
      return `与 [${contradictory.id}] 矛盾`;
    },
  },
];

// 矛盾检测
function isContradictory(text1, text2) {
  // 简单的矛盾关键词检测
  const opposites = [
    ['用', '不用', ['使用', '不使用']],
    ['选择', '放弃', ['选择', '不选择']],
    ['喜欢', '不喜欢', ['喜欢', '讨厌']],
    ['要', '不要', ['需要', '不需要']],
    ['必须', '不能', ['必须', '禁止']],
    ['启用', '禁用', ['开启', '关闭']],
    ['允许', '拒绝', ['允许', '禁止']],
  ];

  for (const [pos, neg] of opposites) {
    const posRegex = new RegExp(pos, 'i');
    const negRegex = new RegExp(neg, 'i');

    if (posRegex.test(text1) && negRegex.test(text2)) return true;
    if (negRegex.test(text1) && posRegex.test(text2)) return true;
  }

  return false;
}

// 矛盾记忆解析
async function resolveContradictions(memoryStore, allMemories, log) {
  const groups = {};
  const resolved = { conflicts: 0, resolved: 0 };

  // 按主题分组
  for (const memory of allMemories) {
    if (memory.status !== 'active') continue;
    const key = `${memory.kind}:${memory.subject}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(memory);
  }

  // 检测矛盾
  for (const [key, memories] of Object.entries(groups)) {
    if (memories.length < 2) continue;

    const contradictions = detectContradictionsInGroup(memories);
    resolved.conflicts += contradictions.length;

    if (contradictions.length > 0) {
      // 解决策略：选择访问次数多、置信度高的
      const winner = contradictions.sort((a, b) => {
        const scoreA = (a.accessCount || 0) * a.confidence;
        const scoreB = (b.accessCount || 0) * b.confidence;
        return scoreB - scoreA;
      })[0];

      const losers = contradictions.filter(m => m.id !== winner.id);

      for (const loser of losers) {
        try {
          await memoryStore.revoke({
            id: loser.id,
            reason: `与 [${winner.id}] 矛盾`,
          });

          // 更新 winner 的 supersedes
          await memoryStore.upsert({
            id: winner.id,
            supersedes: [
              ...(winner.supersedes || []),
              loser.id,
            ],
          });

          log(`[governance] 矛盾已解决: ${loser.id} → ${winner.id}`);
          resolved.resolved++;
        } catch (e) {
          log(`[governance] 解决矛盾失败: ${e.message}`);
        }
      }
    }
  }

  return resolved;
}

function detectContradictionsInGroup(memories) {
  const contradictory = [];

  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      if (isContradictory(memories[i].content, memories[j].content)) {
        contradictory.push(memories[i]);
        contradictory.push(memories[j]);
      }
    }
  }

  return contradictory;
}

// 核心函数：runGovernance
export function createMemoryGovernance({ memoryStore, log = () => {} } = {}) {
  // 执行治理
  async function runGovernance({ dryRun = false, rules = EXPIRATION_RULES } = {}) {
    log('[governance] 开始执行治理...');

    const result = {
      expired: 0,
      archived: 0,
      reviewed: 0,
      conflicts: 0,
      resolved: 0,
      deleted: 0,
      errors: 0,
    };

    const now = Date.now();

    // 1. 获取所有记忆
    const allMemories = await memoryStore.query({ includeSuperseded: true });
    const activeMemories = allMemories.items.filter(m => m.status === 'active');

    log(`[governance] 总记忆: ${allMemories.items.length}，活跃: ${activeMemories.length}`);

    // 2. 检测和解决矛盾（优先）
    log('[governance] 检测矛盾记忆...');
    const conflictResult = await resolveContradictions(memoryStore, activeMemories, log);
    result.conflicts = conflictResult.conflicts;
    result.resolved = conflictResult.resolved;

    // 3. 应用过期规则
    log('[governance] 应用过期规则...');

    for (const memory of activeMemories) {
      for (const rule of rules) {
        try {
          if (rule.condition(memory, now)) {
            const reason = typeof rule.reason === 'function' 
              ? rule.reason(memory, activeMemories) 
              : rule.reason;

            log(`[governance] 触发规则 [${rule.id}]: ${memory.subject} - ${reason}`);

            if (dryRun) {
              log(`[governance] [DRY-RUN] 将执行: ${rule.action}`);
              break;
            }

            switch (rule.action) {
              case 'expire':
                await memoryStore.revoke({ id: memory.id, reason });
                result.expired++;
                log(`[governance] ✅ 过期: ${memory.subject}`);
                break;

              case 'archive':
                await memoryStore.upsert({ ...memory, status: 'archived' });
                result.archived++;
                log(`[governance] ✅ 归档: ${memory.subject}`);
                break;

              case 'review':
                // 标记需要人工审查
                await memoryStore.upsert({
                  ...memory,
                  tags: [...(memory.tags || []), 'needs-review'],
                });
                result.reviewed++;
                log(`[governance] ✅ 标记审查: ${memory.subject}`);
                break;

              case 'conflict':
                // 已在前面处理
                break;

              default:
                log(`[governance] ⚠️ 未知动作: ${rule.action}`);
            }

            break;  // 只执行第一个匹配的规则
          }
        } catch (e) {
          log(`[governance] ❌ 规则执行失败 [${rule.id}]: ${e.message}`);
          result.errors++;
        }
      }
    }

    // 4. 清理历史版本
    log('[governance] 清理历史版本...');
    const compactResult = await memoryStore.compact();
    result.deleted = compactResult.removed || 0;

    log(`[governance] 治理完成: 过期=${result.expired}, 归档=${result.archived}, 标记审查=${result.reviewed}, 矛盾=${result.conflicts}, 已解决=${result.resolved}, 删除=${result.deleted}, 错误=${result.errors}`);

    return result;
  }

  // 生成治理报告
  async function generateReport() {
    const stats = await memoryStore.stats();
    const allMemories = await memoryStore.query({ includeSuperseded: true });

    // 按状态统计
    const byStatus = {};
    const byKind = {};
    const byAccess = { never: 0, low: 0, medium: 0, high: 0 };

    for (const memory of allMemories.items) {
      const status = memory.status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;

      const kind = memory.kind;
      byKind[kind] = (byKind[kind] || 0) + 1;

      const accessCount = memory.accessCount || 0;
      if (accessCount === 0) byAccess.never++;
      else if (accessCount < 3) byAccess.low++;
      else if (accessCount < 10) byAccess.medium++;
      else byAccess.high++;
    }

    return {
      timestamp: new Date().toISOString(),
      summary: stats,
      byStatus,
      byKind,
      byAccess,
      recommendations: generateRecommendations(stats, byAccess, byStatus),
    };
  }

  // 生成建议
  function generateRecommendations(stats, byAccess, byStatus) {
    const recommendations = [];

    // 低访问率
    const totalActive = byStatus.active || 0;
    const neverAccessed = byAccess.never || 0;
    if (totalActive > 0 && neverAccessed / totalActive > 0.3) {
      recommendations.push({
        type: 'warning',
        message: `${neverAccessed} 条记忆从未被访问 (${(neverAccessed / totalActive * 100).toFixed(1)}%)，建议清理或归档`,
      });
    }

    // 归档记忆过多
    const archived = byStatus.archived || 0;
    if (archived > 100) {
      recommendations.push({
        type: 'info',
        message: `归档记忆过多 (${archived} 条)，考虑删除历史版本`,
      });
    }

    // 类型分布不均
    const kindCount = Object.keys(byKind).length;
    if (kindCount < 3) {
      recommendations.push({
        type: 'info',
        message: `记忆类型较少 (${kindCount} 种)，建议增加更多类型`,
      });
    }

    return recommendations;
  }

  // 手动清理
  async function manualCleanup({ days = 90, force = false } = {}) {
    log(`[governance] 手动清理: ${days} 天${force ? ' (强制)' : ''}`);

    const result = {
      scanned: 0,
      expired: 0,
      archived: 0,
      deleted: 0,
    };

    const now = Date.now();
    const cutoff = new Date(now - days * 86400_000);
    const histCutoff = new Date(now - 180 * 86400_000);  // 历史版本 180 天

    const allMemories = await memoryStore.query({ includeSuperseded: true });

    for (const memory of allMemories.items) {
      result.scanned++;

      if (memory.status === 'active') {
        // 检查过期
        const isExpired = memory.expiresAt && new Date(memory.expiresAt) < new Date();
        const isOld = memory.updatedAt && new Date(memory.updatedAt) < cutoff;

        if (isExpired || (isOld && force)) {
          try {
            await memoryStore.revoke({ id: memory.id, reason: isExpired ? '已过期' : '长期未更新' });
            result.expired++;
            log(`[governance] 清理: ${memory.subject}`);
          } catch (e) {
            log(`[governance] 清理失败: ${e.message}`);
          }
        }
      } else if (['superseded', 'revoked'].includes(memory.status)) {
        // 删除历史版本
        const isOld = memory.updatedAt && new Date(memory.updatedAt) < histCutoff;

        if (isOld) {
          try {
            await memoryStore.delete(memory.id);
            result.deleted++;
            log(`[governance] 删除历史: ${memory.subject}`);
          } catch (e) {
            log(`[governance] 删除失败: ${e.message}`);
          }
        }
      }
    }

    log(`[governance] 清理完成: 扫描=${result.scanned}, 过期=${result.expired}, 删除=${result.deleted}`);

    return result;
  }

  return {
    runGovernance,
    generateReport,
    manualCleanup,
    EXPIRATION_RULES,
  };
}