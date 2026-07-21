// ~/pi-discord-agents/src/runtime/agent-result.mjs
// 处理 AgentManager.dispatch() 的结果，推送到 Discord
// 被 entry-bot.mjs 和测试脚本共用

import { resolveContentTargets } from './channel-map.mjs';

export async function handleAgentResult({ result, msg, discord, channels = {}, env = {}, log = () => {} }) {
  // NEED_APPROVAL → 推审批卡到 #审批中心
  if (result.status === 'NEED_APPROVAL') {
    const ch = channels.approvalCenter || env.CH_APPROVAL_CENTER;
    if (ch && discord.sendEmbedWithButtons) {
      const embed = {
        title: `审批请求 · ${result.approvalKind}`,
        description: `Agent: \`${result.agentId}\`\nSkill: \`${result.skill}\``,
        color: 0xeab308,
        fields: [
          { name: 'Approval ID', value: result.approvalId, inline: true },
          { name: 'Source', value: `<#${result.channelId ?? '?'}>`, inline: true },
        ],
        footer: { text: `点击按钮处理 · ${new Date().toISOString().slice(0, 19)}` },
      };
      const buttons = [
        { customId: `apr:approve:${result.approvalId}`, label: '批准', style: 'success', emoji: '✅' },
        { customId: `apr:reject:${result.approvalId}`, label: '拒绝', style: 'danger', emoji: '❌' },
        { customId: `apr:defer:${result.approvalId}`, label: '延期', style: 'secondary', emoji: '⏳' },
      ];
      await discord.sendEmbedWithButtons(ch, embed, buttons);
    }
    const replyText = `📋 已提交审批 (\`${result.approvalId}\`) → <#${ch || '?'}>`;
    try { await msg?.reply?.(replyText); } catch {}
    return;
  }

  // ERROR
  if (result.status === 'ERROR' || result.error) {
    await safeReply(msg, `⚠️ \`${result.agentId ?? '?'}\`: ${result.error ?? '未知错误'}`);
    return;
  }

  const r = result.result ?? result;
  // 合并 env（优先 channels 中显式传入的，其次 env）
  const effectiveEnv = { ...env, ...stripUndefined(channels) };

  // Kanban 卡片（!pr new）
  if (r.kanban) {
    const ch = channels.projectMgmt || effectiveEnv.CH_PROJECT_MGMT || msg?.channelId;
    if (discord.sendEmbed) {
      await discord.sendEmbed(ch, {
        title: r.kanban.title,
        description: r.kanban.description,
        color: r.kanban.color,
        fields: r.kanban.fields,
        footer: r.kanban.footer,
      });
    }
    await safeReply(msg, `✅ 项目已创建: \`${r.prjId}\` → <#${ch}>`);
    return;
  }

  // Demo 卡片（!demo new）
  if (r.demoCard) {
    const ch = channels.fdeDelivery || effectiveEnv.CH_FDE_DELIVERY || msg?.channelId;
    if (discord.sendEmbed) {
      await discord.sendEmbed(ch, {
        title: r.demoCard.title,
        description: r.demoCard.description,
        color: r.demoCard.color,
        fields: r.demoCard.fields,
      });
    }
    await safeReply(msg, `✅ Demo 已就绪: \`${r.alias ?? ''}\` → <#${ch}>`);
    return;
  }

  // 内容候选卡（intake / distill / render / publish / qa）
  if (r.card) {
    const targets = resolveContentTargets(result.agentId, result, effectiveEnv);
    const pushedChannels = [];
    for (const t of targets) {
      if (t.channelId && discord.sendEmbed) {
        await discord.sendEmbed(t.channelId, r.card);
        pushedChannels.push(t.channelId);
      }
    }
    const id = r.materialId ?? r.candidateId ?? r.renderId ?? r.publishId ?? r.qaId ?? '';
    const chHints = pushedChannels.map((c) => `<#${c}>`).join(' ') || '当前频道';
    await safeReply(msg, `✅ \`${result.agentId}\` 完成${id ? ` · \`${id}\`` : ''} → ${chHints}`);
    return;
  }

  // 文本输出（!pr list / !state）
  if (r.output) {
    const out = r.output.slice(0, 1900);
    await safeReply(msg, `\`\`\`yaml\n${out}\n\`\`\``);
    return;
  }

  // 审批结果（!approve / !reject / !defer）
  if (r.ok !== undefined) {
    const icon = r.ok ? '✅' : '⚠️';
    await safeReply(msg, `${icon} \`${r.id}\` → ${r.decision ?? r.reason ?? 'done'}`);
    return;
  }

  // 隐私 / 事实检查结果
  if (r.findings !== undefined || r.supported !== undefined) {
    const parts = [];
    if (r.findings !== undefined) parts.push(`findings: ${JSON.stringify(r.findings)}`);
    if (r.supported !== undefined) parts.push(`${r.supported}/${r.totalClaims} supported, passed=${r.passed}`);
    if (r.redactedPreview) parts.push(`\npreview: ${r.redactedPreview.slice(0, 120)}`);
    await safeReply(msg, `🔍 \`${result.agentId}\`\n${parts.join('\n')}`);
    return;
  }

  // 默认：简短确认
  const id = r.prjId ?? r.candidateId ?? r.materialId ?? r.renderId ?? r.publishId ?? r.qaId ?? '';
  await safeReply(msg, `✅ \`${result.agentId}\` 完成${id ? ` · \`${id}\`` : ''}`);
}

async function safeReply(msg, text) {
  try { await msg?.reply?.(text); } catch {}
}

function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}
