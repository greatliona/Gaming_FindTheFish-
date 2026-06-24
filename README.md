# 找魚魚 FG1.0.4

這是一個用目前魚素材做成的找魚小遊戲。魚會在畫面裡游動，每回合會指定一種目標：笑笑的魚、有眼白的魚、沒有嘴巴的魚，或顏色不同的魚。

## 目前玩法

- 45 秒短局，點對魚會加分、加時間。
- 連擊越高分數越多。
- 魚只有 80%、90%、100% 三種大小；目標魚不會使用最大尺寸。
- 目標魚會畫在最上層，避免答案被其他魚擋住。
- 第 1 關從 10 隻魚開始，之後逐關增加，最多 100 隻。
- 等級會隨命中數增加，魚會變多、游得更快，速度曲線保持穩定上升。
- 點錯會扣時間，最佳分數會留在瀏覽器裡。
- 遊戲結束可以輸入名字，本機前十名分數會留在玩家自己的瀏覽器裡。

## 紀錄儲存

排行榜優先使用 Supabase 的 `fish_game_record` 資料表。若 Supabase 尚未建表或暫時連不上，遊戲會退回瀏覽器本機紀錄，存在 `localStorage`。

Supabase 前端公開設定在：

```text
fish_game_record.js
```

請在 Supabase SQL Editor 貼上這個檔案內容來建立排行榜表：

```text
fish_game_record.sql
```

這段 SQL 只會建立並授權 `public.fish_game_record`，不會修改其他資料表。

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
