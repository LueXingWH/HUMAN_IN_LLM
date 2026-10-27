@echo off
chcp 65001 >nul
"D:\ai项目\我就是llm\.tools\cloudflared.exe" tunnel --url http://127.0.0.1:80 --no-autoupdate
