// scripts/fde-e2e.mjs
// 完整端到端：FDE 项目创建 → Demo → 审批 → 内容流水线 → 发布 → QA
// 模拟真实业务场景：客户 client-beta 要做 SaaS 数据分析平台

import('../src/runtime/agent-manager.mjs').then(async ({ AgentManager }) => {
  const m = new AgentManager({});
  await m.start();
  const log = (label, r) => {
    const id = r.result?.prjId ?? r.result?.candidateId ?? r.result?.renderId ?? r.result?.publishId ?? r.result?.qaId ?? r.approvalId ?? r.error ?? '';
    console.log(`  ${label} => ${r.status} ${id}`);
  };

  console.log('═══════════════════════════════════════════════');
  console.log('  FDE E2E · 杭州 OPC 张三 · client-beta SaaS');
  console.log('═══════════════════════════════════════════════\n');

  // ── Phase 1: FDE 企业主链 ──
  console.log('▶ Phase 1: 企业项目创建');
  const r1 = await m.dispatch({
    source: 'discord', channelId: 'CH_PROJECT_MGMT', userId: 'U-founder',
    text: '!pr new client-beta saas "SaaS 数据分析平台 MVP"',
  });
  log('!pr new', r1);
  const prjId = r1.result?.prjId;

  const r2 = await m.dispatch({
    source: 'discord', channelId: 'CH_FDE_DELIVERY', userId: 'U-founder',
    text: `!demo new ${prjId}`,
  });
  log('!demo new', r2);
  console.log(`    demoCard => ${r2.result?.demoCard?.title}`);

  // Demo 审批
  const r3 = await m.dispatch({
    source: 'discord', channelId: 'CH_FDE_DELIVERY', userId: 'U-founder',
    text: `!demo approve ${prjId}`,
  });
  log('!demo approve', r3);
  if (r3.status === 'NEED_APPROVAL') {
    const r3b = await m.dispatch({
      source: 'discord', channelId: 'CH_APPROVAL_CENTER', userId: 'U-founder',
      text: `!approve ${r3.approvalId}`,
    });
    log('  !approve demo', r3b);
  }

  // ── Phase 2: 内容流水线 ──
  console.log('\n▶ Phase 2: 内容生产（每日工作 → 内容）');
  const STORY = `为客户 client-beta 完成了 SaaS 数据分析平台 Demo。技术栈 React+TS+Vite+Tailwind，部署 commit def5678ab，仓库 https://github.com/huifer/client-beta-demo。核心功能：实时数据看板、多维筛选、导出 Excel。客户反馈积极，已进入合同阶段。`;

  const r4 = await m.dispatch({
    source: 'discord', channelId: 'CH_DAILY_MATERIAL', userId: 'U-founder',
    text: `!intake now ${STORY}`,
  });
  log('!intake now', r4);
  const matId = r4.result?.materialId;

  const r5 = await m.dispatch({
    source: 'discord', channelId: 'CH_DOMESTIC_MAIN', userId: 'U-founder',
    text: `!distill now --mat=${matId}`,
  });
  log('!distill now', r5);
  console.log(`    score => ${r5.result?.score}/40  verdict => ${r5.result?.verdict}`);
  const cntId = r5.result?.candidateId;

  const r6 = await m.dispatch({
    source: 'discord', channelId: 'CH_CONTROL_DASH', userId: 'U-founder',
    text: `!privacy check --cnt=${cntId}`,
  });
  log('!privacy check', r6);
  console.log(`    findings => ${JSON.stringify(r6.result?.findings)}`);

  const r7 = await m.dispatch({
    source: 'discord', channelId: 'CH_CONTROL_DASH', userId: 'U-founder',
    text: `!fact check --cnt=${cntId}`,
  });
  log('!fact check', r7);
  console.log(`    supported => ${r7.result?.supported}/${r7.result?.totalClaims}  passed => ${r7.result?.passed}`);

  // ── Phase 3: 渲染 + 发布 + QA ──
  console.log('\n▶ Phase 3: 多平台渲染 + 发布');
  const platforms = ['wechat', 'x', 'newsletter'];
  const publishIds = [];

  for (const platform of platforms) {
    const rr = await m.dispatch({
      source: 'discord', channelId: `CH_PREVIEW_${platform.toUpperCase()}`, userId: 'U-founder',
      text: `!render platform=${platform} --cnt=${cntId}`,
    });
    log(`!render ${platform}`, rr);
    const rndId = rr.result?.renderId;
    if (!rndId) { console.log(`    ⚠ render failed for ${platform}`); continue; }

    // 发布 → 审批
    const rp = await m.dispatch({
      source: 'discord', channelId: `CH_PUBLISH_${platform.toUpperCase()}`, userId: 'U-founder',
      text: `!publish platform=${platform} --rnd=${rndId}`,
    });
    if (rp.status === 'NEED_APPROVAL') {
      const rpa = await m.dispatch({
        source: 'discord', channelId: 'CH_APPROVAL_CENTER', userId: 'U-founder',
        text: `!approve ${rp.approvalId}`,
      });
      log(`  !approve ${platform}`, rpa);
      // re-publish
      const rp2 = await m.dispatch({
        source: 'discord', channelId: `CH_PUBLISH_${platform.toUpperCase()}`, userId: 'U-founder',
        text: `!publish platform=${platform} --rnd=${rndId}`,
      });
      log(`  re-publish ${platform}`, rp2);
      publishIds.push({ platform, pubId: rp2.result?.publishId });
    } else {
      log(`!publish ${platform}`, rp);
      publishIds.push({ platform, pubId: rp.result?.publishId });
    }
  }

  // ── Phase 4: QA ──
  console.log('\n▶ Phase 4: 质量检查');
  for (const { platform, pubId } of publishIds) {
    if (!pubId) continue;
    const rq = await m.dispatch({
      source: 'discord', channelId: 'CH_AGENT_STATUS', userId: 'U-founder',
      text: `!qa last --pub=${pubId}`,
    });
    log(`!qa ${platform}`, rq);
    console.log(`    verdict => ${rq.result?.verdict}  ${rq.result?.passed}/${rq.result?.total}`);
  }

  // ── 汇总 ──
  console.log('\n═══════════════════════════════════════════════');
  console.log('  E2E 完成');
  console.log(`  项目: ${prjId} (client-beta / saas)`);
  console.log(`  素材: ${matId} → 候选: ${cntId} (${r5.result?.score}/40)`);
  console.log(`  发布: ${publishIds.length} 个平台`);
  console.log('═══════════════════════════════════════════════\n');

  await m.shutdown();
});
