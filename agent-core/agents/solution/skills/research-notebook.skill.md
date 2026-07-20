---
name: research-notebook
agent: solution
description: 行业/技术调研笔记本，供 PRD 填充引用
---

# Research Notebook（调研笔记本）

触发：
- `!research new <主题>` — 新建调研
- `!research update <主题>` — 更新已有调研

## 流程
1. **调研**：围绕主题（行业现状、主要玩家、技术方案、趋势、关键数据）。
   - 优先读 `agent-core/enterprise/industries/<相关行业>/` 下既有材料
   - 可调用 web 检索补充，每条结论标注来源链接
2. **落盘**：`mkdir -p data/business/research`，写入 `data/business/research/<slug>.md`（slug 为主题的短英文标识）：
```markdown
# 调研 · <主题>
> 更新时间 / 状态: draft|verified
## 现状
## 主要玩家
## 技术方案
## 趋势与数据
## 来源
- [1] <url>
```
3. **回复**：调研摘要 + slug，提示「!prd v0.1 <PRJ-ID> 时会自动引用」。

## 约束
- 不臆造数据；无来源的判断标 `推断`。
- 已核验与未核验内容分开。
