---
name: 🐛 Bug 报告
about: 报告 daemon / Agent / Discord 桥接的 Bug
title: "[Bug] "
labels: bug
assignees: ""
---

## 问题描述

简要清晰地说清楚 Bug 是什么。

## 复现步骤

1. 执行命令 `...`
2. 在 Discord `#...` 频道发送 `...`
3. 看到错误 / 异常行为：...

## 期望行为

你认为正确的内容 / 行为应该是什么。

## 实际行为

实际看到的错误 / 输出。**附关键日志**：

```
# ~/pi-discord-agents/logs/orchestrator.log 最后 ~30 行
```

或 `launchctl print gui/$(id -u)/com.zhangsan.pi-discord-agents` 的相关输出。

## 环境信息

- 操作系统：[例如 macOS 14.5]
- Node 版本：`node --version`
- Pi Agent 版本：`npm ls -g @earendil-works/pi-coding-agent`
- 多 Agent 开关：`MULTI_AGENT_ENABLED=true / false`
- 触发模式：`!watch / !archive / !memory / !opportunity / 定时任务`

## 截图 / 录屏（如适用）

Discord 截图或终端录屏。

## 附加信息

任何有助于定位问题的额外信息（例如是否首次出现、最近改过什么）。