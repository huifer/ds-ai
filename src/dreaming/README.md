# 「遐思」(Xiasi) — 背景记忆整合系统

> 凌晨 3:30,Pi 闭上"眼睛",开始漫游你的记忆。  
> 04:15,你在 Discord 收到一条 `✨ 遐思·连珠 · 完成`。

## 是什么

「遐思」是从 OpenClaw Dreaming 借鉴、并为这个项目独立设计的背景记忆整合系统。  
它让 Pi Agent 在你睡觉时主动做四类"梦",产出**完全独立于主记忆**的"遐思产物"。

## 不污染主记忆(核心承诺)

| 文件位置 | 写入方 | 读取方 |
|---|---|---|
| `data/memory/` | `memory-store.upsert()` | `dreaming/` **只读** |
| `data/dreams/` | `dreaming/artifacts.create()` | (反向打通由 `XIASI_FEED_CONTEXT` 控制) |

`src/dreaming/**` 代码**禁止** import `memory-store` 的写入函数。  
唯一搬到主记忆的路径:`scripts/dream-promote.mjs`(手动)。

## 四种梦

| type | 名称 | 风格 |
|---|---|---|
| `lian-zhu` (连珠) | 遐思·连珠 | 轻、跳、跨域自由联想 |
| `gui-cang` (归藏) | 遐思·归藏 | 沉、整、抽象巩固 |
| `ming-tai` (明台) | 遐思·明台 | 深、思、主题清明梦 |
| `yu-yan` (预言) | 遐思·预言 | v2,反事实剧场 |

## 三阶段流水线

```
Light → REM → Deep
  ↓       ↓      ↓
信号    Pi 思考  评分 + 写产物
```

## 调度

| 时间 (北京时间 UTC+8) | 阶段 |
|---|---|
| 03:30 | 遐思·连珠 |
| 03:45 | 遐思·归藏 |
| 04:00 | 遐思·明台 |
| 04:15 | Deep 评分 + 写入 |
| 08:00 | daily-summary 追加「昨夜遐思一行」 |
| 每周日 08:00 | 周报推送 |

## 成本控制

- 单次梦 wall-clock ≤ 15 min
- 单次梦 LLM call ≤ 8
- 每日总 token ≤ `XIASI_DAILY_TOKEN_BUDGET`(默认 5,000,000)
- 超限不报错,推一条 `🌕 梦境已满,余梦待明日`

## 启用

1. 在 Discord 创建 `#遐思` 频道
2. 复制频道 ID 到 `.env`:`CH_XIASI=...`
3. 打开开关:`XIASI_ENABLED=true`
4. `restart` entry-bot
5. 在主入口发 `!xiasi status` 验证

## 命令

| 命令 | 作用 |
|---|---|
| `!xiasi status` | 最近 N 次梦 + token 用量 |
| `!xiasi on/off` | 紧急开关(本次进程) |
| `!xiasi <type>` | 手动触发(PR2+) |
| `!xiasi archive <id>` | 归档产物(PR4) |
| `!ask-xiasi <q>` | 从产物找答案(只读,PR4) |

## 文件结构

```
src/dreaming/
├── index.mjs              统一入口
├── paths.mjs              路径常量
├── config.mjs             .env → xc
├── dreaming-pi.mjs        独立 Pi RPC 子进程
├── budget.mjs             5M token 预算
├── locks.mjs              文件锁(mkdir 原子)
├── artifacts.mjs          产物读写
├── prompts.mjs            模板加载
├── dreamer.mjs            主入口(编排三阶段)
└── phases/
    ├── light.mjs          PR1 占位
    ├── rem.mjs            PR1 占位
    └── deep.mjs           PR1 占位

data/dreams/
├── .dreams/
│   ├── budget.json
│   ├── runs/<YYYY-MM-DD>/<id>.json
│   └── locks/
├── DREAMS.md
└── artifacts/<type>/<id>.md

sessions/dreams/          Pi 自动写
```

## PR 路线图

- [x] **PR1** — 基础设施(本 PR)
- [ ] **PR2** — Light + REM + 遐思·连珠(端到端最小闭环)
- [ ] **PR3** — 遐思·归藏 + 遐思·明台 + 5 信号评分 + 影子试用
- [ ] **PR4** — Discord 投票 + 周报/月报 + 故障仪式化 + !ask-xiasi
- [ ] **v2** — 遐思·预言(反事实剧场)