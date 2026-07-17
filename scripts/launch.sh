#!/bin/bash
# ~/pi-discord-agents/scripts/launch.sh
#
# 启动 entry-bot(RPC 模式)。
# launchd 不需要保活:entry-bot 自己管理 Discord + Pi 子进程生命周期;
# 如果 bot 崩溃,launchd ThrottleInterval(15s)后重启。
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/zhangsan/.nvm/versions/node/v24.15.0/bin:$PATH"
export HOME="$HOME"
export NODE_PATH="/Users/zhangsan/.nvm/versions/node/v24.15.0/lib/node_modules:${NODE_PATH:-}"

ROOT="/Users/zhangsan/pi-discord-agents"
LOG="$ROOT/logs/orchestrator.log"

mkdir -p "$(dirname "$LOG")" "$ROOT/sessions"
echo "[$(date +%FT%T)] launch.sh: invoked (PID $$)" >> "$LOG"

cd "$ROOT"
exec node src/entry-bot.mjs
