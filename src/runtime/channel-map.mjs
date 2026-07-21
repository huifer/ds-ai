// ~/pi-discord-agents/src/runtime/channel-map.mjs
// 统一频道路由：平台 → 预览/发布频道，平台 → 国内/海外区域，区域 → 总编频道

// ===== 平台分类 =====
export const DOMESTIC_PLATFORMS = ['wechat', 'xiaohongshu', 'video-account', 'douyin'];
export const OVERSEAS_PLATFORMS = ['x', 'ph', 'newsletter', 'youtube', 'linkedin'];

export function classifyRegion(platform) {
  if (DOMESTIC_PLATFORMS.includes(platform)) return 'domestic';
  if (OVERSEAS_PLATFORMS.includes(platform)) return 'overseas';
  return 'both';
}

export function classifyPlatforms(platforms) {
  const regions = new Set((platforms ?? []).map(classifyRegion));
  return {
    hasDomestic: regions.has('domestic'),
    hasOverseas: regions.has('overseas'),
    regions: [...regions],
  };
}

// ===== 环境变量 key 映射 =====
export const PREVIEW_CHANNEL_KEYS = {
  wechat: 'CH_DOMESTIC_PREVIEW_WECHAT',
  xiaohongshu: 'CH_DOMESTIC_PREVIEW_XHS',
  'video-account': 'CH_DOMESTIC_PREVIEW_VIDEO',
  douyin: 'CH_DOMESTIC_PREVIEW_DOUYIN',
  x: 'CH_OS_PREVIEW_X',
  ph: 'CH_OS_PREVIEW_PH',
  newsletter: 'CH_OS_PREVIEW_NEWSLETTER',
  youtube: 'CH_OS_PREVIEW_YOUTUBE',
  linkedin: 'CH_OS_PREVIEW_LINKEDIN',
};

export const PUBLISH_CHANNEL_KEYS = {
  wechat: 'CH_DOMESTIC_PUBLISH_WECHAT',
  xiaohongshu: 'CH_DOMESTIC_PUBLISH_XHS',
  'video-account': 'CH_DOMESTIC_PUBLISH_VIDEO',
  douyin: 'CH_DOMESTIC_PUBLISH_DOUYIN',
  x: 'CH_OS_PUBLISH_X',
  ph: 'CH_OS_PUBLISH_PH',
  newsletter: 'CH_OS_PUBLISH_NEWSLETTER',
};

export const EDITORIAL_KEYS = {
  domestic: 'CH_DOMESTIC_MAIN',
  overseas: 'CH_OS_MAIN',
};

// ===== 查询函数 =====
export function getPreviewChannelId(platform, env = process.env) {
  const key = PREVIEW_CHANNEL_KEYS[platform];
  return (key && env[key]) || env.CH_NEWS_FEED || null;
}

export function getPublishChannelId(platform, env = process.env) {
  const key = PUBLISH_CHANNEL_KEYS[platform];
  return (key && env[key]) || env.CH_NEWS_FEED || null;
}

export function getEditorialChannelId(region, env = process.env) {
  const key = EDITORIAL_KEYS[region];
  return (key && env[key]) || env.CH_NEWS_FEED || null;
}

/**
 * 根据候选内容的目标平台，返回应该推送到的总编频道列表
 * @returns {{region, channelId}[]}
 */
export function getEditorialChannelsForPlatforms(platforms, env = process.env) {
  const { hasDomestic, hasOverseas } = classifyPlatforms(platforms);
  const result = [];
  if (hasDomestic) result.push({ region: 'domestic', channelId: getEditorialChannelId('domestic', env) });
  if (hasOverseas) result.push({ region: 'overseas', channelId: getEditorialChannelId('overseas', env) });
  if (!result.length) result.push({ region: 'both', channelId: getEditorialChannelId('domestic', env) });
  return result;
}

/**
 * 核心路由函数：根据 agentId 和 result 内容，决定卡片推送到哪些频道
 * @returns {{channelId, reason}[]}
 */
export function resolveContentTargets(agentId, result, env = process.env) {
  const r = result?.result ?? result;
  const targets = [];

  switch (agentId) {
    case 'intake':
      targets.push({ channelId: env.CH_DAILY_MATERIAL, reason: 'intake→每日素材' });
      break;

    case 'distill': {
      // 根据平台推到国内总编 / 海外总编
      const platforms = r.platforms ?? r.card?.platforms ?? ['wechat', 'x'];
      const editorial = getEditorialChannelsForPlatforms(platforms, env);
      for (const e of editorial) {
        targets.push({ channelId: e.channelId, reason: `distill→${e.region === 'domestic' ? '国内总编' : '海外总编'}` });
      }
      break;
    }

    case 'privacy':
    case 'fact-check':
      // 隐私/事实检查结果推到总编（根据候选的平台）
      targets.push({ channelId: env.CH_AGENT_STATUS, reason: '检查→Agent状态' });
      break;

    case 'renderer': {
      // auto-render：summary 推到所有涉及的总编频道
      if (r.renderIds) {
        const platforms = r.platforms ?? ['wechat', 'x', 'newsletter'];
        const editorial = getEditorialChannelsForPlatforms(platforms, env);
        for (const e of editorial) {
          targets.push({ channelId: e.channelId, reason: `render→${e.region === 'domestic' ? '国内总编' : '海外总编'}` });
        }
      } else {
        // 单个 render：推到对应预览频道
        const platform = r.platform ?? 'wechat';
        targets.push({ channelId: getPreviewChannelId(platform, env), reason: `render→预览-${platform}` });
      }
      break;
    }

    case 'publisher': {
      const platform = r.platform ?? 'wechat';
      targets.push({ channelId: getPublishChannelId(platform, env), reason: `publish→发布-${platform}` });
      break;
    }

    case 'qa':
      targets.push({ channelId: env.CH_AGENT_STATUS, reason: 'qa→Agent状态' });
      break;

    case 'pm':
    case 'coding':
      targets.push({ channelId: env.CH_PROJECT_MGMT, reason: 'project→项目管理' });
      break;

    default:
      targets.push({ channelId: env.CH_NEWS_FEED, reason: 'default→主快讯' });
  }

  return targets.filter((t) => t.channelId);
}
