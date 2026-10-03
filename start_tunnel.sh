#!/bin/bash
# Sobe o app Ponto com servidor SEGURO (bloqueia .git e dotfiles) + tunnel Cloudflare.
PORT="${PORT:-8085}"
DIR="/sdcard/projetos/ponto"

pkill -f "http.server $PORT" 2>/dev/null || true
pkill -f "serve.py" 2>/dev/null || true
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1

cd "$DIR"
PORT="$PORT" SERVE_DIR="$DIR" nohup python3 serve.py > /tmp/http_server.log 2>&1 &
sleep 1

nohup cloudflared tunnel --url "http://127.0.0.1:$PORT" > /tmp/cloudflared.log 2>&1 &
sleep 5

grep -o 'https://[-a-zA-Z0-9@:%._+~#=]*.trycloudflare.com' /tmp/cloudflared.log | head -n 1
