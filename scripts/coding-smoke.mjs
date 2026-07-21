// scripts/coding-smoke.mjs
// 端到端：!pr new → 取出真实 PRJ-ID → !demo new → !quote approve → !approve
import('../src/runtime/agent-manager.mjs').then(async ({ AgentManager, parseCommand }) => {
  const m = new AgentManager({});
  await m.start();
  // 1. !pr new
  const r1 = await m.dispatch({ source: 'discord', channelId: 'CH_PROJECT_MGMT', userId: 'U-1', text: '!pr new client-alpha ai-agent "做一个 AI 客服 Agent"' });
  console.log('\n=> !pr new =>', r1.status, r1.result?.prjId);
  const prjId = r1.result?.prjId;

  // 2. !demo new
  const r2 = await m.dispatch({ source: 'discord', channelId: 'CH_FDE_DELIVERY', userId: 'U-1', text: `!demo new ${prjId}` });
  console.log('\n=> !demo new =>', r2.status, r2.result?.demoCard?.title);

  // 3. !quote approve → 走审批
  const r3 = await m.dispatch({ source: 'discord', channelId: 'CH_APPROVAL_CENTER', userId: 'U-1', text: '!quote approve QTE-2026-0001' });
  console.log('\n=> !quote approve =>', r3.status, r3.approvalId, r3.channel);

  // 4. !approve <id>（按钮回调，chief 实际 grant）
  const r4 = await m.dispatch({ source: 'discord', channelId: 'CH_APPROVAL_CENTER', userId: 'U-1', text: `!approve ${r3.approvalId}` });
  console.log('\n=> !approve via button =>', JSON.stringify(r4, null, 2));

  // 5. !pr list
  const r5 = await m.dispatch({ source: 'discord', channelId: 'CH_PROJECT_MGMT', userId: 'U-1', text: '!pr list' });
  console.log('\n=> !pr list (first 320 chars) =>');
  console.log((r5.output ?? '').slice(0, 320));

  // 6. 状态
  const r6 = await m.dispatch({ source: 'discord', channelId: 'CH_CONTROL_DASH', userId: 'U-1', text: '!state' });
  console.log('\n=> !state (top 3 agents) =>');
  console.log(JSON.stringify((r6.statuses ?? r6.agents ?? r6).slice?.(0, 3) ?? r6, null, 2));

  await m.shutdown();
});
