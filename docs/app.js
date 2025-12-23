
let data, levels, meta;

const el = (id) => document.getElementById(id);
const screenHome = el("screenHome");
const screenGame = el("screenGame");
const screenHow  = el("screenHow");

const levelGrid = el("levelGrid");
const progressPill = el("progressPill");
const playerName = el("playerName");

const board = el("board");
const ctx = board.getContext("2d");

const levelTitle = el("levelTitle");
const storyLine  = el("storyLine");
const timeEl  = el("time");
const movesEl = el("moves");
const scoreEl = el("score");

const preview = el("preview");
const previewImg = el("previewImg");

let currentLevel = null;
let img = new Image();
let N = 3;
let tiles = [];
let selected = null;

let startedAt = null;
let timerHandle = null;
let moves = 0;
let score = 0;

function now() { return performance.now(); }

function show(screen) {
  [screenHome, screenGame, screenHow].forEach(s => s.classList.add("hidden"));
  screen.classList.remove("hidden");
}

function storageKey(levelId) { return `spq_highscores_v1_level_${levelId}`; }

function getHighscores(levelId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(levelId)) || "[]");
  } catch { return []; }
}

function saveHighscore(levelId, entry) {
  const list = getHighscores(levelId);
  list.push(entry);
  list.sort((a,b) => b.score - a.score);
  const trimmed = list.slice(0, 10);
  localStorage.setItem(storageKey(levelId), JSON.stringify(trimmed));
  return trimmed;
}

function bestScore(levelId) {
  const list = getHighscores(levelId);
  return list[0]?.score ?? 0;
}

function fmtScore(x) { return Math.max(0, Math.round(x)).toString(); }

function computeScore(grid, seconds, moves) {
  const pieces = grid * grid;
  const base = 1000 * pieces;          // steigt mit Schwierigkeit
  const timePenalty = 35 * seconds;    // Zeit kostet
  const movePenalty = 12 * moves;      // Züge kosten

  // Speed-Bonus: wenn sehr schnell gelöst (unter ~grid^2*1.4 Sekunden)
  const target = (grid * grid) * 1.4;
  const speedBonus = Math.max(0, (target - seconds)) * 80;

  return base - timePenalty - movePenalty + speedBonus;
}

function buildTiles() {
  tiles = [];
  for (let i = 0; i < N*N; i++) tiles.push(i);
  // Shuffle mit garantierter Mischung (simple, reicht fürs Geschenk)
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  // Nicht schon gelöst starten
  if (isSolved()) {
    [tiles[0], tiles[1]] = [tiles[1], tiles[0]];
  }
}

function isSolved() {
  for (let i = 0; i < tiles.length; i++) if (tiles[i] !== i) return false;
  return true;
}

function draw() {
  const w = board.width, h = board.height;
  ctx.clearRect(0,0,w,h);

  // board square
  const pad = 8;
  const bw = w - pad*2;
  const bh = h - pad*2;

  // image draw per tile
  const tw = bw / N;
  const th = bh / N;

  for (let pos = 0; pos < tiles.length; pos++) {
    const tile = tiles[pos];

    const sx = (tile % N) / N;
    const sy = Math.floor(tile / N) / N;

    const dx = (pos % N);
    const dy = Math.floor(pos / N);

    const x = pad + dx * tw;
    const y = pad + dy * th;

    ctx.drawImage(
      img,
      sx * img.width, sy * img.height,
      img.width / N, img.height / N,
      x, y, tw, th
    );

    // grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, tw, th);

    // selection
    if (selected === pos) {
      ctx.strokeStyle = "rgba(255,77,166,0.85)";
      ctx.lineWidth = 6;
      ctx.strokeRect(x+2, y+2, tw-4, th-4);
    }
  }
}

function posFromEvent(ev) {
  const rect = board.getBoundingClientRect();
  const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
  const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - rect.top;

  const x = (cx / rect.width) * board.width;
  const y = (cy / rect.height) * board.height;

  const pad = 8;
  const bw = board.width - pad*2;
  const tw = bw / N;
  const th = bw / N;

  const gx = Math.floor((x - pad) / tw);
  const gy = Math.floor((y - pad) / th);
  if (gx < 0 || gy < 0 || gx >= N || gy >= N) return null;
  return gy * N + gx;
}

function startTimerIfNeeded() {
  if (startedAt !== null) return;
  startedAt = now();
  timerHandle = setInterval(() => {
    const s = (now() - startedAt) / 1000;
    timeEl.textContent = s.toFixed(1) + "s";
    // live score
    score = computeScore(N, s, moves);
    scoreEl.textContent = fmtScore(score);
  }, 100);
}

function stopTimer() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function onPick(pos) {
  startTimerIfNeeded();
  if (selected === null) {
    selected = pos;
  } else if (selected === pos) {
    selected = null;
  } else {
    // swap
    [tiles[selected], tiles[pos]] = [tiles[pos], tiles[selected]];
    moves++;
    movesEl.textContent = String(moves);
    selected = null;

    draw();

    if (isSolved()) {
      finishLevel();
      return;
    }
  }
  draw();
}

function finishLevel() {
  stopTimer();
  const seconds = startedAt ? (now() - startedAt) / 1000 : 0;
  const finalScore = computeScore(N, seconds, moves);
  scoreEl.textContent = fmtScore(finalScore);

  const name = (playerName.value || meta.defaultName || "Player").trim().slice(0,20);
  const entry = {
    name,
    score: Math.round(finalScore),
    time: Math.round(seconds * 10) / 10,
    moves,
    at: new Date().toISOString()
  };

  const list = saveHighscore(currentLevel.id, entry);
  const best = list[0];

  setTimeout(() => {
    alert(
`✅ Gelöst!

Score: ${best.score} (Best)
Dein Score: ${entry.score}
Zeit: ${entry.time}s
Züge: ${entry.moves}

Highscore gespeichert.`
    );
    // zurück zur Level-Übersicht
    showHome();
  }, 80);
}

function showHome() {
  show(screenHome);
  renderLevelCards();
}

function renderLevelCards() {
  levelGrid.innerHTML = "";
  const total = levels.length;
  // "Progress": höchste gelöste Level-ID (aus Highscores)
  let solved = 0;
  for (const L of levels) {
    if (bestScore(L.id) > 0) solved = Math.max(solved, L.id);
  }
  progressPill.textContent = `${solved} / ${total}`;

  for (const L of levels) {
    const best = bestScore(L.id);
    const solvedMark = best > 0 ? "✅" : "🔒";
    const card = document.createElement("div");
    card.className = "levelCard";
    card.innerHTML = `
      <div class="thumb"><img src="${L.image}" alt="thumb"></div>
      <div class="meta">
        <div class="l">${solvedMark} ${L.title}</div>
        <div class="r">${L.grid}×${L.grid}<br>Best: ${best}</div>
      </div>
      <button class="btn">Start</button>
    `;
    card.querySelector("button").addEventListener("click", () => startLevel(L.id));
    levelGrid.appendChild(card);
  }
}

async function startLevel(levelId) {
  currentLevel = levels.find(x => x.id === levelId);
  if (!currentLevel) return;

  N = currentLevel.grid;

  // reset state
  selected = null;
  moves = 0;
  score = 0;
  startedAt = null;
  stopTimer();

  timeEl.textContent = "0.0s";
  movesEl.textContent = "0";
  scoreEl.textContent = "0";

  levelTitle.textContent = `${currentLevel.title} — ${N}×${N}`;
  storyLine.textContent = currentLevel.story;

  previewImg.src = currentLevel.image;

  // load image
  await new Promise((res, rej) => {
    img = new Image();
    img.onload = () => res();
    img.onerror = rej;
    img.src = currentLevel.image;
  });

  buildTiles();
  show(screenGame);
  draw();
}

function registerPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

async function init() {
  data = await fetch("levels.json").then(r => r.json());
  meta = data.meta;
  levels = data.levels;

  document.title = meta.title || "Puzzle";
  playerName.value = localStorage.getItem("spq_player_name") || meta.defaultName || "Sara 💖";
  playerName.addEventListener("input", () => {
    localStorage.setItem("spq_player_name", playerName.value);
  });

  el("btnHome").onclick = () => showHome();
  el("btnHow").onclick  = () => show(screenHow);
  el("btnBackHow").onclick = () => showHome();
  el("btnBack").onclick = () => showHome();

  el("btnShuffle").onclick = () => { buildTiles(); selected=null; draw(); };
  el("btnHint").onclick = () => { preview.classList.remove("hidden"); };
  el("btnClosePreview").onclick = () => { preview.classList.add("hidden"); };

  board.addEventListener("click", (ev) => {
    const pos = posFromEvent(ev);
    if (pos !== null) onPick(pos);
  });

  // Touch support
  board.addEventListener("touchstart", (ev) => {
    ev.preventDefault();
    const pos = posFromEvent(ev);
    if (pos !== null) onPick(pos);
  }, { passive:false });

  registerPWA();
  showHome();
}

init();
