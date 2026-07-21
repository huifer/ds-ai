import 'dotenv/config';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

async function fetchGuildChannels() {
  const response = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/channels`, {
    headers: {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

async function main() {
  console.log('正在获取 Discord 服务器频道列表...\n');
  
  const channels = await fetchGuildChannels();
  
  // 按 category 分组
  const categories = {};
  const noCategory = [];
  
  channels.forEach(ch => {
    if (ch.type === 4) { // category
      categories[ch.id] = { name: ch.name, channels: [] };
    } else if (ch.parent_id) {
      if (!categories[ch.parent_id]) {
        categories[ch.parent_id] = { name: '未分类', channels: [] };
      }
      categories[ch.parent_id].channels.push(ch);
    } else {
      noCategory.push(ch);
    }
  });
  
  // 过滤掉 thread 类型，只显示主频道
  const mainChannels = channels.filter(ch => 
    ch.type !== 4 && ch.type !== 11 && ch.type !== 12 && ch.type !== 10
  );
  
  console.log(`📊 总频道数: ${mainChannels.length} 个文字频道\n`);
  console.log('='.repeat(80));
  
  // 按分类输出
  for (const [catId, cat] of Object.entries(categories)) {
    console.log(`\n📂 ${cat.name} (${cat.channels.length} 个频道)`);
    cat.channels.forEach(ch => {
      const botMapping = inferBot(ch.name);
      const botHint = botMapping ? ` → 🤖 ${botMapping}` : ' (无对应 Bot)';
      const typeIcon = ch.type === 0 ? '📝' : ch.type === 2 ? '🔊' : '❓';
      console.log(`   ${typeIcon} #${ch.name}${botHint}`);
    });
  }
  
  if (noCategory.length > 0) {
    console.log(`\n📂 无分类 (${noCategory.length} 个频道)`);
    noCategory.forEach(ch => {
      const botMapping = inferBot(ch.name);
      const botHint = botMapping ? ` → 🤖 ${botMapping}` : ' (无对应 Bot)';
      console.log(`   📝 #${ch.name}${botHint}`);
    });
  }
  
  // 统计
  console.log('\n' + '='.repeat(80));
  console.log('\n📈 Bot 分配统计:\n');
  
  const botStats = {};
  mainChannels.forEach(ch => {
    const bot = inferBot(ch.name) || '未分配';
    botStats[bot] = (botStats[bot] || 0) + 1;
  });
  
  for (const [bot, count] of Object.entries(botStats)) {
    console.log(`   ${bot}: ${count} 个频道`);
  }
}

function inferBot(channelName) {
  const name = channelName.toLowerCase();
  
  // 根据频道名称推断对应的 bot/功能
  const mappings = {
    'entry': 'entry-bot',
    'memory': 'entry-bot',
    'ideas': 'entry-bot',
    'build': 'entry-bot',
    'system': 'entry-bot',
    'rss': 'entry-bot',
    'daily': 'entry-bot',
    'gh': 'entry-bot',
    'usage': 'entry-bot',
    'xiasi': 'entry-bot',
    'control': 'entry-bot',
    'deep': 'entry-bot',
    'approval': 'entry-bot',
    'status': 'entry-bot',
    'sales': 'entry-bot',
    'quote': 'entry-bot',
    'bid': 'entry-bot',
    'contract': 'entry-bot',
    'project': 'entry-bot',
    'delivery': 'entry-bot',
    'test': 'entry-bot',
    'customer': 'entry-bot',
    'invoice': 'entry-bot',
    'dev': 'entry-bot',
    'product': 'entry-bot',
    'arch': 'entry-bot',
    'release': 'entry-bot',
    'ops': 'entry-bot',
    'knowledge': 'entry-bot',
    'seo': 'entry-bot',
    'link': 'entry-bot',
    'marketing': 'entry-bot',
    'market': 'entry-bot',
    'growth': 'entry-bot',
    'inbox': 'entry-bot',
    'outbox': 'entry-bot',
    'content': 'entry-bot',
    'data': 'entry-bot',
    'idea': 'entry-bot',
    'news': 'entry-bot',
    'report': 'entry-bot',
    'hr': 'entry-bot',
    'wechat': 'entry-bot',
    'xhs': 'entry-bot',
    'video': 'entry-bot',
    'douyin': 'entry-bot',
    'x': 'entry-bot',
    'ph': 'entry-bot',
    'linkedin': 'entry-bot',
    'youtube': 'entry-bot',
    'newsletter': 'entry-bot',
  };
  
  for (const [key, bot] of Object.entries(mappings)) {
    if (name.includes(key)) {
      return bot;
    }
  }
  
  return null;
}

main().catch(console.error);
