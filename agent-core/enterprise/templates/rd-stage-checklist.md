# R&D 阶段清单（Stage 4）

> 用于 FDE 三阶段 SOP 之后的正式研发主链。  
> 每个 PRJ 复制一份到 `data/business/accounts/<account-id>/projects/<PRJ-ID>/build/rd-checklist.md`。

## Project

- PRJ-ID：
- 范围：
- 截止：
- 负责人：
- QA：
- 发布负责人：

## 1. Architecture

- [ ] 业务架构图（PDF / SVG）
- [ ] 数据流图
- [ ] 部署架构图
- [ ] 第三方依赖与限流
- [ ] 失败模式分析
- [ ] 安全与权限模型
- [ ] 成本估算
- [ ] chief-agent 审批

## 2. Coding

- [ ] Coding 规范确认
- [ ] Repository 初始化
- [ ] 依赖锁定
- [ ] CI / Lint / Test 流水线
- [ ] Feature flag 策略
- [ ] 错误码规范
- [ ] 关键模块示例
- [ ] 离线种子数据

## 3. Unit Test

- [ ] 覆盖率目标 ≥ 70%
- [ ] 关键路径 100% 覆盖
- [ ] Mock / Stub 规范
- [ ] 性能基线（单测运行时间）
- [ ] 静态分析（lint / type / secret scan）

## 4. Integration Test

- [ ] E2E 关键路径
- [ ] 失败注入
- [ ] 限流与降级
- [ ] 与 staging 环境对接
- [ ] 客户代表参与验收（>1 客户）

## 5. Release

- [ ] Release Notes
- [ ] 客户 Runbook
- [ ] SLA 文档
- [ ] 监控 / 告警 / On-Call
- [ ] 备份与恢复
- [ ] 合规与隐私审查
- [ ] chief-agent 审批

## 6. Deployment

- [ ] 蓝绿 / 灰度策略
- [ ] 回滚方案
- [ ] 数据迁移（必要时）
- [ ] 客户环境准备
- [ ] 上线后 24h 值守

## 7. Maintenance

- [ ] 值班手册
- [ ] 升级流程
- [ ] 知识回流到 cs-agent
- [ ] 反馈到 research/ 与 kp-XX.md
- [ ] 月度复盘

## 出口

- 客户签收 + 验收报告 → `acceptance/`；
- 经验回流 → `knowledge-pack/` 与 research/；
- 公开内容候选 → `#主快讯`。
