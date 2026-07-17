#!/bin/bash
# ~/pi-discord-agents/scripts/stop.sh
# 完整停止 entry-bot
echo "卸载 launchd 任务..."
launchctl bootout "gui/$(id -u)/com.zhangsan.pi-discord-agents" 2>/dev/null

echo "杀掉 entry-bot 进程..."
pkill -f "node src/entry-bot.mjs" 2>/dev/null

echo "杀掉可能残留的 Pi 子进程..."
pkill -f "pi-coding-agent/dist/cli.js" 2>/dev/null

echo "✅ 已停止"
