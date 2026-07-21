# 内容流水线合同 · Content Pipeline

> 定义 7 个内容 Agent 的数据流、工件格式、状态机与命令契约。
> 实现：`src/runtime/commands/content.mjs`
> 路由：`src/runtime/agent-manager.mjs`

---

## 1. 流水线总览

```text
!intake now <素材>
    ↓ 产出 MAT-YYYYMMDD-XXXX（inbox/）
!distill now --mat=<MAT-ID>
    ↓ 产出 CNT-YYYYMMDD-XXXX（candidates/），含 8 维评分
!privacy check --cnt=<CNT-ID>
    ↓ 脱敏：phone/email/api-key/internal-path 正则替换
!fact check --cnt=<CNT-ID>
    ↓ 事实核查：逐句检查 url/commit-hash/number 证据
!render platform=<platform> --cnt=<CNT-ID>
    ↓ 产出 RND-YYYYMMDD-XXXX（renders/），含 Markdown + 同名 .md 文件
!publish platform=<platform> --rnd=<RND-ID>
    ↓ 审批门禁 → 产出 PUB-YYYYMMDD-XXXX（published/）
!qa last --pub=<PUB-ID>
    ↓ 产出 QA-YYYYMMDD-XXXX（qa/），8 项质量检查
```

## 2. 数据目录

```text
data/content/
├── inbox/         MAT-*.json     原始素材
├── candidates/    CNT-*.json     蒸馏候选（含评分/隐私/事实）
├── renders/       RND-*.json     渲染产物元数据
│                RND-*.md         渲染 Markdown 文件
├── published/     PUB-*.json     发布记录
└── qa/            QA-*.json      QA 报告
```

## 3. 工件格式

### 3.1 Material（inbox）

```json
{
  "id": "MAT-20260719-XXXX",
  "type": "material",
  "createdAt": "ISO",
  "source": "discord",
  "channelId": "CH_...",
  "userId": "U-...",
  "rawText": "原始素材全文",
  "status": "intaked"
}
```

### 3.2 Candidate（candidates）

```json
{
  "id": "CNT-20260719-XXXX",
  "type": "candidate",
  "createdAt": "ISO",
  "materialId": "MAT-...",
  "title": "标题（取素材首行前 60 字）",
  "content": "脱敏后正文",
  "rawContent": "脱敏前正文",
  "privacyFindings": [{ "type": "phone", "count": 1 }],
  "factCheck": { "totalClaims": 3, "supported": 2, "unsupported": 1, "passed": true },
  "score": {
    "scores": { "authenticity": 4, "evidence": 5, ... },
    "total": 33,
    "max": 40
  },
  "status": "ready | needs-review | privacy-fixed",
  "platforms": ["wechat", "xiaohongshu", "x", "newsletter"]
}
```

### 3.3 Render（renders）

```json
{
  "id": "RND-20260719-XXXX",
  "type": "render",
  "createdAt": "ISO",
  "candidateId": "CNT-...",
  "platform": "wechat | x | newsletter | ...",
  "body": "完整 Markdown 字符串",
  "bytes": 12345,
  "status": "rendered"
}
```

同名 `.md` 文件写入 `renders/RND-*.md`。

### 3.4 Publish（published）

```json
{
  "id": "PUB-20260719-XXXX",
  "type": "publish",
  "createdAt": "ISO",
  "renderId": "RND-...",
  "candidateId": "CNT-...",
  "platform": "wechat",
  "status": "published",
  "externalUrl": null
}
```

### 3.5 QA Report（qa）

```json
{
  "id": "QA-20260719-XXXX",
  "type": "qa",
  "createdAt": "ISO",
  "publishId": "PUB-...",
  "checks": {
    "hasTitle": true,
    "hasContent": true,
    "privacyClean": true,
    "factChecked": true,
    "scorePassed": true,
    "hasBody": true,
    "hasAlt": false,
    "hasFooter": true
  },
  "passed": 7,
  "total": 8,
  "verdict": "pass | pass-with-warnings | fail"
}
```

## 4. 8 维评分

| 维度 | 满分 | 骨架默认值 |
|---|---|---|
| authenticity（真实性） | 5 | 4 |
| evidence（证据） | 5 | hasEvidence ? 5 : 2 |
| audience-value（受众价值） | 5 | len>100 ? 4 : 3 |
| novelty（新颖性） | 5 | 3 |
| brand-fit（品牌一致） | 5 | 4 |
| virality（可传播） | 5 | hasEvidence ? 4 : 2 |
| reusability（可复用） | 5 | 4 |
| privacy-safety（保密安全） | 5 | clean ? 5 : 3 |

- **≥ 32** → 推荐（`verdict = 推荐`）
- **24-31** → 入池（`verdict = 入池`）
- **< 24** → 知识（`verdict = 知识`）

## 5. 隐私脱敏规则

| 类型 | 正则 | 替换 |
|---|---|---|
| phone | `1[3-9]\d{9}` | `<phone>` |
| email | `[\w.+-]+@[\w-]+\.[\w.-]+` | `<email>` |
| api-key | `(api[_-]?key\|token\|secret\|password)\s*[=:]\s*["']?[\w-]{16,}` | `<redacted:api-key>` |
| internal-path | `/Users/[\w.-]+/` | `<internal-path>/` |

## 6. 事实核查规则

逐句（按 `。.!！\n` 分割）检查：

| 证据类型 | 正则 |
|---|---|
| url | `https?://[\w.-]+[^\s]*` |
| commit-hash | `[0-9a-f]{7,40}` |
| number | `\d{2,}` |

- 有任一证据 → `supported`
- 无证据 → `unsupported`
- `unsupported ≤ 30%` → `passed = true`

## 7. 审批门禁

| 命令 | ApprovalKind | 触发条件 |
|---|---|---|
| `!publish` | `publish-domestic` | 国内平台 |
| `!publish` | `publish-overseas` | 海外平台（待加） |

审批通过后，`Approval.grant()` 返回 `{ ok: true, decision: 'approve' }`，然后可重新执行 `!publish`。

## 8. 渲染 Markdown 设计

- 基于 `agent-core/design/tokens.css` 的品牌色
- 国内（wechat/xiaohongshu/...）→ `杭州 OPC 张三` + `#0ea5e9`
- 海外（x/newsletter/...）→ `Zenbuild` + `#6366f1`
- 必须包含：Hero 头图区、StatCard 数据行、Body 正文、CTA 行动按钮、Footer 版权
- 版权格式：`© <year> <brand> · All rights reserved`

## 9. 命令契约

```text
!intake now <素材文本>
!intake now --source="..." --note="..."
!distill now                         # 蒸馏最新素材
!distill now --mat=MAT-XXXX          # 蒸馏指定素材
!privacy check                       # 检查最新候选
!privacy check --cnt=CNT-XXXX        # 检查指定候选
!fact check                          # 核查最新候选
!fact check --cnt=CNT-XXXX           # 核查指定候选
!render platform=<platform>          # 渲染最新候选
!render platform=<platform> --cnt=CNT-XXXX
!publish platform=<platform>         # 发布最新渲染
!publish platform=<platform> --rnd=RND-XXXX
!qa last                             # QA 最新发布
!qa last --pub=PUB-XXXX              # QA 指定发布
```

## 10. Agent → Skill 映射

| Agent | Skill（路由） | 函数 |
|---|---|---|
| intake | daily-intake | `intakeNow()` |
| distill | distill-run | `distillRun()` |
| privacy | privacy-redact | `privacyCheck()` |
| fact-check | fact-check | `factCheck()` |
| renderer | platform-render | `renderPlatform()` |
| publisher | platform-publish | `publishPlatform()` |
| qa | qa-report | `qaReport()` |

## 11. 升级路径（Pi Agent RPC）

当前骨架阶段，所有 7 个阶段均为本地 mock 实现（正则 + 模板）。
接入 Pi Agent RPC 后：
1. `intakeNow()` → Pi Agent 从 GitHub/Discord/飞书拉取真实素材
2. `distillRun()` → Pi Agent LLM 蒸馏 + 评分
3. `privacyCheck()` → Pi Agent LLM 上下文脱敏（比正则更准）
4. `factCheck()` → Pi Agent + Web Search 验证
5. `renderPlatform()` → Pi Agent 生成定制 Markdown
6. `publishPlatform()` → 真实 API 发布
7. `qaReport()` → Pi Agent + 真实数据回收

升级时只需替换 `content.mjs` 中的函数实现，路由和命令契约不变。
