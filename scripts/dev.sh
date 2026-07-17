#!/bin/bash
# ~/pi-discord-agents/scripts/dev.sh
# 前台跑 entry-bot,看实时日志(调试用)。
# 原 attach.sh(TUI 模式才有意义)退役,改成这个。
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/zhangsan/.nvm/versions/node/v24.15.0/bin:$PATH"
export NODE_PATH="/Users/zhangsan/.nvm/versions/node/v24.15.0/lib/node_modules:${NODE_PATH:-}"

ROOT="/Users/zhangsan/pi-discord-agents"
cd "$ROOT"

# 日志 tee 到 orchestrator.log,方便事后 grep
exec node src/entry-bot.mjs 2>&1 | tee -a "$ROOT/logs/orchestrator.log"
