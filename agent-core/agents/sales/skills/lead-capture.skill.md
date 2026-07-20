---
name: lead-capture
agent: sales
description: 录入新的销售线索
---

# Lead Capture（销售线索录入）

触发：`!lead new <自然语言描述>`。

## 1. 信息提取
从用户描述中提取以下字段，缺失的标 `待补`：
- `company` 公司名
- `contact` 联系人 / 联系方式
- `source` 来源（官网 / 推荐 / 活动 / 冷启动 / 其他）
- `need` 需求简述
- `industry` 行业（参考 `agent-core/enterprise/industries/` 目录）
- `budget` 预算（如提及）

## 2. 落盘
用 bash/file 工具写入 `data/business/leads/LEAD-YYYYMMDD-XXXX.json`（`XXXX` 为 4 位随机数字，YYYYMMDD 为今天）。
先 `mkdir -p data/business/leads`。JSON 结构：

```json
{
  "id": "LEAD-YYYYMMDD-XXXX",
  "company": "...",
  "contact": "...",
  "source": "...",
  "need": "...",
  "industry": "...",
  "budget": "...",
  "stage": "new",
  "createdAt": "<ISO 时间>",
  "raw": "<用户原始描述>"
}
```

## 3. 回复
```
✅ 已录入线索 `LEAD-YYYYMMDD-XXXX`
- 公司：…
- 需求：…
- 来源：…
下一步：!lead qualify LEAD-YYYYMMDD-XXXX（资格判断）或 !disc start LEAD-…（需求发现）
```
