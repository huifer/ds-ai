// ~/pi-discord-agents/test-file-search.mjs
// 文件搜索系统测试

import { resolve } from 'node:path';

const ROOT = resolve('./');

async function test() {
  console.log('========================================');
  console.log('  File Search System Test');
  console.log('========================================\n');

  // 动态导入
  const { FileSearcher } = await import('./src/file/file-searcher.mjs');
  const { FileCommands } = await import('./src/file/file-commands.mjs');

  console.log('✅ 模块导入成功\n');

  // 测试 FileSearcher
  console.log('=== 测试 FileSearcher ===\n');

  const searcher = new FileSearcher({ rootDir: ROOT, log: console.log });

  // 测试 1: 搜索 .md 文件
  console.log('测试 1: 搜索 .md 文件');
  const results1 = await searcher.search('.md', { maxResults: 5 });
  console.log(`找到 ${results1.length} 个 .md 文件`);
  for (const r of results1.slice(0, 3)) {
    console.log(`  ${r.icon} ${r.name} - ${r.sizeFormatted}`);
  }
  console.log('');

  // 测试 2: 搜索 project
  console.log('测试 2: 搜索 "project"');
  const results2 = await searcher.search('project', { maxResults: 5 });
  console.log(`找到 ${results2.length} 个匹配`);
  for (const r of results2.slice(0, 3)) {
    console.log(`  ${r.icon} ${r.name} (${r.matchReason})`);
  }
  console.log('');

  // 测试 3: 最近文件
  console.log('测试 3: 最近文档');
  const recent = await searcher.listRecent('document', 5);
  console.log(`找到 ${recent.length} 个最近文档`);
  for (const r of recent.slice(0, 3)) {
    const age = Math.floor(r.age / (24 * 60 * 60 * 1000));
    console.log(`  ${r.icon} ${r.name} (${age}天前)`);
  }
  console.log('');

  // 测试 FileCommands
  console.log('=== 测试 FileCommands ===\n');

  const commands = new FileCommands({ rootDir: ROOT, log: console.log });

  // 测试 !files 命令
  console.log('测试 4: !files project');
  const result4 = await commands.handleCommand('!files project');
  console.log(`回复长度: ${result4?.reply?.length || 0}`);
  console.log(`回复预览: ${result4?.reply?.slice(0, 100)}...`);
  console.log('');

  // 测试 !recent 命令
  console.log('测试 5: !recent');
  const result5 = await commands.handleCommand('!recent');
  console.log(`回复长度: ${result5?.reply?.length || 0}`);
  console.log('');

  // 测试 !types 命令
  console.log('测试 6: !types');
  const result6 = await commands.handleCommand('!types');
  console.log(`回复长度: ${result6?.reply?.length || 0}`);
  console.log('');

  // 测试结果卡片生成
  console.log('=== 测试卡片生成 ===\n');
  console.log(searcher.generateResultCard(results1.slice(0, 3), '.md').slice(0, 300));
  console.log('\n...');

  console.log('========================================');
  console.log('  ✅ 文件搜索测试完成');
  console.log('========================================\n');
}

test().catch(e => {
  console.error('测试失败:', e.message);
  console.error(e.stack);
  process.exit(1);
});
