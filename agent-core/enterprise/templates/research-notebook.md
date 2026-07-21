# research-notebook 模板

> 算法预研笔记，每个算法一个目录 `research/alg-XX-name/`，目录下含本笔记。  
> 写法：过程可被后来人复现。

## 文件头

```yaml
project: PRJ-2026-0001
alg_id: alg-01
alg_name: FAQ intent classifier
author: solution-agent
reviewer: chief-agent
date: 2026-07-19
```

## 1. 目标

- 输入：客户自然语言问句
- 输出：FAQ 类别 / 是否需要转人工
- 指标：top-1 准确率、PR-召回、转人工识别率

## 2. 数据

- 真实语料：脱敏后约 1200 条
- 合成语料：约 400 条
- 评估集：200 条

## 3. 候选方法

| 方法 | 数据量 | 准确率 | 成本 | 备注 |
|---|---|---|---|---|
| 关键词匹配 | 1200 | 62% | 0 | baseline |
| TF-IDF + SVM | 1200 | 74% | 0 | — |
| GLM-4.5 zero-shot | 200 | 81% | 高 | — |
| 微调 BERT | 1200 | 88% | 中 | 需 GPU |

## 4. 关键发现

- 关键词匹配对 4 类高频问题足够；
- 客户偏好需要单独训练；
- LLM zero-shot 在小语料上泛化最好。

## 5. 失败案例

| 输入 | 期望 | 实际 | 根因 |
|---|---|---|---|
| “我付了钱怎么办” | order-status | return-policy | 词汇歧义 |

## 6. 结论

- 采用 **关键词 + GLM-4.5 兜底** 的混合方案；
- 不需要 GPU；
- 下一阶段做 A/B。

## 7. 给研发的输入

- 关键词词典；
- zero-shot Prompt；
- 评估脚本；
- 与订单 API 的对接位置。
