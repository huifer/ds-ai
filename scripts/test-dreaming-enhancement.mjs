#!/usr/bin/env node
// ~/pi-discord-agents/scripts/test-dreaming-enhancement.mjs
// 梦境增强系统测试脚本

import { createNightmareMitigator, createDreamToMemory, createVoteFeedback, createDreamSelfImprover, createImplicitKnowledgeMiner } from '../src/dreaming/index.mjs';

console.log('🌙 梦境增强系统测试\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ============ 噩梦干预测试 ============

test('噩梦干预 - 极性计算', () => {
  const mitigator = createNightmareMitigator({ log: () => {} });
  
  const good = mitigator.shouldMitigate({ text: '这个想法很有创意！下一步：试试看。' });
  assert(!good, '好文本不应触发干预');
  
  const bad = mitigator.shouldMitigate({ text: '担心会失败，根本不行，扛不住了！' });
  assert(bad, '坏文本应该触发干预');
});

test('噩梦干预 - 批量处理', () => {
  const mitigator = createNightmareMitigator({ log: () => {} });
  
  const artifacts = [
    { text: '好消息！可以做！' },
    { text: '担心失败...扛不住...' },
    { text: '这是一个技术问题。' },
  ];
  
  const result = mitigator.process(artifacts);
  assert(result.needsIntervention, '应该检测到需要干预');
  assert(result.passed.length === 2, '应该保留 2 条通过');
});

test('噩梦干预 - 统计', () => {
  const mitigator = createNightmareMitigator({ log: () => {} });
  
  const artifacts = [
    { text: '这是一个创意！原来可以这样！下一步：试试看。' },
    { text: '担心会失败...扛不住...' },
    { text: '这是一个技术问题。' },
  ];
  
  const stats = mitigator.getStats(artifacts);
  assert(stats.total === 3, '应该有 3 条');
  assert(stats.good >= 1, '应该有至少 1 条好');
  assert(stats.nightmare >= 1, '应该有至少 1 条噩梦');
});

// ============ 隐式知识挖掘测试 ============

test('隐式知识挖掘 - 偏好提取', () => {
  const miner = createImplicitKnowledgeMiner({ log: () => {} });
  
  const text = '其实我更喜欢用 TypeScript，不太想用 JavaScript。';
  const prefs = miner.extractFromText(text).filter(k => k.type === 'preference');
  assert(prefs.length >= 1, '应该提取到偏好');
});

test('隐式知识挖掘 - 痛点提取', () => {
  const miner = createImplicitKnowledgeMiner({ log: () => {} });
  
  const text = '这个 API 卡在认证这里搞不定，能不能换个思路？';
  const pains = miner.extractFromText(text).filter(k => k.type === 'pain-point');
  assert(pains.length >= 1, '应该提取到痛点');
  assert(pains[0].severity === 'high' || pains[0].severity === 'medium', '应该有严重级别');
});

test('隐式知识挖掘 - 成功模式', () => {
  const miner = createImplicitKnowledgeMiner({ log: () => {} });
  
  const text = '搞定了吗？完美！原来如此！';
  const successes = miner.extractFromText(text).filter(k => k.type === 'success-pattern');
  assert(successes.length >= 1, '应该提取到成功模式');
});

test('隐式知识挖掘 - 聚类', () => {
  const miner = createImplicitKnowledgeMiner({ log: () => {} });
  
  const knowledge = [
    { type: 'preference', subType: 'explicit', text: '喜欢A' },
    { type: 'preference', subType: 'explicit', text: '喜欢B' },
    { type: 'pain-point', subType: 'stuck', text: '卡住' },
  ];
  
  const clustered = miner.cluster(knowledge);
  assert(clustered.length <= 3, '聚类后数量应该减少或不变');
});

// ============ 配置测试 ============

test('配置加载 - 新增配置项', async () => {
  const { loadXiasiConfig } = await import('../src/dreaming/config.mjs');
  
  const config = loadXiasiConfig({
    env: {
      XIASI_GOOD_DREAM_ENABLED: 'true',
      XIASI_NIGHTMARE_MITIGATION: 'true',
      XIASI_DREAM_TO_MEMORY: 'true',
      XIASI_SELF_IMPROVE: 'true',
    }
  });
  
  assert(config.goodDreamEnabled === true, '好梦模式应该启用');
  assert(config.nightmareMitigation === true, '噩梦干预应该启用');
  assert(config.dreamToMemory === true, '梦境→记忆应该启用');
  assert(config.selfImprove === true, '自我改进应该启用');
});

// ============ yu-yan 测试 ============

test('yu-yan - 模块加载', async () => {
  const yuYan = await import('../src/dreaming/phases/yu-yan.mjs');
  assert(typeof yuYan.run === 'function', 'yu-yan run 应该是函数');
});

// ============ 结果汇总 ============

console.log('\n' + '═'.repeat(40));
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n🌟 所有测试通过！梦境增强系统已就绪。');
  console.log('\n下一步:');
  console.log('1. 在 .env 中启用增强功能');
  console.log('2. 设置 XIASI_GOOD_DREAM_ENABLED=true 启用好梦');
  console.log('3. 设置 XIASI_DREAM_TO_MEMORY=true 启用自动吸收');
  console.log('4. 重启 entry-bot');
}
