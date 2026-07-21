# 重启后完整测试列表

> 生成时间：2026-07-20
> Bot PID：23423
> 测试目标：验证本次所有代码改动在生产环境下正常工作

---

## 测试方法

在任意 Discord 频道向 Bot 发命令，观察回复。

- ✅ 回复符合预期 → 通过
- ❌ 回复错误 / 超时 30s 无响应 → 记录截图

---

## 第一批：核心基础命令（立即验证）

这批命令**不依赖 Pi RPC**，本地直接执行，应在 5 秒内响应。

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!state` | 19 个 Agent 的状态表，含 `lastError` 列 | 能看到 chief/sales/pm 等各 agent 的在线状态 |
| `!cost` | Token 用量摘要（来自 `data/token-usage/*.md`） | 显示日期 + 模型 + token 数 |
| `!status` | Bot 基本状态 | 正常运行 |
| `!pr list` | 项目列表（来自 `data/business/projects/index.yaml`） | 显示已有项目名和 ID |
| `!restart` | `OK` | 不自动重启，仅提示手动 restart 方式 |
| `!memory` | `data/memory/` 摘要 | 显示 store/journal/snapshots 内容 |

---

## 第二批：Lead 流程（Sales Agent，Pi RPC）

> 路径：`!lead new <公司> <行业> <描述>` → Pi RPC → 写 `data/business/leads/LEAD-*.json`

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!lead new 百度 saas 做大模型客服` | `OK via=pi-rpc lead-capture.skill.md` | Pi 收到 SOP，写入 lead 文件 |
| `!lead list` | Lead 列表 | 显示刚创建的 Lead |
| `!lead qualify LEAD-2026-XXX` | Pi RPC qualification 结果 | 填写行业/规模/痛点字段 |

---

## 第三批：项目流程（PM Agent，本地 + Pi RPC）

> `!pr new` 是本地实现（写 `index.yaml`）；`!prd` / `!plan` / `!raid` 走 Pi RPC

**本地命令（应秒回）：**

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!pr new 字节跳动 saas 做AI客服` | 输出项目 ID（如 `PRJ-2026-XXX`）和目录路径 | `data/business/projects/` 下出现新目录 |
| `!pr list` | 更新后的项目列表 | 包含刚创建的项目 |

**Pi RPC 命令（5-30s）：**

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!prd v0.1 <PRJ-ID>` | `OK via=pi-rpc prd-v01.skill.md` | Pi 生成 PRD 草稿 |
| `!plan build <PRJ-ID>` | `OK via=pi-rpc plan-build.skill.md` | Pi 生成开发计划 |
| `!plan weekly <PRJ-ID>` | `OK via=pi-rpc weekly-report.skill.md` | Pi 生成周报 |
| `!raid <PRJ-ID>` | `OK via=pi-rpc raid.skill.md` | Pi 生成 RAID 记录 |
| `!stage <PRJ-ID>` | `OK via=pi-rpc stage-gate.skill.md` | Pi 生成阶段门评审 |

---

## 第四批：Solution Agent（Pi RPC）

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!solution discovery <LEAD-ID>` | `OK via=pi-rpc discovery.skill.md` | Pi 生成需求发现记录 |
| `!research <LEAD-ID>` | `OK via=pi-rpc research-notebook.skill.md` | Pi 生成调研笔记 |
| `!prd diff <PRJ-ID>` | `OK via=pi-rpc prd-diff.skill.md` | Pi 比对 PRD 版本差异 |
| `!runtime research <PRJ-ID>` | `OK via=pi-rpc runtime-research.skill.md` | Pi 生成运行时调研报告 |

---

## 第五批：Cost → Quote → Bid → Contract 流程

### 5.1 成本估算（Cost Agent）

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!cost estimate <PRJ-ID>` | `OK via=pi-rpc estimate.skill.md`（内部 agent，不暴露命令） | Pi 生成成本估算 |

### 5.2 报价（Quote Agent）

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!quote draft <PRJ-ID>` | `OK via=pi-rpc estimate.skill.md` → 生成报价草稿 | `data/business/quotes/` 下出现草稿 |
| `!quote set <PRJ-ID> 50000` | `OK via=pi-rpc discount.skill.md` | Pi 写入折扣后的报价 |
| `!quote approve <PRJ-ID>` | `NEED_APPROVAL` ⚠️ | 需要审批，不直接外发 |

### 5.3 投标（Bid Agent）

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!bid start <PRJ-ID>` | `OK via=pi-rpc tender-ingestion.skill.md` | Pi 读取招标文件 |
| `!bid compliance <PRJ-ID>` | `OK via=pi-rpc compliance-matrix.skill.md` | Pi 生成合规矩阵 |
| `!bid submit <PRJ-ID>` | `NEED_APPROVAL` ⚠️ | 需要审批，不直接提交 |

### 5.4 合同（Contract Agent）

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!contract new <PRJ-ID>` | `OK via=pi-rpc contract-summarize.skill.md` | Pi 生成合同摘要 |
| `!contract risk <PRJ-ID>` | `OK via=pi-rpc risk-register.skill.md` | Pi 生成风险登记册 |
| `!contract sign <PRJ-ID>` | `NEED_APPROVAL` ⚠️ | 需要审批，不直接签署 |

---

## 第六批：交付 + 客服 + 财务

### 6.1 交付（Delivery Agent）

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!poc start <PRJ-ID>` | `OK via=pi-rpc poc-plan.skill.md` | Pi 生成 POC 计划 |
| `!poc deploy <PRJ-ID>` | `NEED_APPROVAL` ⚠️（prod-deploy 需审批） | 需要 Chief 审批 |
| `!incident new <PRJ-ID> 数据库挂了` | `OK via=pi-rpc incident.skill.md` | Pi 生成事故记录 |
| `!incident resolve INC-XXX` | `OK via=pi-rpc incident.skill.md` | Pi 关闭事故单 |
| `!integration <PRJ-ID>` | `OK via=pi-rpc integration.skill.md` | Pi 生成集成方案 |
| `!runbook <PRJ-ID>` | `OK via=pi-rpc runbook.skill.md` | Pi 生成运维手册 |

### 6.2 客服（CS Agent）

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!cs health <PRJ-ID>` | `OK via=pi-rpc health-report.skill.md` | Pi 生成健康报告 |
| `!cs qbr <PRJ-ID>` | `OK via=pi-rpc qbr.skill.md` | Pi 生成季度业务评审 |
| `!cs document <PRJ-ID> 泄密了` | `OK via=pi-rpc knowledge-redact.skill.md` | Pi 生成脱敏处理记录 |
| `!cs renewal <PRJ-ID>` | `OK via=pi-rpc renewal-brief.skill.md` | Pi 生成续约简报 |
| `!cs case-study <PRJ-ID>` | `OK via=pi-rpc case-study.skill.md` | Pi 生成案例研究 |

### 6.3 财务（Finance Agent）

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!invoice request <PRJ-ID>` | `NEED_APPROVAL` ⚠️（invoice-approval 需审批） | 需要 Chief 审批 |
| `!invoice remind <PRJ-ID>` | `OK via=pi-rpc reminder.skill.md` | Pi 发送催款提醒 |
| `!finance margin <PRJ-ID>` | `OK via=pi-rpc margin-report.skill.md` | Pi 生成毛利率报告 |
| `!finance cashflow` | `OK via=pi-rpc cash-flow.skill.md` | Pi 生成现金流报告 |

---

## 第七批：Intake + Distill + QA + Chief

### 7.1 Intake Agent

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!intake daily` | `OK`（本地 cron 任务，23:50 自动跑） | 检查 `data/business/intake/` 有新文件 |
| `!intake process <CHANNEL-ID>` | 汇总 channel 内容 | 生成 intake 摘要 |

### 7.2 Distill Agent

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!distill run` | `OK`（本地实现） | 更新 distill 结果 |
| `!distill brief` | 本地汇总 | 生成简短摘要 |

### 7.3 QA Agent

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!qa report <PRJ-ID>` | 本地实现（读 dist/ 测试结果） | 显示测试覆盖率 |
| `!qa plan <PRJ-ID>` | `OK via=pi-rpc test-plan.skill.md` | Pi 生成测试计划 |
| `!qa accept <PRJ-ID>` | `OK via=pi-rpc acceptance.skill.md` | Pi 生成验收报告 |
| `!qa defect <PRJ-ID> 发现了 BUG` | `OK via=pi-rpc defect.skill.md` | Pi 生成缺陷记录 |

### 7.4 Chief Agent

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!approval handle <TASK-ID> approve` | 处理挂起的审批 | 更新审批状态 |
| `!chief restart` | `OK via=pi-rpc restart.skill.md` | 写入重启标记 |

---

## 第八批：内容流水线（Coding + Renderer + Publisher + Privacy + Fact-check）

> 这些 Agent 的核心命令是**本地实现**（`_dispatchContent`），不走 Pi RPC

### 8.1 Coding Agent

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!coding new <描述>` | 本地生成 React 项目代码 | 输出项目目录路径 |
| `!coding status` | 当前任务状态 | 显示队列情况 |

### 8.2 Renderer Agent

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!render <PRJ-ID> <平台>` | 本地渲染 HTML → 图片 | 生成 PNG/PDF |
| `!render publish <PRJ-ID>` | 上传到飞书/妙搭 | 返回发布链接 |

### 8.3 Publisher Agent

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!publish <PRJ-ID> <平台>` | 发布到目标平台 | 返回发布状态 |

### 8.4 Privacy Agent

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!privacy redact <内容>` | 本地脱敏处理 | 返回脱敏后内容 |

### 8.5 Fact-check Agent

| 命令 | 预期回复 | 验证要点 |
|------|---------|---------|
| `!fact-check <陈述>` | 本地事实核查 | 返回核查结果 |

---

## 审批流专项测试

> 以下命令**正确行为**是返回 `NEED_APPROVAL`，而不是直接执行

| 命令 | 预期回复 | 说明 |
|------|---------|------|
| `!quote approve <PRJ-ID>` | `NEED_APPROVAL` | 报价审批，必须走 Chief |
| `!bid submit <PRJ-ID>` | `NEED_APPROVAL` | 投标提交，必须走 Chief |
| `!contract sign <PRJ-ID>` | `NEED_APPROVAL` | 合同签署，必须走 Chief |
| `!poc deploy <PRJ-ID>` | `NEED_APPROVAL` | 生产部署，必须走 Chief |
| `!invoice request <PRJ-ID>` | `NEED_APPROVAL` | 开票申请，必须走 Chief |

→ 如果回复 `OK`，说明审批 gate 未生效，需要立即报告。

---

## 异常情况测试

| 场景 | 命令 | 预期行为 |
|------|------|---------|
| 项目不存在时写文件 | `!prd v0.1 NOTEXIST` | 返回 ERROR（safePrjPath throw "未找到项目"） |
| Pi RPC 不可用 | 任意 Pi RPC 命令 | 返回 ERROR with "Pi RPC 不可用" |
| 无效命令 | `!fake command` | 返回 ERROR "未知命令" |
| 参数缺失 | `!lead new` | 返回 ERROR "参数不足" |

---

## 测试记录模板

```
日期：_______
Bot PID：_______
测试人：_______

[PASS] !state
[PASS/FAIL] !cost
[PASS/FAIL] !lead new ...
[PASS/FAIL] !pr new ...
...
```

---

## 问题上报

发现 FAIL 时，附上：
1. Bot 回复截图
2. `logs/orchestrator.log` 对应时间段的日志：`tail -50 logs/orchestrator.log`
3. 若 Pi RPC 相关，还需：`tail -50 logs/pi-rpc.log`（如有）
