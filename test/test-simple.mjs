#!/usr/bin/env node
// ~/pi-discord-agents/test-simple.mjs
// 简化版测试沙盒 - 快速测试各种场景

import { createMemoryStore } from './src/memory-store.mjs';
import { createMemoryContext } from './src/memory-context.mjs';
import { createMemoryGovernance } from './src/memory-governance.mjs';
import { createMemoryQuality } from './src/memory-quality.mjs';

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

  const fs = require('fs');
  const embedder = {
    embed: async (text) => {
      // 模拟 embedding
      const hash = text.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
      return Array.from({ length: 384 }, () => ((hash * (i + 1)) % 100) / 100);
    },
  };

  const memoryStore = await createMemoryStore({
    rootDir: '/Users/zhangsan/pi-discord-agents',
    embedder,
    log: () => {},
  });

  const memoryContext = createMemoryContext({ memoryStore, embedder, log: () => {} });
  const memoryGovernance = createMemoryGovernance({ memoryStore, log: () => {} });
  const memoryQuality = createMemoryQuality({ memoryStore, log: () => {} });

  log('green', '✅ 初始化完成\n');

  return { memoryStore, memoryContext, memoryGovernance, memoryQuality };
}

// 添加记忆
async function addMemory(memoryStore, options) {
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
}

// 查看所有记忆
async function listMemories(memoryStore) {
  log('cyan', '\n📚 所有记忆:');
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

// 测试上下文注入
async function testContext(memoryContext, query) {
  log('cyan', `\n💭 测试上下文注入: "${query}"`);

  const context = await memoryContext.buildContext({
    userText: query,
    limit: 5,
  });

  log('green', '注入结果:');
  console.log(context);
}

// 批量添加测试记忆
async function addTestMemories(memoryStore) {
  log('cyan', '\n📝 添加测试记忆...\n');

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
      kind: 'constraint',
      subject: 'error-handling-must-log',
      content: '错误处理必须记录日志，不能静默失败',
      tags: ['error-handling', 'constraint'],
      confidence: 0.95,
    },
    {
      kind: 'preference',
      subject: 'prefer-neovim',
      content: '用 Neovim 而不是 Vim，因为插件生态更好',
      tags: ['editor', 'preference'],
      confidence: 0.75,
    },
    {
      kind: 'decision',
      subject: 'graphql-vs-rest',
      content: 'GraphQL 的类型系统很好，但学习曲线比 REST 高',
      tags: ['api', 'architecture'],
      confidence: 0.7,
    },
    {
      kind: 'constraint',
      subject: 'production-https',
      content: '生产环境必须启用 HTTPS，不能使用 HTTP',
      tags: ['security', 'constraint'],
      confidence: 0.95,
    },
  ];

  for (const mem of testMemories) {
    await addMemory(memoryStore, mem);
  }

  log('green', `\n✅ 已添加 ${testMemories.length} 条记忆\n`);
}

// 测试质量衰减
async function testQuality(memoryQuality) {
  log('cyan', '\n📈 测试质量衰减...');

  const report = await memoryQuality.report();

  log('green', '置信度分布:');
  log('blue', `  高 (>= 0.8): ${report.confidence.high}`);
  log('blue', `  中 (0.6-0.8): ${report.confidence.medium}`);
  log('blue', `  低 (< 0.6): ${report.confidence.low}`);

  log('green', '\n访问分布:');
  log('blue', `  从未: ${report.access.never}`);
  log('blue', `  低频 (1-3): ${report.access.low}`);
  log('blue', `  中频 (4-10): ${report.access.medium}`);
  log('blue', `  高频 (>10): ${report.access.high}`);

  if (report.recommendations.length > 0) {
    log('cyan', '\n建议:');
    for (const rec of report.recommendations) {
      log('yellow', `  [${rec.type}] ${rec.message}`);
    }
  }

  console.log();
}

// 测试治理
async function testGovernance(memoryGovernance) {
  log('cyan', '\n🧹 测试记忆治理（干运行）...');

  const result = await memoryGovernance.runGovernance({ dryRun: true });

  log('green', '治理结果:');
  log('blue', `  扫描: ${result.scanned}`);
  log('blue', `  过期: ${result.expired}`);
  log('blue', `  归档: ${result.archived}`);
  log('blue', `  矛盾: ${result.conflicts}`);

  if (result.expired > 0 || result.archived > 0) {
    log('yellow', '\n💡 建议运行实际清理:');
    log('yellow', '  memoryGovernance.runGovernance({ dryRun: false })');
  }

  console.log();
}

// 显示菜单
function showMenu() {
  log('cyan', '\n═══════════════════════════════════════════════════');
  log('bright', '🎮 记忆蒸馏测试沙盒');
  log('cyan', '═══════════════════════════════════════════════════\n');

  log('blue', '选择操作:\n');
  log('green', '  1) 添加测试记忆（批量）');
  log('green', '  2) 添加单条记忆');
  log('green', '  3) 查看所有记忆');
  log('green', '  4) 测试上下文注入');
  log('green', '  5) 测试质量衰减');
  log('green', '  6) 测试记忆治理');
  log('green', '  7) 清空所有记忆');
  log('green', '  0) 退出\n');
}

// 主循环
async function main() {
  const { memoryStore, memoryContext, memoryGovernance, memoryQuality } = await init();

  let running = true;
  while (running) {
    showMenu();
    process.stdout.write('请选择: ');

    const choice = await new Promise((resolve) => {
      process.stdin.once('data', (data) => resolve(data.toString().trim()));
    });

    switch (choice) {
      case '1':
        await addTestMemories(memoryStore);
        break;

      case '2': {
        log('cyan', '\n添加记忆:\n');
        log('green', '  类型: decision, constraint, preference, fact, idea');
        process.stdout.write('类型: ');

        const kind = await new Promise((resolve) => {
          process.stdin.once('data', (data) => resolve(data.toString().trim()));
        });

        process.stdout.write('主题: ');
        const subject = await new Promise((resolve) => {
          process.stdin.once('data', (data) => resolve(data.toString().trim()));
        });

        process.stdout.write('内容: ');
        const content = await new Promise((resolve) => {
          process.stdin.once('data', (data) => resolve(data.toString().trim()));
        });

        process.stdout.write('标签（逗号分隔）: ');
        const tagsInput = await new Promise((resolve) => {
          process.stdin.once('data', (data) => resolve(data.toString().trim()));
        });
        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];

        process.stdout.write('置信度 (0-1，默认 0.8): ');
        const confInput = await new Promise((resolve) => {
          process.stdin.once('data', (data) => resolve(data.toString().trim()));
        });
        const confidence = confInput ? parseFloat(confInput) : 0.8;

        try {
          await addMemory(memoryStore, { kind, subject, content, tags, confidence });
          log('green', '\n✅ 添加成功\n');
        } catch (e) {
          log('red', `\n❌ 添加失败: ${e.message}\n`);
        }
        break;
      }

      case '3':
        await listMemories(memoryStore);
        break;

      case '4': {
        process.stdout.write('\n输入查询问题: ');
        const query = await new Promise((resolve) => {
          process.stdin.once('data', (data) => resolve(data.toString().trim()));
        });
        if (query) await testContext(memoryContext, query);
        break;
      }

      case '5':
        await testQuality(memoryQuality);
        break;

      case '6':
        await testGovernance(memoryGovernance);
        break;

      case '7': {
        process.stdout.write('\n⚠️  确认清空所有记忆？(yes/no): ');
        const confirm = await new Promise((resolve) => {
          process.stdin.once('data', (data) => resolve(data.toString().trim()));
        });

        if (confirm.toLowerCase() === 'yes') {
          const fs = require('fs');
          const path = require('path');
          const dir = path.join('/Users/zhangsan/pi-discord-agents/data/memory/store');
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              fs.unlinkSync(path.join(dir, file));
            }
            log('green', '\n✅ 已清空所有记忆\n');
          }
        } else {
          log('yellow', '\n❌ 已取消\n');
        }
        break;
      }

      case '0':
        running = false;
        log('green', '\n👋 再见！\n');
        break;

      default:
        log('red', '\n❌ 无效选择\n');
    }
  }

  process.exit(0);
}

// 设置原始模式（支持单字符输入）
process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');

main().catch((e) => {
  log('red', `\n❌ 错误: ${e.message}`);
  console.error(e);
  process.exit(1);
});