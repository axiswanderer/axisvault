#!/bin/bash
set -e
cd /home/claude/axisvault/packages/server
pkill -9 -f "node dist/index.js" 2>/dev/null || true
sleep 1
rm -f /tmp/server.log
nohup node dist/index.js >> /tmp/server.log 2>&1 &
echo $! > /tmp/server.pid
disown -a
sleep 2
echo "Started with PID $(cat /tmp/server.pid)"
