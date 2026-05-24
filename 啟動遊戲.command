#!/bin/bash
# 雙擊執行：開啟本機伺服器並用瀏覽器打開遊戲。
# 也會印出區網 IP，方便 iPhone 用 Safari 連線。
cd "$(dirname "$0")"

PORT=${PORT:-8765}

# 找出區網 IP（macOS）
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$LAN_IP" ]; then
  LAN_IP=$(ipconfig getifaddr en1 2>/dev/null)
fi

clear
echo "=============================================="
echo "       答答二人組  iOS 版  本機伺服器"
echo "=============================================="
echo ""
echo " 本機網址  :  http://localhost:${PORT}/"
if [ -n "$LAN_IP" ]; then
  echo " iPhone 用 :  http://${LAN_IP}:${PORT}/"
  echo ""
  echo " 在 iPhone Safari 輸入上方「iPhone 用」網址，"
  echo " 點下方分享 → 加入主畫面，就可當 App 用。"
  echo ""
  echo " ⚠ iPhone 與這台 Mac 必須在同一個 Wi-Fi 網路。"
else
  echo " (找不到區網 IP，可能未連 Wi-Fi)"
fi
echo ""
echo " 按 Ctrl+C 可結束伺服器，視窗會留著等你關閉。"
echo "----------------------------------------------"
echo ""

# 5 秒後自動開瀏覽器
( sleep 1.5 && open "http://localhost:${PORT}/" ) &

# 啟動 Python 內建 HTTP 伺服器（macOS 內建 python3）
python3 -m http.server "${PORT}" --bind 0.0.0.0

echo ""
echo "伺服器已停止。可關閉此視窗。"
