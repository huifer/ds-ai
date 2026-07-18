// extensions/discover-tools.mjs
// Pi Extension —— 5 个结构化的需求发现数据采集工具。
import { Type } from '@sinclair/typebox';
import {
  hnAlgoliaSearch, hnGetItem, githubRepoSearch,
  redditRssTop, probeAvailableSources, fetchRss,
} from './discover-tools-shared.mjs';

export default function (pi) {
  pi.registerTool({
    name: 'discover_search_hn',
    label: 'discover_search_hn',
    description: '搜索 Hacker News。返回 hits 数组(title/points/comments/engagement/hn_url/created_at/author/external_url),按 engagement 倒序。零 key。',
    parameters: Type.Object({
      query: Type.String({ description: '搜索关键词' }),
      min_points: Type.Optional(Type.Number({ description: '最低 points,默认 50' })),
      limit: Type.Optional(Type.Number({ description: '最多返回条数,默认 20' })),
    }),
    execute: async (_id, args) => {
      const r = await hnAlgoliaSearch(args.query, {
        minPoints: args.min_points ?? 50,
        hitsPerPage: args.limit ?? 20,
      });
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }], isError: !r.ok };
    },
  });

  pi.registerTool({
    name: 'discover_get_hn_thread',
    label: 'discover_get_hn_thread',
    description: '拿 HN 单帖 + 嵌套评论(已剥 HTML)。comments_data 是扁平数组,每条含 author/text/created_at/depth。Best Takes 来源。',
    parameters: Type.Object({
      item_id: Type.String({ description: 'HN 帖子 ID' }),
      max_depth: Type.Optional(Type.Number({ description: '嵌套深度,默认 4' })),
      max_comments: Type.Optional(Type.Number({ description: '最多返回多少条评论,默认 30' })),
    }),
    execute: async (_id, args) => {
      const r = await hnGetItem(args.item_id, {
        maxDepth: args.max_depth ?? 4,
        maxComments: args.max_comments ?? 30,
      });
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }], isError: !r.ok };
    },
  });

  pi.registerTool({
    name: 'discover_search_github_repos',
    label: 'discover_search_github_repos',
    description: 'GitHub 仓库搜索(走 gh CLI GraphQL)。返回 repos(name/description/stars/language/pushed_at/url),按 stars 倒序。',
    parameters: Type.Object({
      query: Type.String({ description: 'GitHub 搜索 query' }),
      limit: Type.Optional(Type.Number({ description: '最多返回多少个 repo,默认 15' })),
    }),
    execute: async (_id, args) => {
      const r = await githubRepoSearch(args.query, { limit: args.limit ?? 15 });
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }], isError: !r.ok };
    },
  });

  pi.registerTool({
    name: 'discover_search_reddit_rss',
    label: 'discover_search_reddit_rss',
    description: 'Reddit 子版 top(走 RSS,经常 403)。返回 posts(title/url/updated),**没有 score 数字**。失败如实返回。',
    parameters: Type.Object({
      subreddit: Type.String({ description: '子版名,不含 r/ 前缀' }),
      limit: Type.Optional(Type.Number({ description: '最多返回条数,默认 15' })),
      time: Type.Optional(Type.Union(
        [Type.Literal('day'), Type.Literal('week'), Type.Literal('month'), Type.Literal('year')],
        { description: '时间窗口,默认 month' }
      )),
    }),
    execute: async (_id, args) => {
      const r = await redditRssTop(args.subreddit, {
        limit: args.limit ?? 15,
        time: args.time ?? 'month',
      });
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }], isError: !r.ok };
    },
  });

  pi.registerTool({
    name: 'discover_probe_sources',
    label: 'discover_probe_sources',
    description: '探测 HN/GitHub/Reddit 当前可用性,brief 末尾"执行透明度"段用。',
    parameters: Type.Object({}),
    execute: async (_id) => {
      const probes = await probeAvailableSources();
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, probes }, null, 2) }], isError: false };
    },
  });

  pi.registerTool({
    name: 'discover_fetch_rss',
    label: 'discover_fetch_rss',
    description:
      '通用 RSS/Atom 抓取。返回结构化 entries(title/url/published/summary)。' +
      '适配 WordPress / RSSHub / V2EX / 少数派 / 36氪 / 掘金 / 虎嗅 / InfoQ 等。' +
      '**核心用途**:拉中文技术博客和社区 feed,补齐 HN/GitHub/Reddit 没有的中文信号。',
    parameters: Type.Object({
      url: Type.String({ description: '完整 RSS/Atom URL,例如 https://www.v2ex.com/feed/tab/tech' }),
      source_name: Type.Optional(Type.String({ description: '人类可读的来源名,例如 v2ex/36kr/sspai,会出现在返回里' })),
      limit: Type.Optional(Type.Number({ description: '最多返回几条,默认 15' })),
    }),
    execute: async (_id, args) => {
      const r = await fetchRss(args.url, {
        sourceName: args.source_name,
        limit: args.limit ?? 15,
      });
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }], isError: !r.ok };
    },
  });
}
