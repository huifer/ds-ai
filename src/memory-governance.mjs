// ~/pi-discord-agents/src/memory-governance-improved.mjs
// 改进的记忆治理：过期、清理、维护（增强矛盾检测）

import { resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

// 过期规则
const EXPIRATION_RULES = [
  {
    id: 'expire-by-date',
    name: '时间过期',
    priority: 1,
    condition: (meta) => {
      if (!meta.expiresAt) return false;
      return new Date(meta.expiresAt) < new Date();
    },
    action: 'expire',
    reason: (meta) => `过期日期: ${meta.expiresAt}`,
  },
  {
    id: 'expire-long-unused',
    name: '长期未访问',
    priority: 2,
    condition: (meta, now) => {
      if (!meta.lastAccessedAt) return false;
      const daysSinceAccess = (now - new Date(meta.lastAccessedAt).getTime()) / 86400_000;
      const thresholds = {
        decision: 365,
        constraint: 365,
        preference: 180,
        fact: 90,
        build: 90,
        reflection: 90,
        definition: 180,
        idea: 60,
        project: 120,
        context: 30,
        todo: 60,
      };
      return daysSinceAccess > (thresholds[meta.kind] || 90);
    },
    action: 'archive',
    reason: (meta) => `未访问超过阈值 (${meta.kind})`,
  },
  {
    id: 'expire-low-confidence',
    name: '低置信度',
    priority: 3,
    condition: (meta) => {
      if (meta.confidence >= 0.6) return false;
      if ((meta.accessCount || 0) >= 5) return false;
      return true;
    },
    action: 'review',
    reason: (meta) => `置信度过低 (${meta.confidence}) 且访问次数不足 (${meta.accessCount || 0})`,
  },
  {
    id: 'expire-contradictory',
    name: '矛盾记忆',
    priority: 4,
    condition: (meta, allMetas) => {
      // 检测矛盾的记忆（不同 subject 也可以）
      const sameKind = allMetas.filter(m =>
        m.kind === meta.kind &&
        m.status === 'active' &&
        m.id !== meta.id
      );

      for (const other of sameKind) {
        if (isContradictory(meta.content, other.content, meta.subject, other.subject)) {
          return true;
        }
      }
      return false;
    },
    action: 'conflict',
    reason: (meta, allMetas) => {
      const sameKind = allMetas.filter(m =>
        m.kind === meta.kind &&
        m.status === 'active' &&
        m.id !== meta.id
      );
      const contradictory = sameKind.find(m => isContradictory(meta.content, m.content, meta.subject, other.subject));
      return `与 [${contradictory.id}] 矛盾`;
    },
  },
];

// === 改进的矛盾检测 ===

// 反义词对（修正格式）
const OPPOSITE_PAIRS = [
  // 正向词 vs 负向词
  { pos: ['用', '使用', '启用', '允许'], neg: ['不用', '不使用', '禁用', '禁止', '拒绝'] },
  { pos: ['要', '需要', '必须', '应该'], neg: ['不要', '不需要', '不能', '不应该'] },
  { pos: ['喜欢', '偏好', '倾向'], neg: ['不喜欢', '讨厌', '反感', '讨厌'] },
  { pos: ['选择', '采用', '确定'], neg: ['放弃', '不选择', '拒绝'] },
  { pos: ['开启', '打开', '激活'], neg: ['关闭', '关闭', '停用'] },
  { pos: ['支持', '同意', '认可'], neg: ['反对', '不同意', '不认可'] },
  { pos: ['推荐', '建议', '提倡'], neg: ['不推荐', '不建议', '不提倡'] },

  // 概念性矛盾
  { pos: ['vim'], neg: ['neovim'] },
  { pos: ['单体', 'monolith'], neg: ['微服务', 'microservices'] },
  { pos: ['单体架构'], neg: ['微服务架构'] },
  { pos: ['https'], neg: ['http'] },
  { pos: ['typescript'], neg: ['javascript'] },
  { pos: ['rust'], neg: ['c', 'c++', 'java'] },
  { pos: ['postgre', 'postgres'], neg: ['mysql', 'mongodb'] },
  { pos: ['graphql'], neg: ['rest', 'restful'] },
  { pos: ['nextjs'], neg: ['react', 'vue'] },
  { pos: ['svelte'], neg: ['react', 'vue'] },
  { pos: ['docker'], neg: ['podman'] },
  { pos: ['kubernetes', 'k8s'], neg: ['docker-compose'] },
  { pos: ['aws'], neg: ['azure', 'gcp'] },
  { pos: ['github'], neg: ['gitlab', 'bitbucket'] },
];

// 相似主题映射（用于跨 subject 检测）
const SIMILAR_SUBJECTS = {
  'prefer-vim': ['prefer-neovim'],
  'prefer-neovim': ['prefer-vim'],
  'use-monolith': ['use-microservices'],
  'use-microservices': ['use-monolith'],
  'must-use-https': ['allow-http', 'use-http'],
  'allow-http': ['must-use-https', 'use-https'],
  'use-typescript': ['use-javascript'],
  'use-javascript': ['use-typescript'],
};

// 改进的矛盾检测函数
function isContradictory(text1, text2, subject1, subject2) {
  // 1. 检查 subject 是否在相似主题映射中
  const subject1Similar = SIMILAR_SUBJECTS[subject1] || [];
  const subject2Similar = SIMILAR_SUBJECTS[subject2] || [];

  const subjectMatch = subject1Similar.includes(subject2) || subject2Similar.includes(subject1);

  // 2. 相同 subject 或相似 subject 才检测
  if (subject1 === subject2 || subjectMatch) {
    // 方法 A: 关键词检测
    if (hasOppositeKeywords(text1, text2)) {
      return true;
    }

    // 方法 B: 直接包含"而不是"、"vs"等矛盾结构
    const hasExplicitContradiction = (t1, t2) => {
      const extractAlternatives = (text) => {
        const patterns = [
          /(.+?)而不是(.+)/,
          /(.+?)vs\.?(.+?)/i,
          /(.+?)和(.+?)之间选择/,
          /(.+?)或(.+?)/,
        ];

        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            return [match[1].trim(), match[2].trim()];
          }
        }
        return null;
      };

      const alternatives1 = extractAlternatives(t1);
      const alternatives2 = extractAlternatives(t2);

      if (alternatives1 && alternatives2) {
        // 交换检查
        if (alternatives1[0] === alternatives2[1] || alternatives1[1] === alternatives2[0]) {
          return true;
        }
      }

      return false;
    };

    if (hasExplicitContradiction(text1, text2)) {
      return true;
    }
  }

  return false;
}

// 检测反义词对
function hasOppositeKeywords(text1, text2) {
  for (const { pos, neg } of OPPOSITE_PAIRS) {
    for (const posWord of pos) {
      for (const negWord of neg) {
        const posRegex = new RegExp(posWord, 'i');
        const negRegex = new RegExp(negWord, 'i');

        if (posRegex.test(text1) && negRegex.test(text2)) return true;
        if (negRegex.test(text1) && posRegex.test(text2)) return true;
      }
    }
  }

  return false;
}

// 余弦相似度计算
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 语义矛盾检测（使用 embedding）
async function isSemanticContradictory(text1, text2, embedder) {
  try {
    const embed1 = await embedder.embed(text1);
    const embed2 = await embedder.embed(text2);
    const similarity = cosineSimilarity(embed1, embed2);

    // 如果相似度在中等范围（0.3-0.6），可能是矛盾
    // 太相似（> 0.6）= 同义
    // 太不相似（< 0.3）= 无关
    if (similarity >= 0.3 && similarity <= 0.6) {
      // 进一步验证：检查是否包含反义词
      return hasOppositeKeywords(text1, text2);
    }

    return false;
  } catch (e) {
    return false;
  }
}

// 矛盾记忆解析
async function resolveContradictions(memoryStore, allMemories, log, embedder) {
  const groups = {};
  const resolved = { conflicts: 0, resolved: 0 };

  // 按 kind 分组（而不是 subject）
  for (const memory of allMemories) {
    if (memory.status !== 'active') continue;
    const key = memory.kind;
    if (!groups[key]) groups[key] = [];
    groups[key].push(memory);
  }

  // 检测矛盾
  for (const [kind, memories] of Object.entries(groups)) {
    if (memories.length < 2) continue;

    const contradictions = await detectContradictionsInGroup(memories, embedder);
    resolved.conflicts += Math.floor(contradictions.length / 2);

    if (contradictions.length > 0) {
      // 解决策略：选择访问次数多、置信度高的
      const winner = contradictions.sort((a, b) => {
        const scoreA = (a.accessCount || 0) * a.confidence;
        const scoreB = (b.accessCount || 0) * b.confidence;
        return scoreB - scoreA;
      })[0];

      const losers = contradictions.filter(m => m.id !== winner.id);

      for (const loser of losers) {
        try {
          await memoryStore.revoke({
            id: loser.id,
            reason: `与 [${winner.id}] 矛盾`,
          });

          // 更新 winner 的 supersedes
          await memoryStore.upsert({
            id: winner.id,
            supersedes: [
              ...(winner.supersedes || []),
              loser.id,
            ],
          });

          log(`[governance] 矛盾已解决: ${loser.id} → ${winner.id}`);
          resolved.resolved++;
        } catch (e) {
          log(`[governance] 解决矛盾失败: ${e.message}`);
        }
      }
    }
  }

  return resolved;
}

// 检测组内的矛盾
async function detectContradictionsInGroup(memories, embedder) {
  const contradictory = [];

  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const mem1 = memories[i];
      const mem2 = memories[j];

      // 检测关键词矛盾
      if (isContradictory(mem1.content, mem2.content, mem1.subject, mem2.subject)) {
        contradictory.push(mem1);
        contradictory.push(mem2);
        continue;
      }

      // 如果有 embedder，检测语义矛盾
      if (embedder) {
        const isSemanticConflict = await isSemanticContradictory(
          mem1.content,
          mem2.content,
          embedder
        );

        if (isSemanticConflict) {
          contradictory.push(mem1);
          contradictory.push(mem2);
        }
      }
    }
  }

  return contradictory;
}

// 创建治理器
export function createMemoryGovernance({ memoryStore, log }) {
  return {
    // 执行治理
    async runGovernance({ dryRun = false } = {}) {
      const result = {
        scanned: 0,
        expired: 0,
        archived: 0,
        markedForReview: 0,
        conflicts: 0,
        resolved: 0,
        deleted: 0,
        errors: 0,
      };

      log('[governance] 开始执行治理...');

      try {
        const allMemories = await memoryStore.query({ limit: 1000 });
        const activeMemories = allMemories.items.filter(m => m.status === 'active');
        const now = Date.now();

        result.scanned = activeMemories.length;

        log(`[governance] 总记忆: ${result.scanned}，活跃: ${activeMemories.length}`);

        // 检测矛盾记忆
        log('[governance] 检测矛盾记忆...');
        const conflictResolution = await resolveContradictions(
          memoryStore,
          activeMemories,
          log,
          null // 暂时不用 embedder
        );
        result.conflicts = conflictResolution.conflicts;
        result.resolved = conflictResolution.resolved;

        // 应用过期规则
        log('[governance] 应用过期规则...');
        for (const rule of EXPIRATION_RULES) {
          for (const memory of activeMemories) {
            try {
              if (rule.condition(memory, now, activeMemories)) {
                if (dryRun) {
                  log(`[governance] [干运行] ${rule.name}: ${memory.id}`);
                  continue;
                }

                switch (rule.action) {
                  case 'expire':
                    await memoryStore.archive(memory.id);
                    result.expired++;
                    break;
                  case 'archive':
                    await memoryStore.archive(memory.id);
                    result.archived++;
                    break;
                  case 'review':
                    await memoryStore.upsert({
                      id: memory.id,
                      status: 'pending_review',
                    });
                    result.markedForReview++;
                    break;
                  case 'conflict':
                    // 已经在 resolveContradictions 中处理
                    break;
                }

                log(`[governance] ${rule.name}: ${memory.id} (${rule.reason(memory, activeMemories)})`);
              }
            } catch (e) {
              log(`[governance] 应用规则失败: ${e.message}`);
              result.errors++;
            }
          }
        }

        // 清理历史版本
        log('[governance] 清理历史版本...');
        const allMetas = await memoryStore._loadAllMetas();
        for (const [id, revisions] of Object.entries(allMetas)) {
          if (revisions.length > 3) {
            const toDelete = revisions.slice(3);
            for (const rev of toDelete) {
              if (dryRun) {
                log(`[governance] [干运行] 删除历史版本: ${rev.path}`);
                continue;
              }

              try {
                await memoryStore._deleteFile(rev.path);
                result.deleted++;
              } catch (e) {
                log(`[governance] 删除历史版本失败: ${e.message}`);
                result.errors++;
              }
            }
          }
        }

        log(`[governance] 治理完成: 过期=${result.expired}, 归档=${result.archived}, 标记审查=${result.markedForReview}, 矛盾=${result.conflicts}, 已解决=${result.resolved}, 删除=${result.deleted}, 错误=${result.errors}`);
      } catch (e) {
        log(`[governance] 治理失败: ${e.message}`);
        result.errors++;
      }

      return result;
    },

    // 手动清理
    async manualCleanup({ days = 90, force = false } = {}) {
      const result = {
        scanned: 0,
        expired: 0,
        archived: 0,
        deleted: 0,
      };

      try {
        const allMemories = await memoryStore.query({ limit: 1000 });
        const cutoffDate = new Date(Date.now() - days * 86400000);

        for (const memory of allMemories.items) {
          result.scanned++;

          const updatedAt = new Date(memory.updatedAt);
          const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / 86400000;

          if (daysSinceUpdate > days) {
            if (force || memory.confidence < 0.6) {
              await memoryStore.archive(memory.id);
              result.archived++;
            }
          }
        }
      } catch (e) {
        log(`[governance] 手动清理失败: ${e.message}`);
      }

      return result;
    },
  };
}