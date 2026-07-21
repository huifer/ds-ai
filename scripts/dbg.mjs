import('../src/runtime/agent-manager.mjs').then(async ({ AgentManager, parseCommand }) => {
  const m = new AgentManager({});
  await m.start();
  const text = '!pr new client-alpha ai-agent "做一个 AI 客服 Agent"';
  const cmd = parseCommand(text);
  console.log('cmd =>', JSON.stringify(cmd, null, 2));
  console.log('route =>', JSON.stringify(cmd.route, null, 2));
  console.log('agents.has(pm) =>', m.agents.has(cmd.route.agentId));
  console.log('all ids =>', Array.from(m.agents.keys()).join(','));
  await m.shutdown();
});
