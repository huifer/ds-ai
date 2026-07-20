---
name: qualification
agent: sales
description: 销售线索资格判断（BANT + 业务匹配）
---

# Lead Qualification（资格判断）

触发：`!lead qualify <LEAD-ID>`。

## 1. 读取
用 file 工具读 `data/business/leads/<LEAD-ID>.json`。不存在则报错「线索 ID 未找到」。

## 2. 评估维度
基于线索内容逐项评估，缺失信息标「未知」并给出补充建议：
- **Budget** 预算线索
- **Authority** 决策权线索
- **Need** 需求强度与紧急度
- **Timing** 时间窗口
- **Fit** 与公司业务的匹配度（参考 `CONTEXT.md`：FDE 企业服务 / AI 开发服务 / 自有 SaaS 产品 三条业务线）

综合给出 `level`（A 优选 / B 可跟进 / C 暂缓 / ✗ 不合格）与 0-100 `score`。

## 3. 落盘
更新 `data/business/leads/<LEAD-ID>.json`，写入：
```json
"qualification": { "level": "A|B|C|✗", "score": 80, "reasoning": "...", "missing": ["预算"] },
"stage": "qualified" | "disqualified"
```

## 4. 回复
```
🔍 LEAD-... 资格判断
等级：B（可跟进）· 分数 65
理由：…
缺失信息：预算、决策人
建议：补充预算后重新评估；匹配业务线：AI 开发服务
```
