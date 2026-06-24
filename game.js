const bgCanvas = document.getElementById("backgroundCanvas");
const bgCtx = bgCanvas.getContext("2d");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const playfield = document.querySelector(".playfield");

const targetLabel = document.getElementById("targetLabel");
const sideTargetLabel = document.getElementById("sideTargetLabel");
const timeValue = document.getElementById("timeValue");
const scoreValue = document.getElementById("scoreValue");
const streakValue = document.getElementById("streakValue");
const levelValue = document.getElementById("levelValue");
const bestValue = document.getElementById("bestValue");
const comboFill = document.getElementById("comboFill");
const feedback = document.getElementById("feedback");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const gameOverModal = document.getElementById("gameOverModal");
const finalScoreValue = document.getElementById("finalScoreValue");
const playerNameInput = document.getElementById("playerNameInput");
const saveScoreButton = document.getElementById("saveScoreButton");
const leaderboardList = document.getElementById("leaderboardList");
const leaderboardTitle = document.getElementById("leaderboardTitle");

const TARGETS = [
  { key: "smile", label: "笑笑的魚" },
  { key: "whiteeye", label: "有眼白的魚" },
  { key: "nomouth", label: "沒有嘴巴的魚" },
  { key: "different", label: "顏色不同的魚" },
];

const TOP_SAFE = 190;
const SIZE_CLASSES = [0.8, 0.9, 1];
const TARGET_SIZE_CLASSES = [0.8, 0.9];
const MAX_LEVEL = 70;
const MIN_FISH_COUNT = 10;
const MAX_FISH_COUNT = 200;
const MIN_SPEED = 38;
const MAX_SPEED = 190;
const HIT_TIME_REWARD_SCALE = 0.7;
const SMALL_FISH_AREA = 9200;
const LEADERBOARD_KEY = "fishFinderLeaderboard";
const LAST_NAME_KEY = "fishFinderLastName";
const recordConfig = window.FISH_GAME_RECORD || {};

const state = {
  dpr: 1,
  width: 1,
  height: 1,
  running: false,
  score: 0,
  streak: 0,
  hits: 0,
  level: 1,
  best: Number(localStorage.getItem("fishFinderBest") || 0),
  timeLeft: 45,
  target: TARGETS[0],
  fish: [],
  focus: 0,
  last: 0,
  pulse: [],
  images: new Map(),
  variantImages: new Map(),
  leaderboard: [],
  scoreSaved: false,
  leaderboardMode: "local",
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function resize() {
  const rect = playfield.getBoundingClientRect();
  state.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  state.width = Math.floor(rect.width);
  state.height = Math.floor(rect.height);
  bgCanvas.width = Math.floor(state.width * state.dpr);
  bgCanvas.height = Math.floor(state.height * state.dpr);
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  bgCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  drawBackground();
}

function loadImages() {
  return Promise.all(
    window.FISH_SPRITES.map(
      (sprite) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            state.images.set(sprite.id, img);
            state.variantImages.set(sprite.id, makeColorVariant(img));
            resolve();
          };
          img.src = sprite.file;
        }),
    ),
  );
}

function makeColorVariant(img) {
  const offscreen = document.createElement("canvas");
  offscreen.width = img.naturalWidth || img.width;
  offscreen.height = img.naturalHeight || img.height;
  const offCtx = offscreen.getContext("2d");
  offCtx.drawImage(img, 0, 0);
  const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
  const pixels = imageData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 16) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const isOrange = r > 135 && g > 35 && g < 185 && b < 130 && r - g > 24 && r - b > 70;
    if (!isOrange) continue;
    const light = Math.max(0.35, Math.min(1.18, (r * 0.55 + g * 0.34 + b * 0.11) / 165));
    pixels[i] = Math.round(32 * light);
    pixels[i + 1] = Math.round(136 * light);
    pixels[i + 2] = Math.round(125 * light);
  }
  offCtx.putImageData(imageData, 0, 0);
  return offscreen;
}

function spritePool(category) {
  return window.FISH_SPRITES.filter((sprite) => sprite.category === category);
}

function levelProgress(level) {
  return Math.max(0, Math.min(1, (level - 1) / (MAX_LEVEL - 1)));
}

function fishCountForLevel(level) {
  return Math.round(MIN_FISH_COUNT + levelProgress(level) * (MAX_FISH_COUNT - MIN_FISH_COUNT));
}

function maxLevel() {
  return MAX_LEVEL;
}

function speedForLevel(level) {
  const eased = Math.pow(levelProgress(level), 0.86);
  return MIN_SPEED + eased * (MAX_SPEED - MIN_SPEED);
}

function targetCountForLevel(level) {
  const count = fishCountForLevel(level);
  if (count >= 170) return 5;
  if (count >= 125) return 4;
  if (count >= 75) return 3;
  if (count >= 35) return 2;
  return 1;
}

function sizeForFish(isTarget) {
  return pick(isTarget ? TARGET_SIZE_CLASSES : SIZE_CLASSES);
}

function nativeHeadAngle(sprite) {
  return (sprite.heading || 0) + Math.PI;
}

function nativeHeadFacesRight(sprite) {
  return Math.cos(nativeHeadAngle(sprite)) >= 0;
}

function shouldMirrorFish(fish) {
  const wantsRight = fish.faceDir > 0;
  return wantsRight !== nativeHeadFacesRight(fish.sprite);
}

function displayedHeadAngle(fish) {
  const angle = nativeHeadAngle(fish.sprite);
  return shouldMirrorFish(fish) ? Math.PI - angle : angle;
}

function swimVector(fish) {
  const angle = displayedHeadAngle(fish);
  const xSign = fish.faceDir >= 0 ? 1 : -1;
  const x = xSign * Math.max(0.38, Math.abs(Math.cos(angle)));
  const y = Math.sin(angle);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function loadLeaderboard() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.name === "string" && Number.isFinite(Number(entry.score)))
      .map((entry) => ({ name: entry.name.slice(0, 14), score: Number(entry.score), at: entry.at || "" }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  } catch {
    return [];
  }
}

function saveLeaderboard() {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(state.leaderboard.slice(0, 10)));
}

function supabaseEnabled() {
  return Boolean(recordConfig.supabaseUrl && recordConfig.supabaseKey && recordConfig.table);
}

function supabaseEndpoint(query = "") {
  const base = recordConfig.supabaseUrl.replace(/\/$/, "");
  return `${base}/rest/v1/${recordConfig.table}${query}`;
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: recordConfig.supabaseKey,
    Authorization: `Bearer ${recordConfig.supabaseKey}`,
    ...extra,
  };
}

async function fetchOnlineLeaderboard() {
  if (!supabaseEnabled()) return null;
  const query = "?select=player_name,score,level,created_at&order=score.desc,created_at.asc&limit=10";
  const response = await fetch(supabaseEndpoint(query), {
    headers: supabaseHeaders(),
  });
  if (!response.ok) {
    throw new Error(`leaderboard ${response.status}`);
  }
  const rows = await response.json();
  return rows.map((row) => ({
    name: String(row.player_name || "玩家").slice(0, 14),
    score: Number(row.score) || 0,
    level: Number(row.level) || 1,
    at: row.created_at || "",
  }));
}

async function insertOnlineScore(name, score, level) {
  if (!supabaseEnabled()) return false;
  const response = await fetch(supabaseEndpoint(), {
    method: "POST",
    headers: supabaseHeaders({
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    }),
    body: JSON.stringify({
      player_name: name,
      score,
      level,
    }),
  });
  if (!response.ok) {
    throw new Error(`score ${response.status}`);
  }
  return true;
}

async function refreshLeaderboard() {
  try {
    const online = await fetchOnlineLeaderboard();
    if (online) {
      state.leaderboard = online;
      state.leaderboardMode = "online";
      renderLeaderboard();
      return;
    }
  } catch {
    state.leaderboardMode = "local";
  }
  state.leaderboard = loadLeaderboard();
  renderLeaderboard();
}

function renderLeaderboard() {
  leaderboardList.innerHTML = "";
  leaderboardTitle.textContent = state.leaderboardMode === "online" ? "線上前十名" : "本機前十名";
  if (!state.leaderboard.length) {
    const item = document.createElement("li");
    item.className = "empty-score";
    item.textContent = "尚無紀錄";
    leaderboardList.append(item);
    return;
  }
  state.leaderboard.forEach((entry) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const score = document.createElement("strong");
    name.textContent = entry.name;
    score.textContent = String(entry.score);
    item.append(name, score);
    leaderboardList.append(item);
  });
}

function addLocalLeaderboardScore(name, score, level) {
  const safeName = (name || "").trim().slice(0, 14) || "玩家";
  localStorage.setItem(LAST_NAME_KEY, safeName);
  state.leaderboard.push({ name: safeName, score, level, at: new Date().toISOString() });
  state.leaderboard.sort((a, b) => b.score - a.score);
  state.leaderboard = state.leaderboard.slice(0, 10);
  saveLeaderboard();
  renderLeaderboard();
}

async function addLeaderboardScore(name, score, level) {
  const safeName = (name || "").trim().slice(0, 14) || "玩家";
  localStorage.setItem(LAST_NAME_KEY, safeName);
  addLocalLeaderboardScore(safeName, score, level);
  try {
    await insertOnlineScore(safeName, score, level);
    await refreshLeaderboard();
  } catch {
    state.leaderboardMode = "local";
    renderLeaderboard();
  }
}

function makeFish(sprite, forced = {}) {
  const img = state.images.get(sprite.id);
  const isTarget = Boolean(forced.target);
  const scale = forced.scale || sizeForFish(isTarget);
  const margin = Math.max(sprite.width, sprite.height) * scale * 0.7 + 18;
  const speed = speedForLevel(state.level) * rand(0.98, 1.02);
  const minY = Math.min(state.height - margin, TOP_SAFE + margin);
  const maxY = Math.max(minY + 1, state.height - margin);
  const swimDir = forced.swimDir ?? (Math.random() < 0.5 ? 1 : -1);
  const laneY = forced.y ?? rand(minY, maxY);
  return {
    sprite,
    img,
    x: forced.x ?? rand(margin, Math.max(margin + 1, state.width - margin)),
    y: laneY,
    swimDir,
    faceDir: swimDir,
    laneY,
    turnMode: "horizontal",
    turnTargetY: laneY,
    turnDirY: 0,
    speed,
    scale,
    wobble: rand(0, Math.PI * 2),
    bob: rand(4, 9),
    bobSpeed: rand(1.4, 2.1),
    variant: forced.variant || "normal",
    target: Boolean(forced.target),
  };
}

function chooseTarget() {
  let next = pick(TARGETS);
  if (next.key === state.target.key && Math.random() < 0.7) {
    next = pick(TARGETS.filter((item) => item.key !== state.target.key));
  }
  state.target = next;
  targetLabel.textContent = next.label;
  sideTargetLabel.textContent = next.label;
}

function buildSchool() {
  const count = fishCountForLevel(state.level);
  const normal = window.FISH_SPRITES.filter((sprite) => sprite.category === "normal");
  const chosen = [];
  const forced = [];

  if (state.target.key === "different") {
    const sprite = pick(normal);
    chosen.push(sprite);
    forced.push({ sprite, options: { target: true, variant: "different", scale: sizeForFish(true) } });
  } else {
    const targetSprites = shuffle(spritePool(state.target.key));
    const targetCount = targetCountForLevel(state.level);
    for (let i = 0; i < targetCount; i += 1) {
      const sprite = targetSprites[i % targetSprites.length];
      chosen.push(sprite);
      forced.push({ sprite, options: { target: true, scale: sizeForFish(true) } });
    }
  }

  const decoyPool =
    state.target.key === "different"
      ? window.FISH_SPRITES
      : window.FISH_SPRITES.filter((sprite) => sprite.category !== state.target.key);
  const fish = forced.map(({ sprite, options }) => makeFish(sprite, options));
  while (fish.length < count) {
    const sprite = pick(decoyPool);
    fish.push(makeFish(sprite, { scale: sizeForFish(false) }));
  }
  const targets = fish.filter((fishItem) => fishItem.target);
  const decoys = fish.filter((fishItem) => !fishItem.target);
  state.fish = [...shuffle(decoys), ...shuffle(targets)];
}

function newRound() {
  state.level = Math.min(maxLevel(), 1 + state.hits);
  chooseTarget();
  buildSchool();
  updateHud();
}

function startGame() {
  state.running = true;
  state.scoreSaved = false;
  state.score = 0;
  state.streak = 0;
  state.hits = 0;
  state.level = 1;
  state.timeLeft = 45;
  state.focus = 0;
  state.pulse = [];
  gameOverModal.classList.add("hidden");
  startButton.classList.add("hidden");
  newRound();
}

function updateHud() {
  timeValue.textContent = Math.max(0, state.timeLeft).toFixed(1);
  scoreValue.textContent = String(state.score);
  streakValue.textContent = String(state.streak);
  levelValue.textContent = String(state.level);
  bestValue.textContent = String(state.best);
  comboFill.style.width = `${Math.min(100, (state.streak % 5) * 20)}%`;
}

function showFeedback(text, good) {
  feedback.textContent = text;
  feedback.style.background = good ? "rgba(22, 124, 117, 0.86)" : "rgba(239, 78, 50, 0.86)";
  feedback.classList.add("show");
  window.setTimeout(() => feedback.classList.remove("show"), 260);
}

function showGameOver() {
  state.running = false;
  state.timeLeft = 0;
  state.best = Math.max(state.best, state.score);
  localStorage.setItem("fishFinderBest", String(state.best));
  finalScoreValue.textContent = String(state.score);
  playerNameInput.value = localStorage.getItem(LAST_NAME_KEY) || "";
  gameOverModal.classList.remove("hidden");
  startButton.textContent = "再玩";
  startButton.classList.add("hidden");
  updateHud();
  window.setTimeout(() => playerNameInput.focus(), 80);
}

async function submitScore() {
  if (state.scoreSaved) return;
  state.scoreSaved = true;
  await addLeaderboardScore(playerNameInput.value, state.score, state.level);
  gameOverModal.classList.add("hidden");
  startButton.classList.remove("hidden");
  showFeedback("已紀錄", true);
  updateHud();
}

function isCorrect(fish) {
  if (state.target.key === "different") return fish.variant === "different";
  return fish.sprite.category === state.target.key;
}

function handleHit(fish) {
  if (isCorrect(fish)) {
    state.hits += 1;
    state.streak += 1;
    const bonus = 100 + state.level * 12 + Math.min(10, state.streak) * 18;
    state.score += bonus;
    const timeReward = (2.4 + Math.min(2, state.streak * 0.15)) * HIT_TIME_REWARD_SCALE;
    state.timeLeft = Math.min(60, state.timeLeft + timeReward);
    if (state.streak % 5 === 0) {
      showFeedback("連擊", true);
    } else {
      showFeedback(`+${bonus}`, true);
    }
    state.pulse.push({ x: fish.x, y: fish.y, age: 0, good: true });
    newRound();
  } else {
    state.streak = 0;
    state.timeLeft = Math.max(0, state.timeLeft - 3.2);
    state.pulse.push({ x: fish.x, y: fish.y, age: 0, good: false });
    showFeedback("-3秒", false);
    updateHud();
  }
}

function pointerToCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function hitTest(fish, point) {
  const w = fish.sprite.width * fish.scale;
  const h = fish.sprite.height * fish.scale;
  const dx = point.x - fish.x;
  const dy = point.y - fish.y;
  const hitPadding = fish.sprite.width * fish.sprite.height <= SMALL_FISH_AREA ? 8 : 4;
  return Math.abs(dx) <= w * 0.5 + hitPadding && Math.abs(dy) <= h * 0.5 + hitPadding;
}

canvas.addEventListener("pointerdown", (event) => {
  if (!state.running) return;
  const point = pointerToCanvas(event);
  for (const fish of [...state.fish].reverse()) {
    if (hitTest(fish, point)) {
      handleHit(fish);
      return;
    }
  }
  state.timeLeft = Math.max(0, state.timeLeft - 1);
  state.streak = 0;
  showFeedback("-1秒", false);
  updateHud();
});

function drawBackground() {
  bgCtx.clearRect(0, 0, state.width, state.height);
  bgCtx.fillStyle = "#f1ead8";
  bgCtx.fillRect(0, 0, state.width, state.height);
  bgCtx.save();
  bgCtx.globalAlpha = 0.22;
  bgCtx.strokeStyle = "#d8c698";
  bgCtx.lineWidth = 1;
  for (let x = -state.height; x < state.width + state.height; x += 9) {
    bgCtx.beginPath();
    bgCtx.moveTo(x, 0);
    bgCtx.lineTo(x + state.height, state.height);
    bgCtx.stroke();
  }
  bgCtx.restore();
  drawPlants();
}

function drawPlants() {
  const baseY = state.height + 20;
  const groups = [
    { x: 92, color: "#55724d", side: 1, h: 190 },
    { x: 190, color: "#a88418", side: -1, h: 135 },
    { x: state.width - 110, color: "#55724d", side: -1, h: 190 },
    { x: state.width - 205, color: "#a88418", side: 1, h: 135 },
  ];
  bgCtx.save();
  bgCtx.globalAlpha = 0.62;
  for (const g of groups) {
    bgCtx.strokeStyle = g.color;
    bgCtx.fillStyle = g.color;
    bgCtx.lineWidth = 11;
    bgCtx.lineCap = "round";
    bgCtx.beginPath();
    bgCtx.moveTo(g.x, baseY);
    bgCtx.quadraticCurveTo(g.x - 8 * g.side, baseY - g.h * 0.45, g.x + 16 * g.side, baseY - g.h);
    bgCtx.stroke();
    for (let i = 0; i < 5; i += 1) {
      const y = baseY - 34 - i * 34;
      const dir = i % 2 ? -g.side : g.side;
      bgCtx.beginPath();
      bgCtx.ellipse(g.x + dir * (18 + i * 8), y, 12, 32, dir * 0.72, 0, Math.PI * 2);
      bgCtx.fill();
    }
  }
  bgCtx.restore();
}

function drawFish(fish) {
  const w = fish.sprite.width * fish.scale;
  const h = fish.sprite.height * fish.scale;
  const image = fish.variant === "different" ? state.variantImages.get(fish.sprite.id) || fish.img : fish.img;
  ctx.save();
  ctx.translate(fish.x, fish.y + Math.sin(fish.wobble) * fish.bob);
  if (shouldMirrorFish(fish)) {
    ctx.scale(-1, 1);
  }
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function updateFish(dt) {
  const slow = 1;
  for (const fish of state.fish) {
    fish.wobble += dt * (fish.bobSpeed + state.level * 0.05);
    const w = fish.sprite.width * fish.scale;
    const h = fish.sprite.height * fish.scale;
    const left = w * 0.42;
    const right = state.width - w * 0.42;
    const top = TOP_SAFE + h * 0.45;
    const bottom = state.height - h * 0.42;

    if (fish.turnMode === "horizontal") {
      const forward = swimVector(fish);
      fish.x += forward.x * fish.speed * dt * slow;
      fish.y += forward.y * fish.speed * dt * slow;
      fish.y += (fish.laneY - fish.y) * Math.min(1, dt * 0.8);
      if (fish.x >= right || fish.x <= left) {
        fish.x = Math.max(left, Math.min(right, fish.x));
        const spaceUp = fish.y - top;
        const spaceDown = bottom - fish.y;
        const preferred = Math.random() < 0.5 ? -1 : 1;
        const verticalDir = spaceUp < 92 ? 1 : spaceDown < 92 ? -1 : preferred;
        const distance = rand(82, 150);
        fish.turnDirY = verticalDir;
        fish.turnTargetY = Math.max(top, Math.min(bottom, fish.y + verticalDir * distance));
        fish.faceDir = -fish.swimDir;
        fish.turnMode = "vertical";
      }
    } else {
      fish.y += fish.turnDirY * fish.speed * 0.92 * dt * slow;
      fish.x += fish.faceDir * fish.speed * 0.12 * dt * slow;
      fish.x = Math.max(left, Math.min(right, fish.x));
      if ((fish.turnDirY > 0 && fish.y >= fish.turnTargetY) || (fish.turnDirY < 0 && fish.y <= fish.turnTargetY)) {
        fish.y = fish.turnTargetY;
        fish.laneY = fish.turnTargetY;
        fish.swimDir = fish.faceDir;
        fish.turnMode = "horizontal";
      }
    }

    fish.y = Math.max(top, Math.min(bottom, fish.y));
  }
}

function drawPulse(dt) {
  state.pulse = state.pulse.filter((pulse) => {
    pulse.age += dt;
    const t = pulse.age / 0.55;
    if (t >= 1) return false;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = pulse.good ? "#167c75" : "#ef4e32";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, 22 + t * 54, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return true;
  });
}

function update(dt) {
  if (!state.running) return;
  state.timeLeft -= dt;
  state.focus = Math.max(0, state.focus - dt);
  if (state.timeLeft <= 0) {
    showGameOver();
    return;
  }
  updateFish(dt);
  updateHud();
}

function frame(now) {
  const t = now / 1000;
  const dt = Math.min(0.033, Math.max(0, t - state.last || 0));
  state.last = t;
  update(dt);
  ctx.clearRect(0, 0, state.width, state.height);
  state.fish.forEach(drawFish);
  drawPulse(dt);
  requestAnimationFrame(frame);
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
saveScoreButton.addEventListener("click", submitScore);
playerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    submitScore();
  }
});
window.addEventListener("resize", resize);

resize();
refreshLeaderboard();
bestValue.textContent = String(state.best);
loadImages().then(() => {
  buildSchool();
  requestAnimationFrame(frame);
});
