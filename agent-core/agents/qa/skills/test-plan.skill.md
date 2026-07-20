---
name: test-plan
agent: qa
description: 项目测试计划（基于 PRD 的测试用例与覆盖策略）
---

# Test Plan（测试计划）

触发：`!qa plan <PRJ-ID>`

## 流程
1. 读 PRD（`accounts/<account>/projects/<PRJ>/prd.md`）取功能与验收标准。
2. 生成测试计划：
   - **功能测试用例**（按功能模块，输入/预期/优先级）
   - **集成测试**（接口 / 数据流）
   - **非功能测试**（性能 / 安全 / 兼容）
   - **UAT 验收场景**
   - **覆盖策略**与测试环境 / 数据准备
3. 标注与 `acceptance` 验收标准的对应关系。

## 落盘
`data/business/accounts/<account-id>/projects/<PRJ-ID>/qa/test-plan.md`

## 回复
测试计划摘要（用例数 / 覆盖 / 关键风险）；提示 `!qa accept` 验收、`!qa defect` 登记缺陷。
