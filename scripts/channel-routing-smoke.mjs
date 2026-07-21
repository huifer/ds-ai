// scripts/channel-routing-smoke.mjs
// 完整频道路由测试：验证所有内容结果推送到正确的 Discord 频道
// 重点验证：国内内容 → #国内总编，海外内容 → #海外总编
//
// 测试场景：
// 1. intake → #每日素材
// 2. distill（国内平台）→ #国内总编
// 3. distill（海外平台）→ #海外总编
// 4. distill（混合平台）→ #国内总编 + #海外总编
// 5. render wechat → #预览-公众号
// 6. render x → #Preview-X
// 7. auto-render（全平台）→ #国内总编 + #海外总编
// 8. publish wechat → #发布-公众号
// 9. publish x → #Publish-X
// 10. qa → #Agent状态
// 11. deliver → 对应预览频道（embed + 文本 + HTML）

import { AgentManager } from '../src/runtime/agent-manager.mjs';
import { handleAgentResult } from '../src/runtime/agent-result.mjs';
import { deliverToDiscord, deliverBatch } from '../src/runtime/commands/deliver.mjs';
import {
  resolveContentTargets,
  classifyPlatforms,
  getEditorialChannelsForPlatforms,
} from '../src/runtime/channel-map.mjs';

const log = (...a) => console.log(...a);

// ===== Mock Discord (记录所有推送) =====
const pushed = []; // {channelId, type, content}
const mockDiscord = {
  send(channelId, content) {
    pushed.push({ channelId, type: 'text', content: content?.slice(0, 80) });
    return Promise.resolve({ id: String(pushed.length) });
  },
  sendEmbed(channelId, embed) {
    pushed.push({ channelId, type: 'embed', title: embed?.title?.slice(0, 60) });
    return Promise.resolve({ id: String(pushed.length) });
  },
  sendEmbedWithButtons(channelId, embed, buttons) {
    pushed.push({ channelId, type: 'approval', title: embed?.title?.slice(0, 60) });
    return Promise.resolve({ id: String(pushed.length) });
  },
  async sendFile(channelId, filePath, filename, caption) {
    pushed.push({ channelId, type: 'file', filename });
    return Promise.resolve({ id: String(pushed.length) });
  },
  react() { return Promise.resolve(); },
  removeReact() { return Promise.resolve(); },
};

// ===== Mock env（使用易读的频道别名） =====
const ENV = {
  CH_DAILY_MATERIAL: '每日素材',
  CH_DOMESTIC_MAIN: '国内总编',
  CH_OS_MAIN: '海外总编',
  CH_NEWS_FEED: '主快讯',
  CH_AGENT_STATUS: 'Agent状态',
  CH_APPROVAL_CENTER: '审批中心',
  CH_PROJECT_MGMT: '项目管理',
  CH_FDE_DELIVERY: 'FDE交付',
  // 预览（国内）
  CH_DOMESTIC_PREVIEW_WECHAT: '预览-公众号',
  CH_DOMESTIC_PREVIEW_XHS: '预览-小红书',
  CH_DOMESTIC_PREVIEW_VIDEO: '预览-视频号',
  CH_DOMESTIC_PREVIEW_DOUYIN: '预览-抖音',
  // 预览（海外）
  CH_OS_PREVIEW_X: 'Preview-X',
  CH_OS_PREVIEW_PH: 'Preview-PH',
  CH_OS_PREVIEW_NEWSLETTER: 'Preview-Newsletter',
  CH_OS_PREVIEW_YOUTUBE: 'Preview-YouTube',
  CH_OS_PREVIEW_LINKEDIN: 'Preview-LinkedIn',
  // 发布（国内）
  CH_DOMESTIC_PUBLISH_WECHAT: '发布-公众号',
  CH_DOMESTIC_PUBLISH_XHS: '发布-小红书',
  CH_DOMESTIC_PUBLISH_VIDEO: '发布-视频号',
  CH_DOMESTIC_PUBLISH_DOUYIN: '发布-抖音',
  // 发布（海外）
  CH_OS_PUBLISH_X: 'Publish-X',
  CH_OS_PUBLISH_PH: 'Publish-PH',
  CH_OS_PUBLISH_NEWSLETTER: 'Publish-Newsletter',
};

function channelName(id) { return id ?? '(null)'; }
function pushedTo() {
  return [...new Set(pushed.filter(p => p.type === 'embed' || p.type === 'approval').map(p => p.channelId))];
}

let pass = 0, fail = 0;
function check(label, condition, detail = '') {
  if (condition) { pass++; log(`  ✅ ${label}`); }
  else { fail++; log(`  ❌ ${label} ${detail}`); }
}

async function main() {
  log('═══════════════════════════════════════════════');
  log('  频道路由完整测试');
  log('  验证：所有内容 → 正确的 Discord 频道');
  log('  重点：国内内容 → #国内总编，海外内容 → #海外总编');
  log('═══════════════════════════════════════════════\n');

  const m = new AgentManager({});
  await m.start();

  // ========== 1. 平台分类测试 ==========
  log('▶ 1. 平台分类');
  check('wechat → domestic', classifyPlatforms(['wechat']).hasDomestic && !classifyPlatforms(['wechat']).hasOverseas);
  check('x → overseas', !classifyPlatforms(['x']).hasDomestic && classifyPlatforms(['x']).hasOverseas);
  check('wechat+x → both', classifyPlatforms(['wechat', 'x']).hasDomestic && classifyPlatforms(['wechat', 'x']).hasOverseas);
  log('');

  // ========== 2. 总编频道解析 ==========
  log('▶ 2. 总编频道解析');
  const dom = getEditorialChannelsForPlatforms(['wechat', 'xiaohongshu'], ENV);
  check('国内平台 → 国内总编', dom.length === 1 && dom[0].channelId === '国内总编', JSON.stringify(dom));
  const os = getEditorialChannelsForPlatforms(['x', 'newsletter'], ENV);
  check('海外平台 → 海外总编', os.length === 1 && os[0].channelId === '海外总编', JSON.stringify(os));
  const both = getEditorialChannelsForPlatforms(['wechat', 'x'], ENV);
  check('混合平台 → 两个总编', both.length === 2, JSON.stringify(both));
  log('');

  // ========== 3. intake → 每日素材 ==========
  pushed.length = 0;
  log('▶ 3. !intake now → 应推送到 #每日素材');
  const r1 = await m.dispatch({ source: 'test', channelId: 'test', userId: 'U', text: '!intake now 测试内容 commit abc123' });
  await handleAgentResult({ result: r1, msg: mockMsg(), discord: mockDiscord, env: ENV, channels: ENV });
  check('intake → 每日素材', pushedTo().includes('每日素材'), `actual: ${pushedTo().join(',')}`);
  log('');

  // ========== 4. distill 国内平台 → 国内总编 ==========
  pushed.length = 0;
  log('▶ 4. !distill now → 国内平台 → #国内总编');
  const r2 = await m.dispatch({ source: 'test', channelId: 'test', userId: 'U', text: '!distill now' });
  await handleAgentResult({ result: r2, msg: mockMsg(), discord: mockDiscord, env: ENV, channels: ENV });
  const cntId = r2.result?.candidateId;
  const distillPlatforms = r2.result?.platforms;
  log(`  distill platforms: ${JSON.stringify(distillPlatforms)}`);
  const distillTargets = pushedTo();
  // 默认平台包含 wechat(国内) 和 x(海外)，所以应该推到两个总编
  if (distillPlatforms?.includes('wechat')) check('distill → 国内总编', distillTargets.includes('国内总编'), `actual: ${distillTargets.join(',')}`);
  if (distillPlatforms?.includes('x')) check('distill → 海外总编', distillTargets.includes('海外总编'), `actual: ${distillTargets.join(',')}`);
  log('');

  // ========== 5. render 单平台 → 对应预览频道 ==========
  pushed.length = 0;
  log('▶ 5. !render platform=wechat → #预览-公众号');
  const r3 = await m.dispatch({ source: 'test', channelId: 'test', userId: 'U', text: `!render platform=wechat --cnt=${cntId}` });
  await handleAgentResult({ result: r3, msg: mockMsg(), discord: mockDiscord, env: ENV, channels: ENV });
  check('render wechat → 预览-公众号', pushedTo().includes('预览-公众号'), `actual: ${pushedTo().join(',')}`);
  const wechatRnd = r3.result?.renderId;
  log('');

  pushed.length = 0;
  log('▶ 5b. !render platform=x → #Preview-X');
  const r3b = await m.dispatch({ source: 'test', channelId: 'test', userId: 'U', text: `!render platform=x --cnt=${cntId}` });
  await handleAgentResult({ result: r3b, msg: mockMsg(), discord: mockDiscord, env: ENV, channels: ENV });
  check('render x → Preview-X', pushedTo().includes('Preview-X'), `actual: ${pushedTo().join(',')}`);
  log('');

  // ========== 6. auto-render → 两个总编 ==========
  pushed.length = 0;
  log('▶ 6. !auto-render → #国内总编 + #海外总编');
  const r4 = await m.dispatch({ source: 'test', channelId: 'test', userId: 'U', text: `!auto-render ${cntId}` });
  await handleAgentResult({ result: r4, msg: mockMsg(), discord: mockDiscord, env: ENV, channels: ENV });
  const autoTargets = pushedTo();
  check('auto-render → 国内总编', autoTargets.includes('国内总编'), `actual: ${autoTargets.join(',')}`);
  check('auto-render → 海外总编', autoTargets.includes('海外总编'), `actual: ${autoTargets.join(',')}`);
  const allRenderIds = r4.result?.renderIds ?? [];
  log(`  rendered: ${r4.result?.rendered}/${r4.result?.total} · ids: ${JSON.stringify(allRenderIds)}`);
  log('');

  // ========== 7. deliver → 对应预览频道（embed + 文本 + HTML）==========
  pushed.length = 0;
  log('▶ 7. !deliver <rnd> → 预览频道（embed + 文本 + HTML 附件）');
  for (const rndId of allRenderIds) {
    await deliverToDiscord({ rndId, discord: mockDiscord, env: ENV });
  }
  // 验证每个渲染都推到了正确的预览频道
  const deliverChannels = [...new Set(pushed.map(p => p.channelId))];
  log(`  deliver pushed to: ${deliverChannels.join(', ')}`);
  check('deliver 有 embed', pushed.some(p => p.type === 'embed'));
  check('deliver 有 text (可复制文本)', pushed.some(p => p.type === 'text'));
  check('deliver 有 file (HTML 附件)', pushed.some(p => p.type === 'file'));
  // 验证 wechat → 预览-公众号, x → Preview-X, newsletter → Preview-Newsletter
  if (r4.result?.results) {
    for (const res of r4.result.results) {
      if (res.ok) {
        const expected = ENV[{
          wechat: 'CH_DOMESTIC_PREVIEW_WECHAT',
          xiaohongshu: 'CH_DOMESTIC_PREVIEW_XHS',
          x: 'CH_OS_PREVIEW_X',
          newsletter: 'CH_OS_PREVIEW_NEWSLETTER',
        }[res.platform]];
        check(`deliver ${res.platform} → ${expected}`, deliverChannels.includes(expected), `expected: ${expected}`);
      }
    }
  }
  log('');

  // ========== 8. publish → 发布频道（需审批）==========
  pushed.length = 0;
  log('▶ 8. !publish platform=wechat → 审批 → #发布-公众号');
  const r5 = await m.dispatch({ source: 'test', channelId: 'test', userId: 'U', text: `!publish platform=wechat --rnd=${wechatRnd}` });
  check('publish → NEED_APPROVAL', r5.status === 'NEED_APPROVAL');
  if (r5.status === 'NEED_APPROVAL') {
    await handleAgentResult({ result: r5, msg: mockMsg(), discord: mockDiscord, env: ENV, channels: ENV });
    check('审批卡 → 审批中心', pushedTo().includes('审批中心'), `actual: ${pushedTo().join(',')}`);
    // 批准后重新 publish
    await m.dispatch({ source: 'test', channelId: 'test', userId: 'U', text: `!approve ${r5.approvalId}` });
    pushed.length = 0;
    const r5b = await m.dispatch({ source: 'test', channelId: 'test', userId: 'U', text: `!publish platform=wechat --rnd=${wechatRnd}` });
    await handleAgentResult({ result: r5b, msg: mockMsg(), discord: mockDiscord, env: ENV, channels: ENV });
    check('publish wechat → 发布-公众号', pushedTo().includes('发布-公众号'), `actual: ${pushedTo().join(',')}`);
  }
  log('');

  // ========== 9. qa → Agent状态 ==========
  pushed.length = 0;
  log('▶ 9. !qa last → #Agent状态');
  const r6 = await m.dispatch({ source: 'test', channelId: 'test', userId: 'U', text: '!qa last' });
  if (r6.status === 'OK') {
    await handleAgentResult({ result: r6, msg: mockMsg(), discord: mockDiscord, env: ENV, channels: ENV });
    check('qa → Agent状态', pushedTo().includes('Agent状态'), `actual: ${pushedTo().join(',')}`);
  }
  log('');

  // ========== 10. resolveContentTargets 单元测试 ==========
  log('▶ 10. resolveContentTargets 单元测试');
  const t1 = resolveContentTargets('distill', { result: { platforms: ['wechat'] } }, ENV);
  check('distill wechat → 国内总编', t1.some(t => t.channelId === '国内总编'));
  const t2 = resolveContentTargets('distill', { result: { platforms: ['x'] } }, ENV);
  check('distill x → 海外总编', t2.some(t => t.channelId === '海外总编'));
  const t3 = resolveContentTargets('renderer', { result: { platform: 'x' } }, ENV);
  check('render x → Preview-X', t3.some(t => t.channelId === 'Preview-X'));
  const t4 = resolveContentTargets('publisher', { result: { platform: 'wechat' } }, ENV);
  check('publish wechat → 发布-公众号', t4.some(t => t.channelId === '发布-公众号'));
  const t5 = resolveContentTargets('renderer', { result: { renderIds: ['R1'], platforms: ['wechat', 'x'] } }, ENV);
  check('auto-render → 两个总编', t5.length === 2 && t5.some(t => t.channelId === '国内总编') && t5.some(t => t.channelId === '海外总编'));
  log('');

  // ========== 总结 ==========
  log('═══════════════════════════════════════════════');
  log(`  结果: ${pass} passed · ${fail} failed`);
  if (fail === 0) log('  ✅ 频道路由全部测试通过');
  else log('  ❌ 有测试失败，请检查');
  log('═══════════════════════════════════════════════\n');

  await m.shutdown();
  process.exit(fail > 0 ? 1 : 0);
}

function mockMsg() {
  return {
    channelId: 'test',
    reply: async () => {},
  };
}

main().catch((e) => { console.error(e); process.exit(1); });
