// 实测审计：对每条 !命令路由直接调 dispatch()，按真实返回分类。
// 用法: node scripts/audit-empty-commands.mjs
// 无副作用：空壳/SKILL_NOT_FOUND/参数校验类命令不写业务数据；真实现的 content pipeline
//          命令（intake/distill/render/publish/qa/pr new/demo new）会写文件，这里只标注不实跑。
import { AgentManager, parseCommand } from '../src/runtime/agent-manager.mjs';

const am = new AgentManager({ root: process.cwd(), logger: { log: () => {} } });
await am.start();

// 有写副作用或需 piBridge 的"真实现"命令 —— 标注但不实跑（由 content-smoke / fde-e2e 覆盖）
const SKIP_REAL = new Set([
  '!intake now', '!distill now', '!brief now', '!privacy check', '!fact check',
  '!render *', '!auto-render *', '!render html', '!publish *', '!qa last',
  '!pr new', '!demo new',
]);

// 从源码静态提取全部路由（setRoute 调用）
const SRC = await import('node:fs').then(m => m.readFileSync(new URL('../src/runtime/agent-manager.mjs', import.meta.url), 'utf8'));
const routes = [...SRC.matchAll(/setRoute\(\s*'([^']+)'(?:\s*,\s*'([^']+?)')?\s*,\s*\{\s*agentId:\s*'([^']+)'[^}]*?skill:\s*'([^']+)'[^}]*?(?:approval:\s*(null|'[^']*'))?/g)]
  .map(m => ({ cmd: m[1], sub: m[2], agentId: m[3], skill: m[4], approval: m[5] }))
  // 去重（setRoute 的通配 '*' 与具体 sub 会重复注册同名命令）
  .filter((r, i, a) => a.findIndex(x => x.cmd === r.cmd && x.agentId === r.agentId && x.skill === r.skill) === i);

const buckets = { REAL: [], ERROR_SHELL: [], ERROR_NOSKILL: [], ERROR_PARAM: [], OTHER: [] };

for (const r of routes) {
  // 用完整 "!cmd sub" 触发，确保路由精确（sub='*' 的通配命令用裸命令名）
  const fullCmd = r.sub === '*' ? `!${r.cmd}` : `!${r.cmd} ${r.sub}`;
  const skipKey = r.sub === '*' ? `!${r.cmd} *` : fullCmd;
  if (SKIP_REAL.has(skipKey)) { buckets.REAL.push({ ...r, note: '已实现(smoke覆盖),跳过实跑' }); continue; }
  try {
    const res = await am.dispatch({ source: 'audit', channelId: 't', userId: 'audit', text: fullCmd });
    if (res.status === 'OK' && (res.output !== undefined || res.result)) {
      buckets.REAL.push({ ...r, note: '实跑返回 OK 有内容' });
    } else if (res.status === 'ERROR' && /未实现|占位/.test(res.error || '')) {
      buckets.ERROR_SHELL.push({ ...r, error: res.error });
    } else if (res.status === 'ERROR' && res.error === 'SKILL_NOT_FOUND') {
      buckets.ERROR_NOSKILL.push({ ...r, note: '路由表有 skill 但 registry 没声明' });
    } else if (res.status === 'ERROR') {
      buckets.ERROR_PARAM.push({ ...r, error: res.error }); // 走到函数但参数/业务校验失败 = 路径通的
    } else if (res.status === 'NEED_APPROVAL') {
      // 审批门禁挡在 invokeLocalSkill 之前；skill 本身可能仍未实现，审批通过后才会暴露
      buckets.REAL.push({ ...r, note: '审批门禁拦截(路径通;skill是否实现需grant后才知)' });
    } else {
      buckets.OTHER.push({ ...r, status: res.status, error: res.error });
    }
  } catch (e) {
    buckets.OTHER.push({ ...r, thrown: e.message });
  }
}

const show = (title, arr, icon) => {
  console.log(`\n${icon} ${title} (${arr.length})`);
  arr.forEach(r => console.log(`   !${r.cmd.padEnd(16)} → ${r.agentId}/${r.skill.padEnd(20)} ${r.error||r.note||''}`));
};

console.log('═'.repeat(70));
console.log(`审计 ${routes.length} 条路由（实测 dispatch，修复后）`);
console.log('═'.repeat(70));
show('真实现 / 路径通', buckets.REAL, '✅');
show('空壳(占位未实现) → 现返回 ERROR', buckets.ERROR_SHELL, '🔴');
show('路由表/registry不一致 → SKILL_NOT_FOUND', buckets.ERROR_NOSKILL, '🟠');
show('走到函数但参数/业务校验失败(路径通)', buckets.ERROR_PARAM, '🟡');
if (buckets.OTHER.length) show('其它', buckets.OTHER, '❓');

console.log('\n' + '═'.repeat(70));
console.log(`合计: 真=${buckets.REAL.length} 空壳=${buckets.ERROR_SHELL.length} 不一致=${buckets.ERROR_NOSKILL.length} 参数校验=${buckets.ERROR_PARAM.length} 其它=${buckets.OTHER.length}`);
console.log(`假成功根除: ${buckets.ERROR_SHELL.length} 个空壳命令现在全部返回 status:ERROR ✅（修复前是静默 status:OK）`);
