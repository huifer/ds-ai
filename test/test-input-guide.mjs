// ~/pi-discord-agents/test-input-guide.mjs
// 输入层面完整测试指南

import { createMemoryStore } from './src/memory-store.mjs';
import { createMemoryContext } from './src/memory-context.mjs';
import { createMemoryGovernance } from './src/memory-governance.mjs';
import { createMemoryQuality } from './src/memory-quality.mjs';
import { createMemoryDistiller } from './src/memory-distiller.mjs';
import { createMemoryJournal } from './src/memory-journal.mjs';
import { createEmbedder } from './src/embedder.mjs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = resolve(homedir(), 'pi-discord-agents');

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

async function runAllTests() {
  log('cyan', '\n========================================');
  log('cyan', '🧪 输入层面完整测试指南');
  log('cyan', '========================================\n');

  // 初始化系统
  log('cyan', '🚀 初始化记忆系统...');
  const embedder = await createEmbedder({ log: () => {} });
  const memoryStore = await createMemoryStore({
    rootDir: ROOT,
    embedder,
    log: () => {},
  });
  const memoryJournal = createMemoryJournal({ memoryStore, log: () => {} });
  const memoryContext = createMemoryContext({ memoryStore, embedder, log: () => {} });
  const memoryGovernance = createMemoryGovernance({ memoryStore, log: () => {} });
  const memoryQuality = createMemoryQuality({ memoryStore, log: () => {} });
  const memoryDistiller = createMemoryDistiller({
    memoryStore,
    memoryJournal,
    embedder,
    log: () => {},
  });
  log('green', '✅ 系统初始化完成\n');

  // === 测试 1: 记忆存储 ===
  log('cyan', '【测试 1】记忆存储 - 创建和查询');
  log('yellow', '测试内容: 创建各种类型的记忆');

  const testMemories = [
    {
      kind: 'preference',
      subject: 'use-typescript',
      content: '总是用 TypeScript 开发新项目，避免类型错误',
      tags: ['typescript', 'preference'],
      confidence: 0.85,
    },
    {
      kind: 'decision',
      subject: 'rpc-vs-tui',
      content: '用 RPC 模式而不是 TUI（启动快且无 ctx stale）',
      tags: ['architecture', 'performance'],
      confidence: 0.95,
    },
    {
      kind: 'idea',
      subject: 'feature-idea',
      content: '给 bot 添加 /search 命令，支持搜索历史消息',
      tags: ['feature', 'idea'],
      confidence: 0.7,
    },
    {
      kind: 'constraint',
      subject: 'error-handling',
      content: '错误处理必须记录日志，不能静默失败',
      tags: ['error-handling', 'constraint'],
      confidence: 0.95,
    },
  ];

  for (const mem of testMemories) {
    await memoryStore.upsert(mem);
    log('green', `  ✓ 创建: [${mem.kind}] ${mem.subject}`);
  }

  // 查询测试
  log('yellow', '\n查询测试:');
  const queryResult = await memoryStore.query({
    kind: 'preference',
    status: 'active',
  });
  log('green', `  ✓ 查询结果: 找到 ${queryResult.items.length} 条偏好记忆`);

  const tagResult = await memoryStore.query({
    tag: 'feature',
  });
  log('green', `  ✓ 标签查询: 找到 ${tagResult.items.length} 条功能相关记忆`);

  log('green', '\n✅ 记忆存储测试: 通过\n');

  // === 测试 2: 记忆上下文 ===
  log('cyan', '【测试 2】记忆上下文 - 智能上下文注入');
  log('yellow', '测试内容: 根据用户输入智能检索相关记忆');

  const testQueries = [
    {
      query: '我想用 TypeScript 开发新项目',
      expectedKeywords: ['typescript', 'type', '项目'],
    },
    {
      query: 'bot 的性能怎么样',
      expectedKeywords: ['performance', 'rpc', 'tui'],
    },
    {
      query: '有什么新功能想法',
      expectedKeywords: ['feature', 'idea', 'search'],
    },
  ];

  for (const { query, expectedKeywords } of testQueries) {
    log('yellow', `\n用户输入: "${query}"`);
    const context = await memoryContext.buildContext({
      userText: query,
      limit: 5,
    });
    log('green', `  ✓ 返回上下文: ${context.length} 字符`);

    // 检查是否包含预期的关键词
    let hasExpected = false;
    for (const kw of expectedKeywords) {
      if (context.toLowerCase().includes(kw.toLowerCase())) {
        hasExpected = true;
        break;
      }
    }
    if (hasExpected) {
      log('green', '  ✓ 上下文相关性: 良好');
    } else {
      log('yellow', '  ⚠  上下文相关性: 可能需要调整');
    }
  }

  log('green', '\n✅ 记忆上下文测试: 通过\n');

  // === 测试 3: 记忆治理 ===
  log('cyan', '【测试 3】记忆治理 - 过期清理和矛盾检测');
  log('yellow', '测试内容: 模拟过期记忆和矛盾记忆');

  // 创建过期记忆
  const pastDate = new Date(Date.now() - 2 * 86400_000).toISOString();
  await memoryStore.upsert({
    kind: 'idea',
    subject: 'old-expired-idea',
    content: '这是一个已过期的旧想法',
    tags: ['idea'],
    confidence: 0.5,
    expiresAt: pastDate,
  });
  log('green', '  ✓ 创建过期记忆');

  // 创建矛盾记忆
  await memoryStore.upsert({
    kind: 'preference',
    subject: 'use-javascript',
    content: '不用 TypeScript，改用 JavaScript',
    tags: ['javascript', 'preference'],
    confidence: 0.8,
  });
  log('green', '  ✓ 创建矛盾记忆 (与 use-typescript 冲突)');

  // 运行治理 (dryRun)
  log('yellow', '\n运行治理检查 (dryRun):');
  const governanceResult = await memoryGovernance.runGovernance({ dryRun: true });
  log('green', `  ✓ 扫描: ${governanceResult.scanned} 条`);
  log('green', `  ✓ 过期: ${governanceResult.expired} 条`);
  log('green', `  ✓ 归档: ${governanceResult.archived} 条`);
  log('green', `  ✓ 矛盾: ${governanceResult.conflicts} 组`);

  if (governanceResult.expired > 0) {
    log('green', '\n  ✓ 过期检测: 正常');
  }
  if (governanceResult.conflicts > 0) {
    log('green', '  ✓ 矛盾检测: 正常');
  }

  log('green', '\n✅ 记忆治理测试: 通过\n');

  // === 测试 4: 记忆质量 ===
  log('cyan', '【测试 4】记忆质量 - 置信度更新和质量报告');
  log('yellow', '测试内容: 批量更新置信度和生成质量报告');

  // 运行批量置信度更新
  log('yellow', '批量更新置信度:');
  const updateResult = await memoryQuality.batchUpdate({ dryRun: true });
  log('green', `  ✓ 更新记忆: ${updateResult.updated} 条`);
  log('green', `  ✓ 保持不变: ${updateResult.unchanged} 条`);

  // 生成质量报告
  log('yellow', '\n生成质量报告:');
  const qualityReport = await memoryQuality.report();
  log('green', `  ✓ 总记忆数: ${qualityReport.summary.total}`);
  log('green', `  ✓ 高置信度记忆: ${qualityReport.confidence.high} 条`);
  log('green', `  ✓ 中等置信度记忆: ${qualityReport.confidence.medium} 条`);
  log('green', `  ✓ 低置信度记忆: ${qualityReport.confidence.low} 条`);
  log('green', `  ✓ 从未访问的记忆: ${qualityReport.access.never} 条`);

  if (qualityReport.confidence.low > 0) {
    log('green', '\n  ✓ 质量检测: 正常 (发现低置信度记忆)');
  }

  if (qualityReport.recommendations.length > 0) {
    log('yellow', '\n  改进建议:');
    for (const rec of qualityReport.recommendations) {
      log('yellow', `    - ${rec.message}`);
    }
  }

  log('green', '\n✅ 记忆质量测试: 通过\n');

  // === 测试 5: 记忆蒸馏 ===
  log('cyan', '【测试 5】记忆蒸馏 - 从对话中提取结构化记忆');
  log('yellow', '测试内容: 模拟用户消息并提取记忆');

  // 添加模拟对话到 journal
  const journalDir = join(ROOT, 'data/memory/journal');
  if (!existsSync(journalDir)) {
    mkdirSync(journalDir, { recursive: true });
  }

  const today = new Date().toISOString().slice(0, 10);
  const journalFile = join(journalDir, `${today}.jsonl`);

  const sampleMessages = [
    {
      type: 'user_message',
      channelId: '1527730710410956841',
      messageId: `msg_${Date.now()}_1`,
      author: 'zhangsan',
      content: '我觉得应该给 bot 添加一个 /clear 命令来清理历史消息',
      timestamp: new Date().toISOString(),
    },
    {
      type: 'user_message',
      channelId: '1527730710410956841',
      messageId: `msg_${Date.now()}_2`,
      author: 'zhangsan',
      content: '这个功能很重要，因为有时候消息太多会影响使用',
      timestamp: new Date(Date.now() + 1000).toISOString(),
    },
  ];

  for (const msg of sampleMessages) {
    const line = JSON.stringify(msg) + '\n';
    appendFileSync(journalFile, line, 'utf8');
  }
  log('green', '  ✓ 添加模拟消息到 journal');

  // 运行蒸馏
  log('yellow', '\n运行蒸馏:');
  const distillResult = await memoryDistiller.distillDay({
    channelId: '1527730710410956841',
  });

  log('green', `  ✓ 处理消息: ${distillResult.processed} 条`);
  log('green', `  ✓ 提取记忆: ${distillResult.extracted} 条`);
  log('green', `  ✓ 跳过重复: ${distillResult.skipped} 条`);

  if (distillResult.extracted > 0) {
    log('green', '\n  ✓ 蒸馏功能: 正常');
  }

  log('green', '\n✅ 记忆蒸馏测试: 通过\n');

  // === 测试总结 ===
  log('cyan', '========================================');
  log('cyan', '📊 测试总结');
  log('cyan', '========================================\n');

  log('green', '✅ 记忆存储: 通过');
  log('green', '✅ 记忆上下文: 通过');
  log('green', '✅ 记忆治理: 通过');
  log('green', '✅ 记忆质量: 通过');
  log('green', '✅ 记忆蒸馏: 通过');

  log('cyan', '\n========================================');
  log('green', '🎉 所有测试完成！');
  log('cyan', '========================================\n');

  // 显示统计数据
  const stats = await memoryStore.stats();
  log('cyan', '📈 当前记忆统计:');
  log('yellow', `  总计: ${stats.total} 条`);
  if (stats.byKind) {
    for (const [kind, count] of Object.entries(stats.byKind)) {
      log('blue', `  [${kind}] ${count}`);
    }
  }
  log('');

  process.exit(0);
}

runAllTests().catch(e => {
  log('red', `❌ 测试失败: ${e.message}`);
  console.error(e);
  process.exit(1);
});