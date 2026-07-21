import('../src/runtime/agent-manager.mjs').then(async ({ AgentManager }) => {
  const m = new AgentManager({});
  await m.start();
  const slot = m.agents.get('pm');
  console.log('pm skills[0..3]:', slot?.def.skills.slice(0, 3));
  // 直接调 call
  const r = await m.call('pm', 'project-bootstrap', { source: 'discord', args: { alias: 'client-alpha', industry: 'ai-agent', requirement: 'test' } });
  console.log('call =>', JSON.stringify(r));
  await m.shutdown();
});
