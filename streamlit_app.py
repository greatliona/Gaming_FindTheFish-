from __future__ import annotations

import base64
import json
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components


ROOT = Path(__file__).parent


def asset_stamp() -> tuple[float, ...]:
    paths = [ROOT / "styles.css", ROOT / "game.js", ROOT / "sprites.json"]
    paths.extend(sorted((ROOT / "sprites").glob("fish_*.png")))
    return tuple(path.stat().st_mtime for path in paths)


@st.cache_data
def load_game_html(stamp: tuple[float, ...]) -> str:
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    game_js = (ROOT / "game.js").read_text(encoding="utf-8")
    sprites = json.loads((ROOT / "sprites.json").read_text(encoding="utf-8"))

    for sprite in sprites:
        image_bytes = (ROOT / sprite["file"]).read_bytes()
        encoded = base64.b64encode(image_bytes).decode("ascii")
        sprite["file"] = f"data:image/png;base64,{encoded}"

    sprite_data = json.dumps(sprites, ensure_ascii=False)
    return f"""<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html,
      body {{
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }}
      {css}
    </style>
  </head>
  <body>
    <main class="game-shell">
      <section class="playfield" aria-label="找魚魚遊戲區">
        <canvas id="backgroundCanvas"></canvas>
        <canvas id="gameCanvas"></canvas>
        <div class="topbar">
          <div class="mission">
            <span class="label">找</span>
            <strong id="targetLabel">笑笑的魚</strong>
          </div>
        </div>
        <div id="feedback" class="feedback"></div>
        <button id="startButton" class="start-button" type="button">開始</button>
        <div id="gameOverModal" class="game-over hidden" role="dialog" aria-modal="true" aria-labelledby="gameOverTitle">
          <div class="game-over-panel">
            <span id="gameOverTitle">遊戲結束</span>
            <strong id="finalScoreValue">0</strong>
            <label for="playerNameInput">名字</label>
            <div class="name-row">
              <input id="playerNameInput" maxlength="14" autocomplete="off" />
              <button id="saveScoreButton" type="button">送出</button>
            </div>
          </div>
        </div>
      </section>
      <aside class="side-panel">
        <div class="mark">找魚魚</div>
        <div class="target-card">
          <span>本回合</span>
          <strong id="sideTargetLabel">笑笑的魚</strong>
        </div>
        <div class="meters side-meters">
          <div><span id="timeValue">45.0</span><small>秒</small></div>
          <div><span id="scoreValue">0</span><small>分</small></div>
          <div><span id="streakValue">0</span><small>連擊</small></div>
        </div>
        <div class="run-stats">
          <div>
            <small>等級</small>
            <strong id="levelValue">1</strong>
          </div>
          <div>
            <small>最佳</small>
            <strong id="bestValue">0</strong>
          </div>
        </div>
        <section class="leaderboard" aria-label="本機前十名">
          <div class="leaderboard-title">本機前十名</div>
          <ol id="leaderboardList"></ol>
        </section>
        <div class="combo-bar" aria-hidden="true">
          <div id="comboFill"></div>
        </div>
        <button id="restartButton" class="ghost-button" type="button">重開</button>
      </aside>
    </main>
    <script>
      window.FISH_SPRITES = {sprite_data};
    </script>
    <script>
      {game_js}
    </script>
  </body>
</html>"""


st.set_page_config(page_title="找魚魚", layout="wide")
st.markdown(
    """
    <style>
      .block-container {
        max-width: 100%;
        padding: 0 !important;
      }
      [data-testid="stAppViewContainer"],
      [data-testid="stMain"],
      [data-testid="stMainBlockContainer"] {
        background: #efe8d4;
      }
      [data-testid="stMainBlockContainer"],
      [data-testid="stVerticalBlock"],
      [data-testid="stElementContainer"] {
        margin: 0 !important;
        padding: 0 !important;
        gap: 0 !important;
      }
      header,
      footer,
      [data-testid="stToolbar"] {
        display: none;
      }
      iframe {
        display: block;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

components.html(load_game_html(asset_stamp()), height=800, scrolling=False)
