/* =============================================
   COLOR GUESSER – app.js
   ============================================= */

// ── State ──────────────────────────────────────
const state = {
  // colors
  targetColor: { r: 0, g: 0, b: 0 },
  guessColor:  { r: 128, g: 128, b: 128 },
  // HSL picker
  h: 0, s: 0, l: 50,
  // game flow
  memorizeTime: 5,
  roundsTotal:  3,
  currentRound: 1,
  roundScores:  [],   // [{score, dE, target, guess}]
  playerName:   '',
  prevScreen:   'memorize',
  // drag
  drag: null,
};

// ── DOM refs ────────────────────────────────────
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
const roundBadgeMem   = document.getElementById('round-badge-mem');

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
const roundBadgeGuess = document.getElementById('round-badge-guess');

const resultRoundBadge= document.getElementById('result-round-badge');
const resultSubtitle  = document.getElementById('result-subtitle');
const resultTarget    = document.getElementById('result-target');
const resultGuess     = document.getElementById('result-guess');
const resultStats     = document.getElementById('result-stats');
const resultGrade     = document.getElementById('result-grade');
const roundsProgress  = document.getElementById('rounds-progress');
const finalTotal      = document.getElementById('final-total');
const totalVal        = document.getElementById('total-val');
const totalMax        = document.getElementById('total-max');
const btnNextRound    = document.getElementById('btn-next-round');
const btnAgain        = document.getElementById('btn-again');
const btnShowLb       = document.getElementById('btn-show-lb');
const btnSettings     = document.getElementById('btn-settings');
const btnOpenLb       = document.getElementById('btn-open-lb');

const lbBody    = document.getElementById('lb-body');
const lbEmpty   = document.getElementById('lb-empty');
const btnLbBack = document.getElementById('btn-lb-back');
const btnLbClear= document.getElementById('btn-lb-clear');

const modalSettings     = document.getElementById('modal-settings');
const settingTime       = document.getElementById('setting-time');
const settingRounds     = document.getElementById('setting-rounds');
const btnSettingsSave   = document.getElementById('btn-settings-save');
const btnSettingsCancel = document.getElementById('btn-settings-cancel');

const modalHelp      = document.getElementById('modal-help');
const btnHelp        = document.getElementById('btn-help');
const btnHelpClose   = document.getElementById('btn-help-close');

// ── Canvas sizes ────────────────────────────────
const STRIP_W = 52, STRIP_H = 340;
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
function gradeClass(score) {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 45) return 'ok';
  return 'poor';
}
function gradeEmoji(score) {
  if (score >= 90) return '🏆 Отлично!';
  if (score >= 70) return '👍 Хорошо!';
  if (score >= 45) return '😐 Неплохо';
  return '😬 Попробуй ещё';
}

// ── Generate color ───────────────────────────────
function rand(mn, mx) { return Math.round(Math.random()*(mx-mn)+mn); }
function generateColor() {
  return { r:rand(0,255), g:rand(0,255), b:rand(0,255) };
}

// ── Strip drawing ────────────────────────────────
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

// ── Apply HSL ────────────────────────────────────
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

// ── Screen helpers ──────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}
function setBadge(el, round, total) {
  const isFinal = round === total;
  el.textContent = isFinal ? `🏁 Финал (раунд ${total})` : `Раунд ${round} из ${total}`;
  el.classList.toggle('final', isFinal);
  el.classList.remove('hidden');
}

// ── Memorize phase ──────────────────────────────
function startMemorize() {
  state.targetColor = generateColor();
  targetSwatch.style.background = rgbStr(state.targetColor);
  targetSwatch.classList.remove('hidden');
  timerBarWrap.classList.remove('hidden');
  btnStart.style.display = 'none';
  nameRow.classList.add('hidden');
  memorizeSubtitle.textContent = 'Запомни этот цвет!';
  setBadge(roundBadgeMem, state.currentRound, state.roundsTotal);

  timerBar.style.transition = 'none';
  timerBar.style.width = '100%';
  countdownLabel.textContent = state.memorizeTime + ' с';

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
  setBadge(roundBadgeGuess, state.currentRound, state.roundsTotal);
  showScreen('guess');
}

// ── Submit guess ────────────────────────────────
function submitGuess() {
  const t = state.targetColor, g = state.guessColor;
  const dist  = colorDistance(t, g);
  const dE    = Math.round(deltaE(t, g) * 10) / 10;
  const score = Math.max(0, Math.round(100 - (dist / 441) * 100));

  state.roundScores.push({ score, dE, target: rgbToHex(t), guess: rgbToHex(g) });

  const isFinal = state.currentRound >= state.roundsTotal;
  showRoundResult(score, dE, t, g, isFinal);

  if (isFinal) {
    const total = state.roundScores.reduce((s, r) => s + r.score, 0);
    saveEntry({
      name:        state.playerName,
      totalScore:  total,
      maxScore:    state.roundsTotal * 100,
      rounds:      state.roundsTotal,
      roundScores: state.roundScores.map(r => r.score),
      date:        new Date().toLocaleDateString('ru-RU'),
    });
  } else {
    state.currentRound++;
  }
}

// ── Show round result ───────────────────────────
function showRoundResult(score, dE, t, g, isFinal) {
  // Badge
  setBadge(resultRoundBadge, state.currentRound, state.roundsTotal);
  resultSubtitle.textContent = isFinal ? 'Финальный результат' : 'Результат раунда';

  // Swatches
  resultTarget.style.background = rgbStr(t);
  resultGuess.style.background  = rgbStr(g);

  // Stats
  resultStats.innerHTML = `
    <span class="label">Оригинал:</span>
    <span class="value">${rgbToHex(t).toUpperCase()} &nbsp; rgb(${t.r},${t.g},${t.b})</span><br>
    <span class="label">Твой ответ:</span>
    <span class="value">${rgbToHex(g).toUpperCase()} &nbsp; rgb(${g.r},${g.g},${g.b})</span><br>
    <span class="label">Расстояние RGB:</span>
    <span class="value">${colorDistance(t,g).toFixed(1)} / 441</span><br>
    <span class="label">Воспринимаемое ΔE:</span>
    <span class="value">${dE}</span><br>
    <span class="label">Счёт раунда:</span>
    <span class="value">${score} / 100</span>
  `;

  // Grade
  resultGrade.className = 'grade ' + gradeClass(score);
  resultGrade.textContent = gradeEmoji(score);

  // Rounds progress pills
  renderRoundsPills(isFinal);

  // Final total
  if (isFinal) {
    const total = state.roundScores.reduce((s, r) => s + r.score, 0);
    const max   = state.roundsTotal * 100;
    totalVal.textContent = total;
    totalMax.textContent = `/ ${max}`;
    totalVal.style.color = score2color(Math.round(total / max * 100));
    finalTotal.classList.remove('hidden');
  } else {
    finalTotal.classList.add('hidden');
  }

  // Buttons
  btnNextRound.classList.toggle('hidden', isFinal);
  btnAgain.classList.toggle('hidden', !isFinal);

  showScreen('result');
}

function renderRoundsPills(isFinal) {
  roundsProgress.innerHTML = '';
  for (let i = 0; i < state.roundsTotal; i++) {
    const pill = document.createElement('div');
    pill.className = 'round-pill';
    const roundNum = i + 1;
    const done = i < state.roundScores.length;
    if (done) {
      const s = state.roundScores[i].score;
      pill.classList.add('done-' + gradeClass(s));
      if (roundNum === state.currentRound && !isFinal) pill.classList.add('current');
      pill.textContent = `${roundNum}: ${s}`;
    } else {
      pill.classList.add('pending');
      pill.textContent = `${roundNum}: —`;
    }
    roundsProgress.appendChild(pill);
  }
}

function score2color(pct) {
  if (pct >= 90) return '#4ade80';
  if (pct >= 70) return '#facc15';
  if (pct >= 45) return '#fb923c';
  return 'var(--accent)';
}

// ── Leaderboard (server API) ─────────────────────
async function loadEntries() {
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) throw new Error('bad response');
    return await res.json();
  } catch {
    return [];
  }
}

async function saveEntry(entry) {
  try {
    const entries = await loadEntries();
    entries.push(entry);
    entries.sort((a, b) => b.totalScore - a.totalScore);
    await fetch('/api/leaderboard', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(entries.slice(0, 200)),
    });
  } catch (e) {
    console.error('Leaderboard save failed:', e);
  }
}

function rankSymbol(i) { return ['🥇','🥈','🥉'][i] ?? (i + 1); }

async function renderLeaderboard() {
  lbBody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);padding:20px">Загрузка…</td></tr>';
  lbEmpty.classList.add('hidden');
  const rows = await loadEntries();

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
      <td><span class="lb-score ${gradeClass(Math.round(e.totalScore / e.maxScore * 100))}">
        ${e.totalScore} <small style="color:var(--muted)">/ ${e.maxScore}</small>
      </span></td>
      <td style="color:var(--muted)">${e.rounds}</td>
      <td style="font-size:0.8rem;color:var(--muted)">${e.date}</td>
    </tr>
  `).join('');
}

async function openLeaderboard(fromScreen) {
  state.prevScreen = fromScreen;
  showScreen('leaderboard');
  await renderLeaderboard();
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Settings ────────────────────────────────────
btnSettings.addEventListener('click', () => {
  settingTime.value   = state.memorizeTime;
  settingRounds.value = state.roundsTotal;
  modalSettings.classList.remove('hidden');
});
btnSettingsSave.addEventListener('click', () => {
  state.memorizeTime = Math.max(1, Math.min(30, +settingTime.value))   || 5;
  state.roundsTotal  = Math.max(1, Math.min(10, +settingRounds.value)) || 3;
  modalSettings.classList.add('hidden');
});
btnSettingsCancel.addEventListener('click', () => modalSettings.classList.add('hidden'));
modalSettings.addEventListener('click', e => {
  if (e.target === modalSettings) modalSettings.classList.add('hidden');
});

// ── Help ─────────────────────────────────────────
btnHelp.addEventListener('click', () => modalHelp.classList.remove('hidden'));
btnHelpClose.addEventListener('click', () => modalHelp.classList.add('hidden'));
modalHelp.addEventListener('click', e => {
  if (e.target === modalHelp) modalHelp.classList.add('hidden');
});

// ── Wiring ───────────────────────────────────────
btnStart.addEventListener('click', () => {
  if (!playerNameInput.value.trim()) {
    playerNameInput.focus();
    playerNameInput.style.borderColor = 'var(--accent)';
    return;
  }
  playerNameInput.style.borderColor = '';
  state.playerName  = playerNameInput.value.trim();
  state.currentRound = 1;
  state.roundScores  = [];
  showScreen('memorize');
  startMemorize();
});

btnSubmit.addEventListener('click', submitGuess);

btnNextRound.addEventListener('click', () => {
  showScreen('memorize');
  startMemorize();
});

btnAgain.addEventListener('click', () => {
  // Reset for new game — show name entry
  playerNameInput.value = '';
  nameRow.classList.remove('hidden');
  roundBadgeMem.classList.add('hidden');
  targetSwatch.classList.add('hidden');
  timerBarWrap.classList.add('hidden');
  countdownLabel.textContent = '';
  memorizeSubtitle.textContent = 'Введи имя и начинай!';
  btnStart.style.display = '';
  showScreen('memorize');
});

btnOpenLb.addEventListener('click', () => openLeaderboard('memorize'));
btnShowLb.addEventListener('click', () => openLeaderboard('result'));

btnLbBack.addEventListener('click', () => showScreen(state.prevScreen));

btnLbClear.addEventListener('click', async () => {
  if (!confirm('Удалить все результаты?')) return;
  try {
    await fetch('/api/leaderboard', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    '[]',
    });
    renderLeaderboard();
  } catch (e) {
    alert('Ошибка при очистке: ' + e.message);
  }
});

// ── Init ─────────────────────────────────────────
redrawAll();
applyHSL();
showScreen('memorize');
