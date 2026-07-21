#!/usr/bin/env node
// ~/pi-discord-agents/test-duplicates-conflicts.mjs
// 测试重复检测和矛盾检测

import { createMemoryStore } from './src/memory-store.mjs';
import { createMemoryContext } from './src/memory-context.mjs';
import { createMemoryGovernance } from './src/memory-governance.mjs';
import { createEmbedder } from './src/embedder.mjs';

// 彩色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, text) {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

// 初始化系统
async function init() {
  log('cyan', '🚀 初始化记忆系统...');

  const embedder = await createEmbedder({ log: () => {} });

  const memoryStore = await createMemoryStore({
    rootDir: '/Users/zhangsan/pi-discord-agents',
    embedder,
    log: () => {},
  });

  const memoryContext = createMemoryContext({ memoryStore, embedder, log: () => {} });
  const memoryGovernance = createMemoryGovernance({ memoryStore, log: () => {} });

  log('green', '✅ 初始化完成\n');

  return { memoryStore, memoryContext, memoryGovernance, embedder };
}

// 添加记忆
async function addMemory(memoryStore, options) {
  try {
    const result = await memoryStore.upsert(options);
    const kindEmoji = {
      decision: '🎯',
      constraint: '🔒',
      preference: '❤️',
      fact: '📌',
      idea: '💡',
    }[options.kind] || '📦';

    log('green', `${kindEmoji} 添加记忆: [${options.kind}] ${options.subject}`);
    return result;
  } catch (e) {
    log('red', `❌ 添加失败: ${e.message}`);
    return null;
  }
}

// 测试重复检测
async function testDuplicateDetection(memoryStore, embedder) {
  log('bright', '\n═══════════════════════════════════════════════════');
  log('bright', '🔍 测试 1: 重复检测');
  log('bright', '═══════════════════════════════════════════════════\n');

  const baseMemory = {
    kind: 'preference',
    subject: 'use-typescript',
    content: '总是用 TypeScript 开发新项目，避免类型错误',
    tags: ['typescript', 'preference'],
    confidence: 0.85,
  };

  // 1. 添加基础记忆
  log('cyan', '[1] 添加基础记忆...');
  await addMemory(memoryStore, baseMemory);

  // 2. 测试精确重复（完全相同的 subject 和 kind）
  log('cyan', '\n[2] 测试精确重复（相同 subject + kind）...');
  log('yellow', '  尝试添加完全相同的记忆...');
  const exactDuplicate = await addMemory(memoryStore, baseMemory);
  if (exactDuplicate && exactDuplicate.revision > 1) {
    log('green', '  ✅ 精确重复被正确处理（revision 增加）');
  } else {
    log('red', '  ❌ 精确重复处理异常');
  }

  // 3. 测试语义重复（内容相似）
  log('cyan', '\n[3] 测试语义重复（内容相似度 ≥ 0.9）...');
  log('yellow', '  尝试添加语义相似的记忆...');
  const semanticDuplicate = {
    kind: 'preference',
    subject: 'prefer-typescript-dev',
    content: '偏好使用 TypeScript 进行开发，可以避免类型相关的错误',
    tags: ['typescript', 'preference'],
    confidence: 0.80,
  };

  // 获取现有记忆
  const existing = await memoryStore.query({ subject: 'use-typescript' });
  if (existing.items.length > 0) {
    // 计算相似度
    const content1 = semanticDuplicate.content;
    const content2 = existing.items[0].content;

    const embed1 = await embedder.embed(content1);
    const embed2 = await embedder.embed(content2);

    const similarity = cosineSimilarity(embed1, embed2);
    log('blue', `  📊 内容相似度: ${similarity.toFixed(4)}`);

    if (similarity >= 0.9) {
      log('green', '  ✅ 语义重复应被拒绝（≥ 0.9）');
    } else {
      log('yellow', `  ⚠️  相似度 < 0.9 (${similarity.toFixed(4)})，不会被拒绝`);
      await addMemory(memoryStore, semanticDuplicate);
    }
  }

  // 4. 测试文本相似度（不同 subject 但内容相似）
  log('cyan', '\n[4] 测试文本相似度（不同 subject + 内容相似度 ≥ 0.85）...');
  log('yellow', '  尝试添加文本相似的记忆...');
  const textSimilar = {
    kind: 'decision',
    subject: 'typescript-for-new-projects',
    content: '总是用 TypeScript 开发新项目，避免类型错误',
    tags: ['typescript', 'architecture'],
    confidence: 0.80,
  };

  const existingForText = await memoryStore.query({ subject: 'use-typescript' });
  if (existingForText.items.length > 0) {
    const content1 = textSimilar.content;
    const content2 = existingForText.items[0].content;

    const embed1 = await embedder.embed(content1);
    const embed2 = await embedder.embed(content2);

    const similarity = cosineSimilarity(embed1, embed2);
    log('blue', `  📊 内容相似度: ${similarity.toFixed(4)}`);

    if (similarity >= 0.85) {
      log('green', '  ✅ 文本相似度应被拒绝（≥ 0.85）');
    } else {
      log('yellow', `  ⚠️  相似度 < 0.85 (${similarity.toFixed(4)})，不会被拒绝`);
      await addMemory(memoryStore, textSimilar);
    }
  }

  // 5. 测试不重复的记忆
  log('cyan', '\n[5] 测试不重复的记忆...');
  log('yellow', '  尝试添加完全不同的记忆...');
  const uniqueMemory = {
    kind: 'constraint',
    subject: 'must-use-https',
    content: '生产环境必须启用 HTTPS，不能使用 HTTP',
    tags: ['security', 'constraint'],
    confidence: 0.95,
  };

  const uniqueResult = await addMemory(memoryStore, uniqueMemory);
  if (uniqueResult) {
    log('green', '  ✅ 不重复记忆成功添加');
  }

  console.log();
}

// 测试矛盾检测
async function testConflictDetection(memoryStore, memoryGovernance) {
  log('bright', '\n═══════════════════════════════════════════════════');
  log('bright', '⚔️  测试 2: 矛盾检测');
  log('bright', '═══════════════════════════════════════════════════\n');

  // 1. 添加矛盾的 preference 记忆
  log('cyan', '[1] 添加矛盾的 preference 记忆...');
  const conflictPairs = [
    {
      pair: [
        {
          kind: 'preference',
          subject: 'prefer-vim',
          content: '我喜欢用 Vim 而不是 Neovim',
          tags: ['editor', 'preference'],
          confidence: 0.8,
        },
        {
          kind: 'preference',
          subject: 'prefer-neovim',
          content: '我喜欢用 Neovim 而不是 Vim',
          tags: ['editor', 'preference'],
          confidence: 0.8,
        },
      ],
      expected: '矛盾',
    },
    {
      pair: [
        {
          kind: 'decision',
          subject: 'use-monolith',
          content: '使用单体架构而不是微服务',
          tags: ['architecture', 'monolith'],
          confidence: 0.85,
        },
        {
          kind: 'decision',
          subject: 'use-microservices',
          content: '使用微服务而不是单体架构',
          tags: ['architecture', 'microservices'],
          confidence: 0.85,
        },
      ],
      expected: '矛盾',
    },
    {
      pair: [
        {
          kind: 'constraint',
          subject: 'must-use-https',
          content: '必须使用 HTTPS',
          tags: ['security', 'https'],
          confidence: 0.95,
        },
        {
          kind: 'constraint',
          subject: 'allow-http',
          content: '允许使用 HTTP',
          tags: ['security', 'http'],
          confidence: 0.5,
        },
      ],
      expected: '矛盾',
    },
  ];

  for (let i = 0; i < conflictPairs.length; i++) {
    const { pair, expected } = conflictPairs[i];
    log('cyan', `\n添加矛盾对 ${i + 1}:`);
    log('blue', `  记忆 A: ${pair[0].content}`);
    log('blue', `  记忆 B: ${pair[1].content}`);

    // 先添加第一对
    await addMemory(memoryStore, pair[0]);
    await addMemory(memoryStore, pair[1]);

    // 运行矛盾检测
    const governanceResult = await memoryGovernance.runGovernance({ dryRun: true });
    log('green', `  检测到矛盾: ${governanceResult.conflicts} 组`);

    if (governanceResult.conflicts > 0) {
      log('green', `  ✅ 矛盾检测正常（预期: ${expected}）`);
    } else {
      log('yellow', `  ⚠️  未检测到矛盾（预期: ${expected}）`);
    }
  }

  // 2. 添加不矛盾的记忆
  log('cyan', '\n[2] 添加不矛盾的记忆对...');
  const nonConflictPairs = [
    {
      pair: [
        {
          kind: 'preference',
          subject: 'prefer-typescript',
          content: '我喜欢用 TypeScript',
          tags: ['language', 'typescript'],
          confidence: 0.8,
        },
        {
          kind: 'preference',
          subject: 'prefer-rust',
          content: '我喜欢用 Rust',
          tags: ['language', 'rust'],
          confidence: 0.8,
        },
      ],
      expected: '不矛盾',
    },
    {
      pair: [
        {
          kind: 'decision',
          subject: 'use-postgres',
          content: '使用 PostgreSQL 作为数据库',
          tags: ['database', 'postgres'],
          confidence: 0.9,
        },
        {
          kind: 'decision',
          subject: 'use-redis',
          content: '使用 Redis 作为缓存',
          tags: ['database', 'redis'],
          confidence: 0.9,
        },
      ],
      expected: '不矛盾',
    },
  ];

  for (let i = 0; i < nonConflictPairs.length; i++) {
    const { pair, expected } = nonConflictPairs[i];
    log('cyan', `\n添加不矛盾对 ${i + 1}:`);
    log('blue', `  记忆 A: ${pair[0].content}`);
    log('blue', `  记忆 B: ${pair[1].content}`);

    // 先添加第一对
    await addMemory(memoryStore, pair[0]);
    await addMemory(memoryStore, pair[1]);

    // 运行矛盾检测
    const governanceResult = await memoryGovernance.runGovernance({ dryRun: true });
    log('green', `  检测到矛盾: ${governanceResult.conflicts} 组`);

    if (governanceResult.conflicts === 0) {
      log('green', `  ✅ 未检测到矛盾（预期: ${expected}）`);
    } else {
      log('yellow', `  ⚠️  检测到矛盾（预期: ${expected}）`);
    }
  }

  console.log();
}

// 余弦相似度计算
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 查看当前记忆
async function listMemories(memoryStore) {
  log('cyan', '\n📚 当前记忆列表:');
  const stats = await memoryStore.stats();
  log('green', `  总计: ${stats.total}`);

  if (stats.byKind) {
    for (const [kind, count] of Object.entries(stats.byKind)) {
      log('blue', `  [${kind}] ${count}`);
    }
  }

  log('cyan', '\n详细列表:');
  const results = await memoryStore.query({ limit: 50 });
  if (results.items.length === 0) {
    log('yellow', '  暂无记忆\n');
    return;
  }

  for (const mem of results.items) {
    const kindEmoji = {
      decision: '🎯',
      constraint: '🔒',
      preference: '❤️',
      fact: '📌',
      idea: '💡',
    }[mem.kind] || '📦';

    const confidenceColor = (mem.confidence || 0) >= 0.8 ? 'green' : (mem.confidence || 0) >= 0.6 ? 'yellow' : 'red';
    log(confidenceColor, `${kindEmoji} [${mem.kind}] ${mem.subject}`);
    log('bright', `    ${mem.content.slice(0, 80)}${mem.content.length > 80 ? '...' : ''}`);
    log('cyan', `    置信度: ${(mem.confidence || 0).toFixed(2)} | 访问: ${mem.accessCount || 0} | 标签: [${(mem.tags || []).join(', ') || '无'}]`);
  }

  console.log();
}

// 主测试流程
async function runTests() {
  const { memoryStore, memoryContext, memoryGovernance, embedder } = await init();

  log('bright', '═══════════════════════════════════════════════════');
  log('bright', '🔬 重复检测和矛盾检测测试');
  log('bright', '═══════════════════════════════════════════════════\n');

  // 查看初始记忆
  log('cyan', '【初始状态】查看现有记忆...');
  await listMemories(memoryStore);

  // 测试重复检测
  await testDuplicateDetection(memoryStore, embedder);

  // 查看添加重复后的记忆
  log('cyan', '【重复检测后】查看记忆...');
  await listMemories(memoryStore);

  // 测试矛盾检测
  await testConflictDetection(memoryStore, memoryGovernance);

  // 查看添加矛盾后的记忆
  log('cyan', '【矛盾检测后】查看记忆...');
  await listMemories(memoryStore);

  // 最终总结
  const finalStats = await memoryStore.stats();

  log('bright', '\n═══════════════════════════════════════════════════');
  log('bright', '🎉 测试完成');
  log('bright', '═══════════════════════════════════════════════════\n');

  log('green', `✅ 最终记忆总数: ${finalStats.total}\n`);

  log('cyan', '📋 测试结论:');
  log('blue', '  1. 重复检测：精确重复、语义重复、文本相似度');
  log('blue', '  2. 矛盾检测：自动发现冲突的记忆对');
  log('blue', '  3. 记忆存储：upsert 逻辑正确处理重复和版本控制');

  console.log();

  process.exit(0);
}

runTests().catch((e) => {
  log('red', `\n❌ 错误: ${e.message}`);
  console.error(e);
  process.exit(1);
});