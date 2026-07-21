// ~/pi-discord-agents/test-playground.mjs
// 记忆蒸馏测试沙盒 - 轻松测试各种场景

import { createMemoryStore } from './src/memory-store.mjs';
import { createMemoryDistiller } from './src/memory-distiller.mjs';
import { createMemoryJournal } from './memory-journal.mjs';
import { createMemoryContext } from './src/memory-context.mjs';
import { createMemoryGovernance } from './src/memory-governance.mjs';
import { createMemoryQuality } from './src/memory-quality.mjs';
import { createEmbedder } from './embedder.mjs';

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

  const memoryJournal = createMemoryJournal({ memoryStore, log: () => {} });
  const memoryContext = createMemoryContext({ memoryStore, embedder, log: () => {} });
  const memoryGovernance = createMemoryGovernance({ memoryStore, log: () => {} });
  const memoryQuality = createMemoryQuality({ memoryStore, log: () => {} });

  log('green', '✅ 初始化完成\n');

  return { memoryStore, memoryJournal, memoryContext, memoryGovernance, memoryQuality, embedder };
}

// 模拟添加用户消息
function addUserMessage(content) {
  const date = new Date().toISOString();
  const line = JSON.stringify({
    ts: date,
    type: 'user_message',
    channelId: '1527730710410956841',
    messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    author: 'zhangsan',
    content,
  }) + '\n';

  const fs = require('fs');
  const path = require('path');
  const dir = path.join('/Users/zhangsan/pi-discord-agents/data/memory', 'journal');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${date.slice(0, 10)}.jsonl`);
  fs.appendFileSync(file, line, 'utf8');

  log('yellow', `  ➤ ${content.slice(0, 60)}${content.length > 60 ? '...' : ''}`);
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
  const results = await memoryStore.query({ limit: 20 });
  for (const mem of results.items) {
    const kindEmoji = {
      decision: '🎯',
      constraint: '🔒',
      preference: '❤️',
      fact: '📌',
      idea: '💡',
    }[mem.kind] || '📦';

    const confidenceColor = mem.confidence >= 0.8 ? 'green' : mem.confidence >= 0.6 ? 'yellow' : 'red';
    log(confidenceColor, `${kindEmoji} [${mem.kind}] ${mem.subject}`);
    log('bright', `    ${mem.content.slice(0, 80)}${mem.content.length > 80 ? '...' : ''}`);
    log('cyan', `    置信度: ${(mem.confidence || 0).toFixed(2)} | 访问: ${mem.accessCount || 0} | 标签: [${(mem.tags || []).join(', ') || '无'}]`);
  }

  console.log();
}

// 模拟上下文注入
async function testContext(memoryContext, query) {
  log('cyan', `\n💭 测试上下文注入: "${query}"`);

  const context = await memoryContext.buildContext({
    userText: query,
    limit: 5,
  });

  log('green', '注入结果:');
  console.log(context);
}

// 模拟蒸馏（返回模拟候选）
async function mockDistill(memoryStore, memoryJournal, embedder, dryRun = true) {
  log('cyan', '\n🔬 模拟蒸馏过程...');

  const dateKeyStr = new Date().toISOString().slice(0, 10);
  const todayStr = new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  log('blue', `📅 今日: ${todayStr}`);
  log('blue', `📊 日期键: ${dateKeyStr}`);

  // 构建 transcript
  const transcript = await memoryJournal.buildTranscript(dateKeyStr);
  const stats = await memoryStore.stats();
  const existingMemories = await memoryStore.query({ limit: 100 });

  log('blue', `\n📝 Transcript: ${transcript.length} 字符`);
  log('blue', `💾 现有记忆: ${stats.total}`);

  if (transcript.length < 100) {
    log('red', '⚠️  Transcript 太短，无法蒸馏（至少 100 字符）');
    log('yellow', '💡 提示: 先添加一些对话消息');
    return;
  }

  // 显示 transcript 前部分
  log('cyan', '\nTranscript 预览（前 300 字符）:');
  console.log(transcript.slice(0, 300));
  if (transcript.length > 300) {
    log('yellow', '...\n');
  }

  // 模拟 LLM 返回的候选
  const mockCandidates = [
    {
      kind: 'preference',
      subject: 'mock-preference-1',
      content: '这是一个模拟的偏好记忆，用于测试重复检测',
      reasoning: '模拟记忆',
      tags: ['test', 'mock'],
      confidence: 0.8,
    },
  ];

  // 验证候选
  log('cyan', '\n🔍 验证候选记忆...');
  const validated = await memoryDistiller._validateCandidates(mockCandidates, existingMemories.items, embedder);
  log('green', `✅ 通过: ${validated.accepted.length} 条`);
  log('red', `❌ 拒绝: ${validated.rejected.length} 条`);

  if (validated.rejected.length > 0) {
    log('cyan', '\n拒绝原因:');
    for (const r of validated.rejected) {
      log('red', `  ❌ ${r.candidate.subject}: ${r.reason}`);
    }
  }

  if (dryRun) {
    log('yellow', '\n⚠️  干运行模式（未实际保存）');
  } else {
    // 实际保存
    log('cyan', '\n💾 保存记忆...');
    const saved = [];
    for (const mem of validated.accepted) {
      const result = await memoryStore.upsert(mem);
      saved.push(result);
    }
    log('green', `✅ 已保存 ${saved.length} 条记忆`);
  }

  console.log();
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
  log('cyan', '\n🧹 测试记忆治理...');

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
  log('green', '  1) 添加测试消息');
  log('green', '  2) 查看所有记忆');
  log('green', '  3) 测试上下文注入');
  log('green', '  4) 模拟蒸馏过程');
  log('green', '  5) 测试质量衰减');
  log('green', '  6) 测试记忆治理');
  log('green', '  7) 添加多轮对话');
  log('green', '  0) 退出\n');
}

// 模拟对话场景
function addConversationScenario() {
  log('cyan', '\n💬 添加测试对话...\n');

  const scenarios = {
    '1': [
      '我发现 Rust 的所有权模型虽然严格，但能避免很多运行时错误',
      'async/await 比 Promise 链更易读，我以后都用它',
      '这个 bug 是因为忘记等待 Promise，以后要记住用 try/catch',
      '测试覆盖率至少要达到 80%，这是我的底线',
    ],
    '2': [
      'GraphQL 的类型系统很好，但学习曲线比 REST 高',
      '生产环境必须启用 HTTPS，不能使用 HTTP',
      '我用 Neovim 而不是 Vim，因为插件生态更好',
      'Python 的类型提示很有用，但不是强制的',
    ],
    '3': [
      '微服务架构适合大型团队，但小型项目用单体就够了',
      '我倾向于用 Postgres 而不是 MySQL，更喜欢它的 JSON 支持',
      '代码审查必须通过 2 人才能合并',
      '从不生产环境调试，只看日志',
    ],
  };

  log('blue', '选择场景:\n');
  log('green', '  1) Rust/TypeScript 测试');
  log('green', '  2) GraphQL/HTTPS 测试');
  log('green', '  3) 微服务/Postgres 测试');
  log('green', '  0) 返回\n');

  process.stdout.write('请选择: ');

  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      const choice = data.toString().trim();
      if (scenarios[choice]) {
        scenarios[choice].forEach(msg => addUserMessage(msg));
        log('green', '\n✅ 已添加对话\n');
      } else if (choice !== '0') {
        log('red', '\n❌ 无效选择\n');
      }
      resolve(choice !== '0');
    });
  });
}

// 上下文注入查询
async function contextQuery() {
  log('cyan', '\n请输入查询问题（例如："我想用 Rust 开发新项目"）:');
  process.stdout.write('>>> ');

  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

// 主循环
async function main() {
  const { memoryStore, memoryJournal, memoryContext, memoryGovernance, memoryQuality, embedder } = await init();

  let running = true;
  while (running) {
    showMenu();
    process.stdout.write('请选择: ');

    const choice = await new Promise((resolve) => {
      process.stdin.once('data', (data) => resolve(data.toString().trim()));
    });

    switch (choice) {
      case '1': {
        const msg = await new Promise((resolve) => {
          log('yellow', '\n输入消息内容（空行结束）:');
          process.stdin.resume();
          let lines = [];
          const handler = (data) => {
            const line = data.toString().trim();
            if (line === '') {
              process.stdin.setRawMode(true);
              process.stdin.setEncoding('utf8');
              process.stdin.removeListener('data', handler);
              resolve(lines.join(' '));
            } else {
              lines.push(line);
            }
          };
          process.stdin.setRawMode(false);
          process.stdin.setEncoding('utf8');
          process.stdin.on('data', handler);
        });

        if (msg) addUserMessage(msg);
        break;
      }

      case '2':
        await listMemories(memoryStore);
        break;

      case '3': {
        const query = await contextQuery();
        if (query) await testContext(memoryContext, query);
        break;
      }

      case '4':
        await mockDistill(memoryStore, memoryJournal, embedder, true);
        break;

      case '5':
        await testQuality(memoryQuality);
        break;

      case '6':
        await testGovernance(memoryGovernance);
        break;

      case '7':
        const continueScenario = await addConversationScenario();
        if (continueScenario) {
          await mockDistill(memoryStore, memoryJournal, embedder, true);
        }
        break;

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

main().catch((e) => {
  log('red', `\n❌ 错误: ${e.message}`);
  console.error(e);
  process.exit(1);
});