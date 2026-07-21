// ~/pi-discord-agents/src/publishers/local-draft.mjs
// 本地草稿发布器 — 把 HTML 保存到 data/content/drafts/<platform>/
// 本地草稿发布器：把 HTML 草稿保存到本地（供预览/人工发布），接口与真实 API 发布器一致

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export class LocalDraftPublisher {
  constructor({ root, log = () => {} } = {}) {
    this.root = root ?? process.cwd();
    this.log = log;
    this.name = 'local-draft';
  }

  async publish({ html, platform, metadata = {} }) {
    const draftDir = resolve(this.root, 'data/content/drafts', platform);
    if (!existsSync(draftDir)) mkdirSync(draftDir, { recursive: true });
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const filePath = resolve(draftDir, `${id}.html`);
    writeFileSync(filePath, html, 'utf8');
    this.log(`[publisher:local-draft] saved ${platform} → ${filePath} (${Buffer.byteLength(html)} bytes)`);
    return {
      externalUrl: `file://${filePath}`,
      status: 'draft',
      id,
      path: filePath,
      platform,
      metadata,
    };
  }

  async publishBatch(items) {
    const results = [];
    for (const item of items) {
      try {
        results.push({ ok: true, ...(await this.publish(item)) });
      } catch (e) {
        results.push({ ok: false, error: e.message, platform: item.platform });
      }
    }
    return results;
  }
}
