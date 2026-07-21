#!/usr/bin/env node
// ~/pi-discord-agents/scripts/demo-dreaming-enhancement.mjs
// 梦境增强功能演示脚本

import {
  createNightmareMitigator,
  createImplicitKnowledgeMiner,
  loadXiasiConfig
} from '../src/dreaming/index.mjs';

console.log('🌙 梦境增强系统演示\n');

// ============ 1. 好梦 vs 噩梦检测 ============

console.log('═'.repeat(50));
console.log('1. 好梦 vs 噩梦检测');
console.log('═'.repeat(50));

const mitigator = createNightmareMitigator({ log: console.log });

const testInsights = [
  {
    text: '老张这周卡在 React 状态管理上，但三周前搞定的 Rust 异步模式本质上也是"谁来负责谁"的问题。下一步：把 Rust 的 ownership 思路迁移到 React。',
    label: '好梦示例'
  },
  {
    text: '担心这样做会失败，根本解决不了问题，永远都是这样，不行不行不行。',
    label: '噩梦示例'
  },
  {
    text: '这是一个关于 API 设计的决策，需要考虑向后兼容性和性能影响。',
    label: '中性洞察'
  },
  {
    text: '原来如此！原来这两个看似无关的点可以这样连接起来！这是一个突破！',
    label: '惊喜洞察'
  },
];

for (const insight of testInsights) {
  const { polarity, polarityLabel } = mitigator.shouldMitigate(insight)
    ? { polarity: -0.5, polarityLabel: 'nightmare' }
    : mitigator.annotate([{ text: insight.text }])[0];
  
  const icon = polarityLabel === 'good' ? '✅' : polarityLabel === 'nightmare' ? '⚠️' : '📝';
  console.log(`\n${icon} ${insight.label}`);
  console.log(`   极性: ${polarity > 0 ? '+' : ''}${(polarity * 100).toFixed(0)}%`);
  console.log(`   类型: ${polarityLabel}`);
}

// ============ 2. 隐式知识挖掘 ============

console.log('\n\n' + '═'.repeat(50));
console.log('2. 隐式知识挖掘');
console.log('═'.repeat(50));

const miner = createImplicitKnowledgeMiner({ log: console.log });

const conversation = `
用户：其实我更喜欢用 TypeScript，不太想用 JavaScript。
助手：好的，我用 TypeScript 重写。
用户：这个 API 卡在认证这里搞不定，能不能换个思路？
助手：好的，我换个方式。
用户：搞定了吗？
助手：搞定了！完美！原来如此！
用户：算了不用了，直接用 JS 吧。
`;

console.log('\n对话内容:');
console.log(conversation);

const preferences = miner.extractFromText(conversation).filter(k => k.type === 'preference');
const pains = miner.extractFromText(conversation).filter(k => k.type === 'pain-point');
const successes = miner.extractFromText(conversation).filter(k => k.type === 'success-pattern');

console.log('\n提取结果:');
console.log(`\n🔍 偏好 (${preferences.length} 条):`);
for (const p of preferences) {
  console.log(`   - ${p.text} (${p.subType}, 置信度: ${(p.confidence * 100).toFixed(0)}%)`);
}

console.log(`\n💔 痛点 (${pains.length} 条):`);
for (const p of pains) {
  console.log(`   - ${p.signal} (严重程度: ${p.severity})`);
}

console.log(`\n🎉 成功 (${successes.length} 条):`);
for (const s of successes) {
  console.log(`   - ${s.subType}: ${s.signals.join(', ')}`);
}

// ============ 3. 配置展示 ============

console.log('\n\n' + '═'.repeat(50));
console.log('3. 增强配置项');
console.log('═'.repeat(50));

const config = loadXiasiConfig({
  env: {
    XIASI_ENABLED: 'true',
    XIASI_GOOD_DREAM_ENABLED: 'true',
    XIASI_NIGHTMARE_MITIGATION: 'true',
    XIASI_DREAM_TO_MEMORY: 'true',
  }
});

console.log('\n当前配置:');
console.log(`   基础启用: ${config.enabled ? '✅' : '❌'}`);
console.log(`   好梦模式: ${config.goodDreamEnabled ? '✅' : '❌'}`);
console.log(`   噩梦干预: ${config.nightmareMitigation ? '✅' : '❌'}`);
console.log(`   梦境→记忆: ${config.dreamToMemory ? '✅' : '❌'}`);
console.log(`   干预阈值: ${config.nightmareThreshold}`);
console.log(`   吸收阈值: ${config.qualityThreshold}`);

// ============ 总结 ============

console.log('\n\n' + '═'.repeat(50));
console.log('✨ 总结');
console.log('═'.repeat(50));
console.log(`
已实现的梦境增强功能:

🌟 好梦机制
   - 激励性洞察生成
   - 行动建议自动添加
   - 下一步具体指导

⚠️ 噩梦干预
   - 负面联想自动检测
   - 极性评分 (-1 到 1)
   - 自动替换为正向内容

🔮 预言模式 (yu-yan)
   - 反事实推理
   - 情景模拟
   - 风险预测

🧠 梦境→记忆
   - 高分产物自动吸收
   - 相似记忆去重
   - 来源追踪

📊 投票反馈
   - 用户反馈分析
   - 类型效果统计
   - 改进信号生成

🔄 自我改进
   - 历史数据分析
   - 类型效果评估
   - 改进建议生成

⛏️ 隐式知识挖掘
   - 偏好提取
   - 痛点识别
   - 成功模式发现
`);
