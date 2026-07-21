// scripts/pi-bridge-smoke.mjs
// 测试 PiBridge LLM 增强路径
// 用 mock RpcClient 模拟 Pi Agent 响应，验证：
// 1. distillRun 用 LLM 评分 + 标题
// 2. factCheck 用 LLM 声明分析
// 3. renderPlatform 用 LLM 生成 HTML

import { AgentManager } from '../src/runtime/agent-manager.mjs';
import { PiBridge } from '../src/runtime/pi-bridge.mjs';

// ===== Mock RPC Client =====
let _lastPrompt = '';
const mockRpcClient = {
  promptAndWait: async (message) => {
    _lastPrompt = message;
    return []; // events array (empty — we use getLastAssistantText)
  },
  getLastAssistantText: async () => {
    if (_lastPrompt.includes('内容蒸馏')) {
      return JSON.stringify({
        title: '用 AI Agent 重塑企业客服体验',
        scores: {
          authenticity: 5, evidence: 4, 'audience-value': 5, novelty: 4,
          'brand-fit': 5, virality: 4, reusability: 5, 'privacy-safety': 4,
        },
        brief: '一个真实客户从需求到 Demo 的 AI 客服 Agent 开发过程',
        platforms: ['wechat', 'xiaohongshu', 'video-account'],
      });
    }
    if (_lastPrompt.includes('事实核查')) {
      return JSON.stringify({
        claims: [
          { claim: '用 React+TS+Vite 做了 AI 客服', hasEvidence: true, evidenceTypes: ['commit-hash'], suggestion: '' },
          { claim: '客户反馈积极', hasEvidence: false, evidenceTypes: [], suggestion: '补充客户原话或评分数据' },
          { claim: '部署在 GitHub', hasEvidence: true, evidenceTypes: ['url'], suggestion: '' },
        ],
        summary: '2/3 声明有证据支持，建议补充客户反馈数据',
        passed: true,
      });
    }
    if (_lastPrompt.includes('渲染') || _lastPrompt.includes('Markdown')) {
      return '# 用 AI Agent 重塑企业客服体验\n\n> Zenbuild · Build with intention\n\n---\n\n这是 LLM 生成的 Markdown 正文。\n\n## 技术实现\n\n- React + TypeScript + Vite\n- TanStack Query 数据层\n- shadcn/ui 组件库\n\n---\n\n© 2026 杭州 OPC 张三 · All rights reserved';
    }
    return '';
  },
};

async function main() {
  const log = (...a) => console.log(...a);
  const piBridge = new PiBridge({ rpcClient: mockRpcClient, log });
  console.log('piBridge.available:', piBridge.available);

  const m = new AgentManager({ piBridge });
  await m.start();

  console.log('\n═══════════════════════════════════════════════');
  console.log('  PiBridge LLM 增强测试');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Intake（不走 LLM）
  const r1 = await m.dispatch({
    source: 'test', channelId: 'CH_TEST', userId: 'U-1',
    text: '!intake now 用 React+TS+Vite 做了 AI 客服 Agent，commit abc1234 部署在 https://github.com/huifer/demo 客户反馈积极',
  });
  console.log('▶ !intake now =>', r1.status, r1.result?.materialId);
  const matId = r1.result?.materialId;

  // 2. Distill with LLM
  const r2 = await m.dispatch({
    source: 'test', channelId: 'CH_TEST', userId: 'U-1',
    text: `!distill now --mat=${matId}`,
  });
  console.log('\n▶ !distill now (LLM enhanced)');
  console.log('  status:', r2.status);
  console.log('  llmEnhanced:', r2.result?.llmEnhanced);
  console.log('  title:', r2.result?.card?.description?.split('\n')[0]);
  console.log('  score:', r2.result?.score, '/40');
  console.log('  verdict:', r2.result?.verdict);
  const cntId = r2.result?.candidateId;

  // 验证 candidate artifact 中存储了 LLM 数据
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const candFile = resolve('data/content/candidates', `${cntId}.json`);
  const cand = JSON.parse(readFileSync(candFile, 'utf8'));
  console.log('  stored title:', cand.title);
  console.log('  stored brief:', cand.brief);
  console.log('  stored llmEnhanced:', cand.llmEnhanced);
  console.log('  stored platforms:', JSON.stringify(cand.platforms));

  // 3. Fact check with LLM
  const r3 = await m.dispatch({
    source: 'test', channelId: 'CH_TEST', userId: 'U-1',
    text: `!fact check --cnt=${cntId}`,
  });
  console.log('\n▶ !fact check (LLM enhanced)');
  console.log('  status:', r3.status);
  console.log('  llmEnhanced:', r3.result?.llmEnhanced);
  console.log('  totalClaims:', r3.result?.totalClaims);
  console.log('  supported:', r3.result?.supported);
  console.log('  passed:', r3.result?.passed);

  // 4. Render with LLM
  const r4 = await m.dispatch({
    source: 'test', channelId: 'CH_TEST', userId: 'U-1',
    text: `!render platform=wechat --cnt=${cntId}`,
  });
  console.log('\n▶ !render platform=wechat (LLM enhanced)');
  console.log('  status:', r4.status);
  console.log('  llmEnhanced:', r4.result?.llmEnhanced);
  console.log('  bytes:', r4.result?.bytes);
  console.log('  has LLM title:', r4.result?.card?.title?.includes('🤖'));

  // 验证 Markdown 文件
  const mdFile = resolve('data/content/renders', `${r4.result?.renderId}.md`);
  const md = readFileSync(mdFile, 'utf8');
  console.log('  MD has heading:', md.includes('# '));
  console.log('  MD has copyright:', md.includes('©'));

  console.log('\n═══════════════════════════════════════════════');
  console.log('  PiBridge LLM 增强验证完成');
  console.log(`  piBridge.stats: ${JSON.stringify(piBridge.stats)}`);
  console.log('═══════════════════════════════════════════════\n');

  await m.shutdown();
}

main().catch(console.error);
