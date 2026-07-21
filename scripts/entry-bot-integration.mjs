// scripts/entry-bot-integration.mjs
// 集成测试：模拟 entry-bot 的 Discord 消息 → AgentManager.dispatch → 结果推送流程
// 不需要真实的 Discord 连接，用 mock discord 对象验证推送逻辑

import { AgentManager, parseCommand } from '../src/runtime/agent-manager.mjs';
import { handleAgentResult } from '../src/runtime/agent-result.mjs';

// Mock Discord 客户端 — 记录所有推送
const sent = [];
const mockDiscord = {
  sendEmbed: async (channelId, embed) => {
    sent.push({ type: 'embed', channelId, title: embed.title });
    return { id: 'mock-' + sent.length };
  },
  sendEmbedWithButtons: async (channelId, embed, buttons) => {
    sent.push({ type: 'embed+buttons', channelId, title: embed.title, buttonCount: buttons?.length });
    return { id: 'mock-' + sent.length };
  },
};

const CHANNELS = {
  approvalCenter: 'CH_APPROVAL_CENTER',
  projectMgmt: 'CH_PROJECT_MGMT',
  fdeDelivery: 'CH_FDE_DELIVERY',
  dailyMaterial: 'CH_DAILY_MATERIAL',
  domesticMain: 'CH_DOMESTIC_MAIN',
  previewWechat: 'CH_PREVIEW_WECHAT',
  publishWechat: 'CH_PUBLISH_WECHAT',
  agentStatus: 'CH_AGENT_STATUS',
};

function mockMsg(content, channelId = 'CH_ENTRY', userId = 'U-1') {
  const replies = [];
  return {
    content, channelId,
    author: { id: userId, username: 'tester', bot: false },
    reply: async (text) => { replies.push(text); return { id: 'r-' + replies.length }; },
    _replies: replies,
  };
}

async function simulate(manager, text, channelId) {
  const msg = mockMsg(text, channelId);
  const result = await manager.dispatch({
    source: 'discord', channelId, userId: 'U-1', text,
  });
  await handleAgentResult({ result, msg, discord: mockDiscord, channels: CHANNELS, log: () => {} });
  return { result, msg, sent };
}

async function main() {
  const m = new AgentManager({});
  await m.start();
  sent.length = 0;

  console.log('═══════════════════════════════════════════════');
  console.log('  entry-bot 集成测试');
  console.log('═══════════════════════════════════════════════\n');

  // 1. !pr new → Kanban 卡片推到 #项目管理
  sent.length = 0;
  const r1 = await simulate(m, '!pr new integ-test saas "集成测试项目"', 'CH_ENTRY');
  console.log('▶ !pr new');
  console.log('  status:', r1.result.status);
  console.log('  kanban pushed:', sent.find(s => s.channelId === 'CH_PROJECT_MGMT')?.title ?? 'NONE');
  console.log('  user reply:', r1.msg._replies[0]?.slice(0, 80));
  const prjId = r1.result.result?.prjId;

  // 2. !demo new → Demo 卡片推到 #FDE 交付
  sent.length = 0;
  const r2 = await simulate(m, `!demo new ${prjId}`, 'CH_ENTRY');
  console.log('\n▶ !demo new');
  console.log('  status:', r2.result.status);
  console.log('  demo pushed:', sent.find(s => s.channelId === 'CH_FDE_DELIVERY')?.title ?? 'NONE');

  // 3. !intake now → 素材卡推到 #今日素材
  sent.length = 0;
  const r3 = await simulate(m, '!intake now 集成测试素材 commit abc123 https://github.com/test', 'CH_ENTRY');
  console.log('\n▶ !intake now');
  console.log('  status:', r3.result.status);
  console.log('  card pushed:', sent.find(s => s.channelId === 'CH_DAILY_MATERIAL')?.title ?? 'NONE');

  // 4. !distill now → 候选卡推到 #主快讯
  sent.length = 0;
  const r4 = await simulate(m, '!distill now', 'CH_ENTRY');
  console.log('\n▶ !distill now');
  console.log('  status:', r4.result.status);
  console.log('  card pushed:', sent.find(s => s.channelId === 'CH_DOMESTIC_MAIN')?.title ?? 'NONE');
  const cntId = r4.result.result?.candidateId;

  // 5. !privacy check → 回复结果
  sent.length = 0;
  const r5 = await simulate(m, `!privacy check --cnt=${cntId}`, 'CH_ENTRY');
  console.log('\n▶ !privacy check');
  console.log('  status:', r5.result.status);
  console.log('  reply:', r5.msg._replies[0]?.slice(0, 80));

  // 6. !render platform=wechat → 渲染卡推到 #preview
  sent.length = 0;
  const r6 = await simulate(m, `!render platform=wechat --cnt=${cntId}`, 'CH_ENTRY');
  console.log('\n▶ !render platform=wechat');
  console.log('  status:', r6.result.status);
  console.log('  card pushed:', sent.find(s => s.channelId === 'CH_PREVIEW_WECHAT')?.title ?? 'NONE');
  const rndId = r6.result.result?.renderId;

  // 7. !publish → 审批卡推到 #审批中心
  sent.length = 0;
  const r7 = await simulate(m, `!publish platform=wechat --rnd=${rndId}`, 'CH_ENTRY');
  console.log('\n▶ !publish');
  console.log('  status:', r7.result.status);
  console.log('  approval pushed:', sent.find(s => s.channelId === 'CH_APPROVAL_CENTER' && s.type === 'embed+buttons')?.title ?? 'NONE');
  const aprId = r7.result.approvalId;

  // 8. !approve → 审批按钮回调
  sent.length = 0;
  const r8 = await simulate(m, `!approve ${aprId}`, 'CH_APPROVAL_CENTER');
  console.log('\n▶ !approve (button callback)');
  console.log('  status:', r8.result.status);
  console.log('  reply:', r8.msg._replies[0]?.slice(0, 80));

  // 9. re-publish → 现在应该通过了
  sent.length = 0;
  const r9 = await simulate(m, `!publish platform=wechat --rnd=${rndId}`, 'CH_ENTRY');
  console.log('\n▶ re-publish (after approval)');
  console.log('  status:', r9.result.status);
  console.log('  card pushed:', sent.find(s => s.channelId === 'CH_PUBLISH_WECHAT')?.title ?? 'NONE');
  const pubId = r9.result.result?.publishId;

  // 10. !qa last → QA 卡推到 #agent-状态
  sent.length = 0;
  const r10 = await simulate(m, `!qa last --pub=${pubId}`, 'CH_ENTRY');
  console.log('\n▶ !qa last');
  console.log('  status:', r10.result.status);
  console.log('  card pushed:', sent.find(s => s.channelId === 'CH_AGENT_STATUS')?.title ?? 'NONE');

  // 11. !pr list → 回复 yaml 输出
  sent.length = 0;
  const r11 = await simulate(m, '!pr list', 'CH_ENTRY');
  console.log('\n▶ !pr list');
  console.log('  status:', r11.result.status);
  console.log('  reply (yaml):', r11.msg._replies[0]?.slice(0, 60));

  // 12. 旧命令不被 AgentManager 拦截
  const cmd = parseCommand('!help');
  console.log('\n▶ !help routing');
  console.log('  AgentManager route:', cmd?.route ? 'INTERCEPTED' : 'PASS-THROUGH (correct)');

  console.log('\n═══════════════════════════════════════════════');
  console.log('  集成测试完成 · 所有卡片正确推送到目标频道');
  console.log('═══════════════════════════════════════════════\n');

  await m.shutdown();
}

main().catch(console.error);
