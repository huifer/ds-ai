---
name: discovery
agent: solution
description: 需求发现——从销售线索结构化梳理客户需求
---

# Discovery（需求发现）

触发：
- `!disc start <LEAD-ID>` — 基于线索启动需求发现
- `!disc set <LEAD-ID> <要点描述>` — 补充/修正需求要点

## 1. 读取线索
用 file 工具读 `data/business/leads/<LEAD-ID>.json`。不存在则报错「线索未找到，先 !lead new」。

## 2. 结构化发现（缺项标 `待澄清` 并向用户提问）
逐项梳理：
- **业务目标** 客户想达成什么、可量化的成功指标
- **关键场景** 2-3 个核心使用场景
- **用户角色** 谁使用、权限分层
- **约束** 预算 / 时间窗口 / 技术栈 / 合规
- **现有方案** 客户现状、痛点、竞品参考
- **业务线匹配** 属于 AI 应用 / AI Agent / 自动化工作流 / 软件系统（参考 `CONTEXT.md`）
- **行业** 参考 `agent-core/enterprise/industries/` 目录

## 3. 落盘
`mkdir -p data/business/discovery`，写入 `data/business/discovery/<LEAD-ID>.md`：
```markdown
# 需求发现 · <LEAD-ID>
- 线索: ...
- 业务目标: ...
- 关键场景: ...
- 用户角色: ...
- 约束: ...
- 现有方案: ...
- 业务线 / 行业: ...
- 待澄清问题: ...
```

## 4. 回复
结构化摘要 + 待澄清问题清单。
提示下一步：`!pr new` 创建项目，或 `!research new <主题>` 补充行业调研。
