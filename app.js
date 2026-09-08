/* =============================================
   COLOR GUESSER – app.js
   ============================================= */

// ── State ──────────────────────────────────────
const state = {
  targetColor:  { r: 0, g: 0, b: 0 },
  guessColor:   { r: 128, g: 128, b: 128 },
  h: 0, s: 0, l: 50,
  memorizeTime: 5,
  difficulty:   'medium',
  timerHandle:  null,
  drag:         null,
  playerName:   '',
  lbFilter:     'all',
  prevScreen:   'memorize',   // to know where to return from leaderboard
};

// ── DOM ────────────────────────────────────────
const screens = {
  memorize:    document.getElementById('screen-memorize'),
  guess:       document.getElementById('screen-guess'),
  result:      document.getElementById('screen-result'),
  leaderboard: document.getElementById('screen-leaderboard'),
};
const targetSwatch    = document.getElementById('target-swatch');
const timerBar        = document.getElementById('timer-bar');
const timerBarWrap    = document.getElementById('timer-bar-wrap');
const countdownLabel  = document.getElementById('countdown-label');
const btnStart        = document.getElementById('btn-start');
const playerNameInput = document.getElementById('player-name');
const nameRow         = document.getElementById('name-row');
const memorizeSubtitle= document.getElementById('memorize-subtitle');

const hueStrip    = document.getElementById('hue-strip');
const satStrip    = document.getElementById('sat-strip');
const litStrip    = document.getElementById('lit-strip');
const hueWrap     = document.getElementById('hue-wrap');
const satWrap     = document.getElementById('sat-wrap');
const litWrap     = document.getElementById('lit-wrap');
const hueCursor   = document.getElementById('hue-cursor');
const satCursor   = document.getElementById('sat-cursor');
const litCursor   = document.getElementById('lit-cursor');
const guessPreview= document.getElementById('guess-preview');
const guessHex    = document.getElementById('guess-hex');
const btnSubmit   = document.getElementById('btn-submit');

const resultTarget = document.getElementById('result-target');
const resultGuess  = document.getElementById('result-guess');
const resultStats  = document.getElementById('result-stats');
const resultGrade  = document.getElementById('result-grade');
const btnAgain     = document.getElementById('btn-again');
const btnShowLb    = document.getElementById('btn-show-lb');
const btnSettings  = document.getElementById('btn-settings');
const btnOpenLb    = document.getElementById('btn-open-lb');

const lbBody    = document.getElementById('lb-body');
const lbEmpty   = document.getElementById('lb-empty');
const lbFilters = document.querySelectorAll('.lb-filter');
const btnLbBack = document.getElementById('btn-lb-back');
const btnLbClear= document.getElementById('btn-lb-clear');

const modalSettings     = document.getElementById('modal-settings');
const settingTime       = document.getElementById('setting-time');
const settingDifficulty = document.getElementById('setting-difficulty');
const btnSettingsSave   = document.getElementById('btn-settings-save');
const btnSettingsCancel = document.getElementById('btn-settings-cancel');

// ── Canvas sizes ────────────────────────────────
const STRIP_W = 42, STRIP_H = 280;
[hueStrip, satStrip, litStrip].forEach(c => { c.width = STRIP_W; c.height = STRIP_H; });

// ── Color math ──────────────────────────────────
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0)*255), g: Math.round(f(8)*255), b: Math.round(f(4)*255) };
}
function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2,'0')).join('');
}
function rgbStr({ r, g, b }) { return `rgb(${r},${g},${b})`; }
function colorDistance(a, b) {
  return Math.sqrt((a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2);
}
function deltaE(a, b) {
  const rm = (a.r+b.r)/2, dr = a.r-b.r, dg = a.g-b.g, db = a.b-b.b;
  return Math.sqrt((2+rm/256)*dr*dr + 4*dg*dg + (2+(255-rm)/256)*db*db);
}

// ── Generate target ─────────────────────────────
function rand(mn, mx) { return Math.round(Math.random()*(mx-mn)+mn); }
function generateColor(diff) {
  if (diff === 'easy') return { r:rand(128,255), g:rand(128,255), b:rand(128,255) };
  if (diff === 'hard') return { r:rand(0,150),   g:rand(0,150),   b:rand(0,150)   };
  return { r:rand(0,255), g:rand(0,255), b:rand(0,255) };
}

// ── Draw strips ─────────────────────────────────
function drawHueStrip() {
  const ctx = hueStrip.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, STRIP_H);
  for (let i = 0; i <= 12; i++) grad.addColorStop(i/12, `hsl(${i*30},100%,50%)`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, STRIP_W, STRIP_H);
}
function drawSatStrip() {
  const ctx = satStrip.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, STRIP_H);
  grad.addColorStop(0, `hsl(${state.h},100%,50%)`);
  grad.addColorStop(1, `hsl(${state.h},0%,50%)`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, STRIP_W, STRIP_H);
}
function drawLitStrip() {
  const ctx = litStrip.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, STRIP_H);
  grad.addColorStop(0,   `hsl(${state.h},${state.s}%,100%)`);
  grad.addColorStop(0.5, `hsl(${state.h},${state.s}%,50%)`);
  grad.addColorStop(1,   `hsl(${state.h},${state.s}%,0%)`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, STRIP_W, STRIP_H);
}
function redrawAll() { drawHueStrip(); drawSatStrip(); drawLitStrip(); }

// ── Apply HSL → cursors + preview ──────────────
function applyHSL() {
  hueCursor.style.top = (state.h / 360) * STRIP_H + 'px';
  satCursor.style.top = (1 - state.s / 100) * STRIP_H + 'px';
  litCursor.style.top = (1 - state.l / 100) * STRIP_H + 'px';
  hueCursor.style.background = `hsl(${state.h},100%,50%)`;
  satCursor.style.background = `hsl(${state.h},${state.s}%,50%)`;
  litCursor.style.background = `hsl(${state.h},${state.s}%,${state.l}%)`;
  const rgb = hslToRgb(state.h, state.s, state.l);
  state.guessColor = rgb;
  guessPreview.style.background = rgbStr(rgb);
  guessHex.textContent = rgbToHex(rgb).toUpperCase();
  drawSatStrip(); drawLitStrip();
}

// ── Strip drag ──────────────────────────────────
function yFrac(e, el) {
  const rect = el.getBoundingClientRect();
  const src  = e.touches ? e.touches[0] : e;
  return Math.max(0, Math.min(1, (src.clientY - rect.top) / rect.height));
}
function onStripMove(e) {
  if (!state.drag) return;
  const frac = yFrac(e, state.drag === 'hue' ? hueWrap : state.drag === 'sat' ? satWrap : litWrap);
  if (state.drag === 'hue') state.h = Math.round(frac * 360);
  if (state.drag === 'sat') state.s = Math.round((1 - frac) * 100);
  if (state.drag === 'lit') state.l = Math.round((1 - frac) * 100);
  applyHSL();
}
function bindStrip(wrap, name) {
  const start = e => { e.preventDefault(); state.drag = name; onStripMove(e); };
  wrap.addEventListener('mousedown',  start);
  wrap.addEventListener('touchstart', start, { passive: false });
}
bindStrip(hueWrap, 'hue');
bindStrip(satWrap, 'sat');
bindStrip(litWrap, 'lit');
document.addEventListener('mousemove', e => { if (state.drag) onStripMove(e); });
document.addEventListener('touchmove', e => { if (state.drag) { e.preventDefault(); onStripMove(e); }}, { passive: false });
document.addEventListener('mouseup',   () => { state.drag = null; });
document.addEventListener('touchend',  () => { state.drag = null; });

// ── Screen switch ───────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ── Memorize phase ──────────────────────────────
function startMemorize() {
  state.playerName = playerNameInput.value.trim() || 'Аноним';
  // hide name row after first start
  nameRow.classList.add('hidden');
  memorizeSubtitle.textContent = 'Запомни этот цвет!';

  state.targetColor = generateColor(state.difficulty);
  targetSwatch.style.background = rgbStr(state.targetColor);
  targetSwatch.classList.remove('hidden');
  timerBarWrap.classList.remove('hidden');

  timerBar.style.transition = 'none';
  timerBar.style.width = '100%';
  countdownLabel.textContent = state.memorizeTime + ' с';
  btnStart.style.display = 'none';

  requestAnimationFrame(() => {
    timerBar.style.transition = `width ${state.memorizeTime}s linear`;
    timerBar.style.width = '0%';
  });

  let rem = state.memorizeTime;
  const tick = () => {
    rem--;
    if (rem > 0) {
      countdownLabel.textContent = rem + ' с';
      state.timerHandle = setTimeout(tick, 1000);
    } else {
      countdownLabel.textContent = '';
      startGuess();
    }
  };
  state.timerHandle = setTimeout(tick, 1000);
}

// ── Guess phase ─────────────────────────────────
function startGuess() {
  state.h = 0; state.s = 0; state.l = 50;
  redrawAll(); applyHSL();
  showScreen('guess');
}

// ── Submit ──────────────────────────────────────
function submitGuess() {
  const t = state.targetColor, g = state.guessColor;
  const dist  = colorDistance(t, g);
  const dE    = deltaE(t, g);
  const score = Math.max(0, Math.round(100 - (dist / 441) * 100));

  resultTarget.style.background = rgbStr(t);
  resultGuess.style.background  = rgbStr(g);

  resultStats.innerHTML = `
    <span class="label">Оригинал:</span>
    <span class="value">${rgbToHex(t).toUpperCase()} &nbsp; rgb(${t.r}, ${t.g}, ${t.b})</span><br>
    <span class="label">Твой ответ:</span>
    <span class="value">${rgbToHex(g).toUpperCase()} &nbsp; rgb(${g.r}, ${g.g}, ${g.b})</span><br>
    <span class="label">Расстояние RGB:</span>
    <span class="value">${dist.toFixed(1)} / 441</span><br>
    <span class="label">Воспринимаемое ΔE:</span>
    <span class="value">${dE.toFixed(1)}</span><br>
    <span class="label">Счёт:</span>
    <span class="value">${score} / 100</span>
  `;

  resultGrade.className = 'grade';
  let txt;
  if      (score >= 90) { txt = '🏆 Отлично!';         resultGrade.classList.add('excellent'); }
  else if (score >= 70) { txt = '👍 Хорошо!';           resultGrade.classList.add('good'); }
  else if (score >= 45) { txt = '😐 Неплохо';           resultGrade.classList.add('ok'); }
  else                  { txt = '😬 Попробуй ещё раз';  resultGrade.classList.add('poor'); }
  resultGrade.textContent = txt;

  // Save to leaderboard
  saveEntry({
    name:       state.playerName,
    score,
    dE:         Math.round(dE * 10) / 10,
    difficulty: state.difficulty,
    target:     rgbToHex(t),
    guess:      rgbToHex(g),
    date:       new Date().toLocaleDateString('ru-RU'),
  });

  showScreen('result');
}

// ── Leaderboard storage ─────────────────────────
const LS_KEY = 'colorGuesserLB';

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}
function saveEntry(entry) {
  const entries = loadEntries();
  entries.push(entry);
  // keep best 200 entries sorted by score desc
  entries.sort((a, b) => b.score - a.score);
  localStorage.setItem(LS_KEY, JSON.stringify(entries.slice(0, 200)));
}

function gradeClass(score) {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 45) return 'ok';
  return 'poor';
}
function diffLabel(d) {
  return { easy:'Лёгкий', medium:'Средний', hard:'Сложный' }[d] || d;
}
function rankSymbol(i) {
  return ['🥇','🥈','🥉'][i] ?? (i + 1);
}

function renderLeaderboard() {
  const all  = loadEntries();
  const diff = state.lbFilter;
  const rows = diff === 'all' ? all : all.filter(e => e.difficulty === diff);

  if (rows.length === 0) {
    lbBody.innerHTML = '';
    lbEmpty.classList.remove('hidden');
    return;
  }
  lbEmpty.classList.add('hidden');

  lbBody.innerHTML = rows.map((e, i) => `
    <tr class="${i < 3 ? 'rank-'+(i+1) : ''}">
      <td>${rankSymbol(i)}</td>
      <td>${escHtml(e.name)}</td>
      <td><span class="lb-score ${gradeClass(e.score)}">${e.score}</span></td>
      <td>${e.dE}</td>
      <td><span class="lb-diff ${e.difficulty}">${diffLabel(e.difficulty)}</span></td>
      <td style="font-size:0.8rem;color:var(--muted)">${e.date}</td>
    </tr>
  `).join('');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function openLeaderboard(fromScreen) {
  state.prevScreen = fromScreen;
  state.lbFilter = 'all';
  lbFilters.forEach(b => b.classList.toggle('active', b.dataset.diff === 'all'));
  renderLeaderboard();
  showScreen('leaderboard');
}

// ── Filter buttons ───────────────────────────────
lbFilters.forEach(btn => {
  btn.addEventListener('click', () => {
    lbFilters.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.lbFilter = btn.dataset.diff;
    renderLeaderboard();
  });
});

// ── Settings ────────────────────────────────────
btnSettings.addEventListener('click', () => {
  settingTime.value = state.memorizeTime;
  settingDifficulty.value = state.difficulty;
  modalSettings.classList.remove('hidden');
});
btnSettingsSave.addEventListener('click', () => {
  state.memorizeTime = Math.max(1, Math.min(30, +settingTime.value)) || 5;
  state.difficulty   = settingDifficulty.value;
  modalSettings.classList.add('hidden');
});
btnSettingsCancel.addEventListener('click', () => modalSettings.classList.add('hidden'));
modalSettings.addEventListener('click', e => {
  if (e.target === modalSettings) modalSettings.classList.add('hidden');
});

// ── Wiring ───────────────────────────────────────
btnStart.addEventListener('click', () => {
  if (!playerNameInput.value.trim()) {
    playerNameInput.focus();
    playerNameInput.style.borderColor = 'var(--accent)';
    return;
  }
  playerNameInput.style.borderColor = '';
  showScreen('memorize');
  startMemorize();
});

btnSubmit.addEventListener('click', submitGuess);

btnAgain.addEventListener('click', () => {
  btnStart.style.display = '';
  targetSwatch.classList.add('hidden');
  timerBarWrap.classList.add('hidden');
  countdownLabel.textContent = '';
  memorizeSubtitle.textContent = 'Следующий раунд!';
  showScreen('memorize');
});

btnOpenLb.addEventListener('click', () => openLeaderboard('memorize'));
btnShowLb.addEventListener('click', () => openLeaderboard('result'));

btnLbBack.addEventListener('click', () => showScreen(state.prevScreen));

btnLbClear.addEventListener('click', () => {
  if (confirm('Удалить все результаты?')) {
    localStorage.removeItem(LS_KEY);
    renderLeaderboard();
  }
});

// ── Init ─────────────────────────────────────────
redrawAll();
applyHSL();
showScreen('memorize');
