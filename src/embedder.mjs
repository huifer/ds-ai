// ~/pi-discord-agents/src/embedder.mjs
// ollama embedding 客户端。失败回退为 null,store 自动降级到 FTS-only 检索。
const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'nomic-embed-text';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 1024;

export async function createEmbedder({
  endpoint = DEFAULT_ENDPOINT,
  model = DEFAULT_MODEL,
  timeoutMs = 30_000,
  retries = 2,
  log = () => {},
} = {}) {
  const cache = new Map();

  async function detect() {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 3_000);
      const r = await fetch(`${endpoint}/api/tags`, { signal: ac.signal });
      clearTimeout(t);
      if (!r.ok) return { available: false, reason: `HTTP ${r.status}` };
      const j = await r.json();
      const has = (j.models || []).some((m) => m.name === model || m.name.startsWith(model + ':'));
      return has
        ? { available: true, model }
        : { available: false, reason: `model ${model} 未拉取, 跑: ollama pull ${model}` };
    } catch (e) {
      return { available: false, reason: e.message };
    }
  }

  function cacheGet(text) {
    const v = cache.get(text);
    if (!v) return null;
    if (v.expiresAt < Date.now()) {
      cache.delete(text);
      return null;
    }
    return v.vec;
  }
  function cacheSet(text, vec) {
    if (cache.size >= CACHE_MAX) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(text, { vec, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  async function embedOne(text) {
    const cached = cacheGet(text);
    if (cached) return cached;
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), timeoutMs);
        const r = await fetch(`${endpoint}/api/embeddings`, {
          method: 'POST',
          signal: ac.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: text }),
        });
        clearTimeout(t);
        if (!r.ok) {
          lastErr = new Error(`ollama HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
        } else {
          const j = await r.json();
          if (Array.isArray(j.embedding) && j.embedding.length) {
            cacheSet(text, j.embedding);
            return j.embedding;
          }
          lastErr = new Error('ollama 返回空 embedding');
        }
      } catch (e) {
        lastErr = e;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    throw lastErr || new Error('embed failed');
  }

  async function embed(text) {
    return embedOne(String(text || '').slice(0, 8000));
  }

  return { detect, embed, endpoint, model, cacheSize: () => cache.size };
}
