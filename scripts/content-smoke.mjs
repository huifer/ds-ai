// scripts/content-smoke.mjs
// 内容流水线端到端：intake → distill → privacy → fact-check → render → publish → qa
import('../src/runtime/agent-manager.mjs').then(async ({ AgentManager }) => {
  const m = new AgentManager({});
  await m.start();

  const RAW = '今天给客户做了一个 AI 客服 Agent，用了 React+TS+Vite，commit abc1234ef 部署在 https://github.com/huifer/demo 联系人 13800138000 zhangsan@test.com';

  // 1. intake
  const r1 = await m.dispatch({ source: 'discord', channelId: 'CH_DAILY_MATERIAL', userId: 'U-1', text: `!intake now ${RAW}` });
  console.log('\n=> !intake now =>', r1.status, r1.result?.materialId);
  console.log('   summary =>', r1.result?.summary?.slice(0, 80));
  const matId = r1.result?.materialId;

  // 2. distill
  const r2 = await m.dispatch({ source: 'discord', channelId: 'CH_DOMESTIC_MAIN', userId: 'U-1', text: `!distill now --mat=${matId}` });
  console.log('\n=> !distill now =>', r2.status, r2.result?.candidateId);
  console.log('   score =>', r2.result?.score, '/40  verdict =>', r2.result?.verdict);
  console.log('   privacy issues =>', r2.result?.privacyIssues, '  fact unsupported =>', r2.result?.factUnsupported);
  const cntId = r2.result?.candidateId;

  // 3. privacy check
  const r3 = await m.dispatch({ source: 'discord', channelId: 'CH_CONTROL_DASH', userId: 'U-1', text: `!privacy check --cnt=${cntId}` });
  console.log('\n=> !privacy check =>', r3.status);
  console.log('   findings =>', JSON.stringify(r3.result?.findings));
  console.log('   redacted preview =>', r3.result?.redactedPreview?.slice(0, 80));

  // 4. fact check
  const r4 = await m.dispatch({ source: 'discord', channelId: 'CH_CONTROL_DASH', userId: 'U-1', text: `!fact check --cnt=${cntId}` });
  console.log('\n=> !fact check =>', r4.status);
  console.log('   supported =>', r4.result?.supported, '/', r4.result?.totalClaims, '  passed =>', r4.result?.passed);

  // 5. render
  const r5 = await m.dispatch({ source: 'discord', channelId: 'CH_PREVIEW_WECHAT', userId: 'U-1', text: `!render platform=wechat --cnt=${cntId}` });
  console.log('\n=> !render platform=wechat =>', r5.status, r5.result?.renderId);
  console.log('   bytes =>', r5.result?.bytes, '  htmlPath =>', r5.result?.htmlPath?.split('/').pop());
  const rndId = r5.result?.renderId;

  // 6. publish → 审批门禁
  const r6 = await m.dispatch({ source: 'discord', channelId: 'CH_PUBLISH_WECHAT', userId: 'U-1', text: `!publish platform=wechat --rnd=${rndId}` });
  console.log('\n=> !publish =>', r6.status, r6.approvalId ?? r6.result?.publishId ?? '');
  // 如果走审批，模拟 grant
  let pubId;
  if (r6.status === 'NEED_APPROVAL') {
    const r6b = await m.dispatch({ source: 'discord', channelId: 'CH_APPROVAL_CENTER', userId: 'U-1', text: `!approve ${r6.approvalId}` });
    console.log('   !approve =>', r6b.status, r6b.result?.result);
    // 审批通过后重新 publish
    const r6c = await m.dispatch({ source: 'discord', channelId: 'CH_PUBLISH_WECHAT', userId: 'U-1', text: `!publish platform=wechat --rnd=${rndId}` });
    pubId = r6c.result?.publishId;
    console.log('   re-publish =>', r6c.status, pubId);
  } else {
    pubId = r6.result?.publishId;
  }

  // 7. qa
  const r7 = await m.dispatch({ source: 'discord', channelId: 'CH_AGENT_STATUS', userId: 'U-1', text: `!qa last --pub=${pubId}` });
  console.log('\n=> !qa last =>', r7.status, r7.result?.qaId);
  console.log('   verdict =>', r7.result?.verdict, '  passed =>', r7.result?.passed, '/', r7.result?.total);
  console.log('   checks =>', JSON.stringify(r7.result?.checks));

  console.log('\n✅ 内容流水线 7 阶段全部跑通');
  await m.shutdown();
});
