import('../src/runtime/agent-manager.mjs').then(async ({ AgentManager, parseCommand }) => {
  const m = new AgentManager({});
  await m.start();
  console.log('agents registered:', Array.from(m.agents.keys()).join(', '));
  for (const text of [
    '!pr new client-alpha ai-agent "做一个 AI 客服"',
    '!demo new PRJ-2026-0001',
    '!quote approve QTE-2026-0001',
    '!state intake',
    '!unknown thing',
  ]) {
    const cmd = parseCommand(text);
    console.log(text, '=>', JSON.stringify(cmd && cmd.route));
  }
  console.log('chief status =>', JSON.stringify(m.getStatus('chief'), null, 2));
  await m.shutdown();
  console.log('shutdown OK');
});
