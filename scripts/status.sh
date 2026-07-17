#!/bin/bash
# ~/pi-discord-agents/scripts/status.sh
# 健康度 + Discord bot 状态
echo "=== launchd 任务 ==="
launchctl list | grep pi-discord-agents || echo "  (无 launchd 任务)"

echo ""
echo "=== entry-bot 进程 ==="
PIDS=$(pgrep -f "node src/entry-bot.mjs" || true)
if [ -n "$PIDS" ]; then
  echo "  PID: $PIDS"
  ps -p $PIDS -o pid,etime,rss,command 2>/dev/null
else
  echo "  (未运行)"
fi

echo ""
echo "=== Pi RPC 子进程 ==="
# Pi 子进程在 ps 里显示为 'pi',但父进程是 entry-bot
ENTRY_PID=$(pgrep -f "node src/entry-bot.mjs" | head -1)
PI_PIDS=""
if [ -n "$ENTRY_PID" ]; then
  PI_PIDS=$(ps -ef | awk -v ppid="$ENTRY_PID" '$3==ppid && $2 != ppid && $2 ~ /^[0-9]+$/' | awk '{print $2}')
fi
if [ -n "$PI_PIDS" ]; then
  for p in $PI_PIDS; do
    echo "  PID: $p"
    ps -p "$p" -o pid,ppid,etime,command 2>/dev/null | tail -n +2
  done
else
  echo "  (未运行)"
fi

echo ""
echo "=== 最近日志 (orchestrator.log) ==="
tail -15 /Users/zhangsan/pi-discord-agents/logs/orchestrator.log 2>/dev/null || echo "  (无日志)"

echo ""
echo "=== Discord token 验证 ==="
TOKEN=$(grep "^DISCORD_TOKEN=" /Users/zhangsan/pi-discord-agents/.env | cut -d= -f2-)
curl -m 5 -sH "Authorization: Bot $TOKEN" https://discord.com/api/users/@me 2>&1 | \
  python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if 'username' in d:
        print(f'  Bot: {d[\"username\"]}#{d.get(\"discriminator\",\"?\")}')
    else:
        print('  ⚠️ 无效响应:', str(d)[:120])
except Exception as e:
    print(f'  ⚠️ 解析错误: {e}')
" 2>&1
