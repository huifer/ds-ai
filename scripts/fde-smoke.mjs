// scripts/fde-smoke.mjs
// 端到端跑通：!pr new → 项目目录骨架 → 推 Kanban 卡片
import('../src/runtime/agent-manager.mjs').then(async ({ AgentManager, parseCommand }) => {
  const m = new AgentManager({});
  await m.start();
  const text = '!pr new client-alpha ai-agent "做一个 AI 客服 Agent"';
  const cmd = parseCommand(text);
  console.log('parsed route =>', JSON.stringify(cmd && cmd.route));
  const result = await m.dispatch({ source: 'discord', channelId: 'CH_PROJECT_MGMT', text });
  console.log('dispatch =>', JSON.stringify(result, null, 2));
  await m.shutdown();
});
