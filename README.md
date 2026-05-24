# 答答二人組 DD2P · HTML5 重製版

> 原版 [DD2P_Share8C_2017 (AJ)] 是 2007–2017 年間用 Adobe Director + Flash 製作的 Windows 猜謎遊戲，因為 Flash 已停止支援，無法在現代裝置執行。本專案保留全部 **47 個題庫共 13,094 題** 的內容，用標準 HTML5 / CSS / JS 重新做了一份介面，讓 Mac、iPhone、iPad、Android、Windows 的任何現代瀏覽器都能玩。

## 線上試玩

➡️ **[https://ian3738.github.io/dd2p-quiz/](https://ian3738.github.io/dd2p-quiz/)**

## 功能特色

### 🧘 單人練習模式
- 從 47 個題庫挑一個（國中小數學 / 國文 / 英文 / 歷史 / 公民 / 看時鐘 / 99 乘法表…）
- 自選題數（10/20/30/50/全部）與順序（隨機 / 依序）
- 答完顯示對錯，可「練習錯題」鞏固

### ⚔️ 二人對戰模式（NES 紅白機風格）
- 全身像素角色：P1 紅機甲 vs P2 綠衣武術家
- 透視棋盤地板 + 同心圓未來城市背景
- 雙人鍵盤 PK：
  - **P1**: `1` `2` `3` `4`（或 `A` `S` `D` `F`）
  - **P2**: `0` `-` `=` `\`（或 `J` `K` `L` `;`）
- HP 100 / 答對讓對方 −25 / 答錯自己 −10 / 先 KO 對方勝
- KO 動畫：倒下角色 + 對白框「SOMEBODY CALL 119 PLEASE…」

### 📱 iOS / iPadOS 安裝為 App
1. 用 Safari 開上方連結
2. 點下方分享 → 加入主畫面
3. 從主畫面開啟時會以全螢幕 PWA 執行
4. 第一次開啟後可離線玩（Service Worker 自動快取）

### 💻 Mac 桌面 App
本 repo 主要是 web 版。如果想在 Mac 上有原生 `.app` 體驗（雙擊執行、Launchpad 圖示），請看上層的 [README 中提到的 `答答二人組.app`]，那會啟動本機 server + Chrome `--app` 模式打開遊戲。

## 鍵盤快捷鍵

| 情境 | 按鍵 | 用途 |
|---|---|---|
| 主選單 | `Enter` | 開始遊戲 |
| 題庫列表 | `/` / `Esc` | 聚焦搜尋 / 回主選單 |
| 答題（單人） | `1`-`4` 或 `A`-`D` | 選答案 |
| 答題（單人） | `Enter` / `Space` | 下一題 |
| 對戰（P1） | `1`-`4` 或 `A`-`F` | P1 選答案 |
| 對戰（P2） | `0` `-` `=` `\` 或 `J`-`;` | P2 選答案 |
| 結算 | `Enter` / `Esc` | 再玩一次 / 回題庫 |

## 技術細節

- 純靜態網站：HTML + CSS + 原生 JS（無框架）
- 全部題目預先解析成單一 `quizzes.json`（3.9 MB），首載後立即可玩
- 圖片題的圖片放在 `images/` 與 `images/sprites/`
- PWA：`manifest.json` + `sw.js`（cache-first）
- 角色與背景：8-bit pixel art PNG，`image-rendering: pixelated` 保持像素邊緣

## 題庫格式（與原版相容）

原始題目參數檔格式：
```
Type=0&Q=題目&A1=選項1&A2=選項2&A3=選項3&A4=選項4&A=正解編號&okflag=1
```

題庫資料夾結構：
```
A_QuizBase/
  <題庫名稱>/
    _para.txt       # 題庫設定（中文名稱、題數）
    001.txt         # 第 1 題參數
    001.jpg         # （可選）第 1 題的題幹圖片
    001A.jpg ~ D    # （可選）第 1 題各選項的圖片
    002.txt
    ...
```

## 改題庫

1. 依照上方格式新增或修改 `A_QuizBase/` 下的題庫
2. 在原始開發環境跑 `python3 _build_quizzes.py` 重新生成 `quizzes.json` 與 `images/`
3. push 到 GitHub，Pages 自動部署

## 致謝

- 原版題庫與遊戲設計：**DD2P_Share8C_2017 (AJ)** 作者
- 重製版只負責把題目資料用現代技術重新呈現

## License

題庫內容與遊戲玩法概念屬原作者；本重製版前端程式碼以 MIT License 授權。
