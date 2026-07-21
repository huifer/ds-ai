import('../src/runtime/agent-manager.mjs').then(async ({ AgentManager, parseCommand }) => {
  const m = new AgentManager({});
  await m.start();
  await m.dispatch({ source: 'discord', channelId: 'CH_PROJECT_MGMT', userId: 'U-1', text: '!pr new client-alpha ai-agent "AI"' });
  const r5 = await m.dispatch({ source: 'discord', channelId: 'CH_PROJECT_MGMT', userId: 'U-1', text: '!pr list' });
  console.log('r5 =>', JSON.stringify(r5, null, 2));
  await m.shutdown();
});
