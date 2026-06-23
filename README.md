# 找魚魚 FG1.0.2

這是一個用目前魚素材做成的找魚小遊戲。魚會在畫面裡游動，每回合會指定一種目標：笑笑的魚、有眼白的魚、沒有嘴巴的魚，或顏色不同的魚。

## 目前玩法

- 45 秒短局，點對魚會加分、加時間。
- 連擊越高分數越多。
- 每 5 連擊會進入短暫慢動作，讓玩家有一個「再來一次」的節奏。
- 等級會隨命中數增加，魚會變多、游得更快。
- 點錯會扣時間，最佳分數會留在瀏覽器裡。
- 遊戲結束可以輸入名字，前十名分數會留在瀏覽器裡。

## GitHub Pages

可以直接部署這個資料夾，入口是：

```text
index.html
```

## Streamlit Cloud

Streamlit 的入口是：

```text
streamlit_app.py
```

本機預覽：

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

`streamlit_app.py` 會把魚圖片內嵌進遊戲頁面，所以部署到 Streamlit Cloud 時不需要另外設定圖片路徑。
