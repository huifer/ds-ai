// ~/pi-discord-agents/scripts/migrate-channels.mjs
// 频道迁移脚本

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

/**
 * 新频道配置
 */
const NEW_CHANNELS = {
  // 推送频道
  PUSH: {
    rss: { name: '资讯', env: 'CH_RSS', existing: true },
    daily: { name: '每日总结', env: 'CH_DAILY', existing: true },
    gh: { name: '每日任务', env: 'CH_GH', existing: true },
    usage: { name: '用量', env: 'CH_USAGE', existing: true },
  },
  
  // 项目频道
  PROJECT: {
    projects: { name: '项目', env: 'CH_PROJECT', existing: false },
  },
  
  // 知识频道
  KNOWLEDGE: {
    memory: { name: '记忆库', env: 'CH_MEMORY', existing: true },
    ideas: { name: '灵感', env: 'CH_IDEAS', existing: true },
    output: { name: '产出', env: 'CH_OUTPUT', existing: false },
    archive: { name: '归档', env: 'CH_ARCHIVE', existing: false },
  },
  
  // 内容频道
  CONTENT: {
    wechat: { name: '内容-公众号', env: 'CH_CONTENT_WECHAT', existing: false },
    xhs: { name: '内容-小红书', env: 'CH_CONTENT_XHS', existing: false },
    video: { name: '内容-视频号', env: 'CH_CONTENT_VIDEO', existing: false },
    x: { name: '内容-X', env: 'CH_CONTENT_X', existing: false },
    newsletter: { name: '内容-Newsletter', env: 'CH_CONTENT_NEWSLETTER', existing: false },
  },
  
  // 通知频道
  NOTIFY: {
    approval: { name: '审批', env: 'CH_APPROVAL', existing: true },
    reminder: { name: '提醒', env: 'CH_REMINDER', existing: false },
    alert: { name: '告警', env: 'CH_ALERT', existing: true },
  },
};

/**
 * 需要删除的旧频道
 */
const OLD_CHANNELS_TO_DELETE = [
  // 企业服务频道（用 #项目 代替）
  'CH_SALES_LEADS',
  'CH_OPPORTUNITY_SOLUTION',
  'CH_QUOTE',
  'CH_BID',
  'CH_CONTRACT_OPS',
  'CH_PROJECT_MGMT',
  'CH_FDE_DELIVERY',
  'CH_TEST_ACCEPT',
  'CH_CUSTOMER_SUCCESS',
  'CH_INVOICE_AR',
  
  // 其他旧频道
  'CH_OPPORTUNITY',        // 合并到 #资讯
  'CH_CONTROL_DASH',       // 功能分散
  'CH_DEEP_DISCUSSION',    // 合并
  'CH_AGENT_STATUS',       // 合并到 #提醒
  'CH_DOMESTIC_MAIN',       // 合并到 #内容-公众号
  'CH_DAILY_MATERIAL',      // 内容采集自动化
  'CH_DOMESTIC_PREVIEW_WECHAT',
  'CH_DOMESTIC_PREVIEW_XHS',
  'CH_DOMESTIC_PREVIEW_VIDEO',
  'CH_DOMESTIC_PREVIEW_DOUYIN',
  'CH_DOMESTIC_PUBLISH_WECHAT',
  'CH_DOMESTIC_PUBLISH_XHS',
  'CH_DOMESTIC_PUBLISH_VIDEO',
  'CH_DOMESTIC_PUBLISH_DOUYIN',
  'CH_OS_MAIN',
  'CH_OS_RAW',
  'CH_OS_PREVIEW_X',
  'CH_OS_PREVIEW_PH',
  'CH_OS_PREVIEW_NEWSLETTER',
  'CH_OS_PREVIEW_YOUTUBE',
  'CH_OS_PREVIEW_LINKEDIN',
  'CH_OS_PUBLISH_X',
  'CH_OS_PUBLISH_PH',
  'CH_OS_PUBLISH_NEWSLETTER',
  'CH_INBOX',
  'CH_OUTBOX',
  'CH_CONTENT_ASSETS',
  'CH_CUSTOMER_DATA',
  'CH_MEMORY_BANK',
  'CH_IDEA_POOL',
  'CH_NEWS_FEED',
  'CH_USAGE_REPORT',
  'CH_BIZ_HR',
  'CH_FILE_COLLECTION',
  'CH_DEV_SOFTWARE',
  'CH_PRODUCT_PLAN',
  'CH_ARCH_REVIEW',
  'CH_TEST_RELEASE',
  'CH_PROD_OPS',
  'CH_ENG_KNOWLEDGE',
  'CH_SEO_GEO',
  'CH_LINK_BUSINESS',
  'CH_MARKETING_GROWTH',
  'CH_MARKET_RESEARCH',
  'CH_OPPORTUNITY_FIND',
  'CH_GROWTH_REVIEW',
];

/**
 * 需要保留的频道
 */
const CHANNELS_TO_KEEP = [
  'CH_ENTRY',           // #主入口
  'CH_RSS',            // #资讯
  'CH_DAILY',          // #每日总结
  'CH_GH',             // #每日任务
  'CH_USAGE',          // #用量
  'CH_MEMORY',         // #记忆库
  'CH_IDEAS',          // #灵感
  'CH_APPROVAL_CENTER', // #审批中心
  'CH_XIASI',          // #遐思
  'CH_ALERT',           // #告警
];

/**
 * 迁移任务
 */
async function migrate() {
  console.log('========================================');
  console.log('  频道迁移脚本');
  console.log('========================================\n');

  const envPath = join(ROOT, '.env');
  let envContent = '';

  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf8');
  }

  const results = {
    toKeep: [],
    toDelete: [],
    toAdd: [],
    updates: [],
  };

  // 1. 分析当前 .env
  console.log('=== 步骤 1: 分析当前配置 ===\n');
  
  const currentChannels = [];
  const envLines = envContent.split('\n');
  
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('CH_') && trimmed.includes('=')) {
      const [key] = trimmed.split('=');
      currentChannels.push(key);
    }
  }

  console.log(`当前 .env 中有 ${currentChannels.length} 个频道配置\n`);

  // 2. 标记需要删除的频道
  console.log('=== 步骤 2: 待删除频道 ===\n');
  
  for (const ch of OLD_CHANNELS_TO_DELETE) {
    if (currentChannels.includes(ch)) {
      results.toDelete.push(ch);
      console.log(`  ❌ ${ch} (将删除)`);
    }
  }

  // 3. 标记需要保留的频道
  console.log('\n=== 步骤 3: 保留频道 ===\n');
  
  for (const ch of CHANNELS_TO_KEEP) {
    if (currentChannels.includes(ch)) {
      results.toKeep.push(ch);
      console.log(`  ✅ ${ch}`);
    }
  }

  // 4. 生成新频道配置
  console.log('\n=== 步骤 4: 新增频道 ===\n');
  
  const newChannelConfigs = [];
  
  for (const [category, channels] of Object.entries(NEW_CHANNELS)) {
    for (const [key, config] of Object.entries(channels)) {
      if (!config.existing) {
        results.toAdd.push(config);
        console.log(`  🆕 ${config.env} = ${config.name}`);
        // 占位符，需要手动创建频道后填入 ID
        newChannelConfigs.push(`# ${config.name} - TODO: 创建后填入 ID`);
      } else {
        console.log(`  ✅ ${config.env} (已存在)`);
      }
    }
  }

  // 5. 生成迁移说明
  console.log('\n=== 步骤 5: 生成迁移说明 ===\n');

  const migrationGuide = `# 频道迁移说明

## 执行时间
${new Date().toLocaleString('zh-CN')}

## 需要在 Discord 中创建的新频道

${results.toAdd.map(c => `- **${c.name}** (${c.env})`).join('\n')}

## 需要删除/归档的频道

${results.toDelete.map(c => `- ~~${c}~~`).join('\n')}

## 保留的频道

${results.toKeep.map(c => `- ${c}`).join('\n')}

## .env 更新模板

完成频道创建后，在 .env 中添加以下配置：

\`\`\`
${newChannelConfigs.join('\n')}
\`\`\`

## 执行步骤

1. 在 Discord 中创建新频道
2. 获取新频道的 Channel ID
3. 更新 .env 文件
4. 重启 entry-bot
5. 确认功能正常

## 频道用途说明

### 推送层
- \`#资讯\`: RSS 资讯聚合，每天 12:00 推送
- \`#每日总结\`: 工作日报，每天 23:00 推送
- \`#每日任务\`: GitHub 待办，每天 10:00 推送
- \`#用量\`: Token 使用报告，每天 12:30 推送

### 项目层
- \`#项目\`: 所有工作的沉淀容器，AI 自动创建 Project

### 知识层
- \`#记忆库\`: 长期知识、偏好、决策
- \`#灵感\`: 点子、想法
- \`#产出\`: 文档、代码
- \`#归档\`: 历史项目

### 内容层
- \`#内容-*\`: 各平台内容分发

### 通知层
- \`#审批\`: 需要处理的审批
- \`#提醒\`: 任务到期提醒
- \`#告警\`: 系统异常

## 数据迁移

旧业务频道的数据建议：
- 销售类 → 迁移到 #项目 下的 Project
- 技术类 → 迁移到 #产出
- 历史项目 → 迁移到 #归档
`;

  // 保存迁移说明
  const guidePath = join(ROOT, 'docs', 'CHANNEL_MIGRATION.md');
  writeFileSync(guidePath, migrationGuide, 'utf8');
  console.log(`迁移说明已保存到: ${guidePath}\n`);

  // 6. 生成 .env 更新建议
  console.log('=== 步骤 6: .env 更新建议 ===\n');
  
  let envUpdate = '\n# ===== 新频道配置 (待填入 Channel ID) =====\n';
  for (const config of results.toAdd) {
    envUpdate += `# TODO: 创建 #${config.name} 后填入 ID\n`;
    envUpdate += `# ${config.env }=\n`;
  }
  envUpdate += '# ===== 频道迁移完成前保留旧配置 =====\n';

  const updatePath = join(ROOT, 'docs', 'ENV_UPDATE_SUGGESTION.txt');
  writeFileSync(updatePath, envUpdate, 'utf8');
  console.log(`更新建议已保存到: ${updatePath}`);

  // 总结
  console.log('\n========================================');
  console.log('  迁移准备完成');
  console.log('========================================\n');
  console.log(`📊 统计:`);
  console.log(`   保留: ${results.toKeep.length} 个`);
  console.log(`   删除: ${results.toDelete.length} 个`);
  console.log(`   新增: ${results.toAdd.length} 个\n`);
  console.log(`📄 文档:`);
  console.log(`   迁移说明: docs/CHANNEL_MIGRATION.md`);
  console.log(`   更新建议: docs/ENV_UPDATE_SUGGESTION.txt\n`);
  console.log('下一步: 按照迁移说明在 Discord 中创建频道\n');

  return results;
}

// 执行
migrate().catch(e => {
  console.error('迁移失败:', e);
  process.exit(1);
});
