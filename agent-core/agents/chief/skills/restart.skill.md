---
name: restart
agent: chief
description: 守护进程重启（安全：不自动终止进程）
---

# Restart（守护进程重启）

触发：`!restart`

## ⚠️ 安全策略
本 skill **不自动终止进程**（避免响应中断 / 误杀 / RPC 子进程无法重启父进程）。
仅**记录重启请求**并提示运维手动执行。

## 流程
1. 写重启请求标记 `data/restart-requested.flag`（含时间 / 请求人 / 原因）。
2. 回复提示运维执行：
   ```
   bash scripts/stop.sh && bash scripts/launch.sh
   ```
3. 说明机制：本守护进程由 **launchd KeepAlive** 管理，`stop.sh` 优雅停止后 `launch.sh` 重新拉起，新代码即刻生效。

## 回复
```
🔄 已记录重启请求（data/restart-requested.flag）
请运维执行：bash scripts/stop.sh && bash scripts/launch.sh
（launchd KeepAlive 会自动拉起新进程，加载最新代码）
```
## 备注
若未来要做「真正自动重启」，应在 entry-bot 主循环检测 `restart-requested.flag` 后优雅退出，由 launchd 拉起——需改 entry-bot，不宜交给 Pi RPC 自动 kill 进程。
