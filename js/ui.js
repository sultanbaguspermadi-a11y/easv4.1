import { showFloat, gameInert, lockGame } from './float.js';
// DOM rendering, toasts and dialogs. Reads state; never mutates game rules.
import { SIZE, DURATIONS, BINGO, TOAST_MS, LAYOUT, GLYPH, FACE, LABEL, NAMES } from './config.js';
import { TILE_MODES } from './modes.js';
import { $, S, app, fmt, inMove, cur, profile } from './state.js';
import { syncDimRows } from './dims.js';

let cells = [], toastTimer = 0, dlgCb = null, dlgCancel = null;
const hs = {id: -1, v: -1};   // last rendered history (game id / version)

// ---------- Static DOM construction ----------
export function buildDom() {
  const board = $('#board');
  for (let i = 0; i < SIZE * SIZE; i++) {
    const d = document.createElement('div'); d.dataset.r = i / SIZE | 0; d.dataset.c = i % SIZE; d.tabIndex = 0; d.setAttribute('role', 'gridcell'); cells.push(d); board.append(d);
  }
  bindDlg();
  $('#players').innerHTML = [0, 1].map(i => `<div class="panel" id="pn${i}"><div class="phead"><span class="pname">${NAMES[i]}</span><span class="ptime" id="t${i}">25:00</span><span class="pscore" id="sc${i}">0</span></div><div class="rack" id="rk${i}" aria-label="رفّ ${NAMES[i]}"></div></div>`).join('');
  $('#sf').innerHTML = DURATIONS.map(m => `<button class="btn" value="${m}"><b>${m}</b><span>دقيقة</span></button>`).join('');
  $('#mf').innerHTML = Object.values(TILE_MODES).map(m => `<button class="btn modeBtn" value="${m.id}"><span class="mAr">${m.labelAr}</span><span class="mEn">${m.labelEn}</span><span class="mDesc">${m.descAr}</span></button>`).join('');
}
// The blank picker only offers the letters of the active tile mode (rebuilt for every new game).
export function buildBlankPicker() {
  $('#bf').innerHTML = [...profile().alpha].map(l => `<button class="btn" value="${l}">${FACE[l] || l}</button>`).join('');
}

// ---------- Feedback & dialogs ----------
export function toast(msg, ok) {
  const el = $('#toast'); el.textContent = msg; el.className = ok === false ? 'ok' : 'bad';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.textContent = ''; el.className = ''; }, TOAST_MS);
}
export function fail(msg) {
  toast(msg, true);
  const b = $('#board'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
}
// Gameplay confirmations float as a light panel (css/float.css, js/float.js) instead of a blocking centred modal; the game behind stays frozen
// by lockGame('dlg') + S.paused, so the look and the input lock are separate concerns. Rich results (end of game) and every dialogue shown
// before the match has started (cover, setup flow, resume prompt) stay conventional modals.
let dlgFocus = null;
const dlgFloats = () => $('#dlg').open && !$('#dlg').classList.contains('dlgModal');
export function ask(title, msg, okLabel, fn, onCancel = null, okCls = 'btn danger', cancelLabel = null) {
  const rich = typeof msg !== 'string', d = $('#dlg'), floating = !rich && !app.firstRun && $('#cover').hidden;
  $('#dT').textContent = title; d.classList.toggle('result', rich);
  if (rich) $('#dM').replaceChildren(msg); else $('#dM').textContent = msg;
  const f = $('#dF'); f.innerHTML = '';
  for (const [label, val, cls] of [[okLabel, 'ok', okCls], [cancelLabel || (onCancel ? 'رجوع' : 'إغلاق'), '', 'btn']]) {
    const b = document.createElement('button'); b.className = cls; b.value = val; b.textContent = label; f.append(b);
  }
  S.paused = true; dlgCb = fn; dlgCancel = onCancel; d.returnValue = '';
  d.classList.toggle('dlgModal', !floating);
  $('#dT').title = floating ? 'اسحب لتحريك النافذة · مزدوج النقر لإعادة الموضع' : '';
  if (!floating) return d.showModal();
  dlgFocus = document.activeElement; lockGame('dlg', true); d.show(); showFloat('dlg'); $('#dT').focus({preventScroll: true});
}
function bindDlg() {
  const d = $('#dlg');
  d.addEventListener('close', () => {   // registered before input.js, so the lock is released before any callback can open the next dialogue
    lockGame('dlg', false);
    const f = dlgFocus; dlgFocus = null;
    if (f && f.isConnected && !f.closest('[inert]') && f.focus) f.focus({preventScroll: true});
  });
  d.addEventListener('keydown', e => {   // a non-modal dialog ignores Esc natively and does not trap Tab
    if (!dlgFloats()) return;
    if (e.key === 'Escape') { e.preventDefault(); d.close(); return; }
    if (e.key !== 'Tab') return;
    const ok = [...d.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(n => n.offsetParent !== null);
    if (!ok.length) return;
    const i = ok.indexOf(document.activeElement), n = e.shiftKey ? (i <= 0 ? ok.length - 1 : i - 1) : (i === ok.length - 1 ? 0 : i + 1);
    e.preventDefault(); ok[n].focus();
  });
}
// End of game: centred announcement (winner line + one score card per player). rows: [{name, score, ded, bon}], winner: 0 | 1 | -1 (draw).
const TROPHY = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 01-8 0zM8 6H5v1a3 3 0 003 3M16 6h3v1a3 3 0 01-3 3M12 13v4M9 20h6M10 17h4"/></svg>';
export function showResult({reason, rows, winner}, onNew) {
  const box = document.createElement('div'); box.className = 'res';
  box.innerHTML = `<p class="resWhy">${reason}</p>`
    + `<p class="resWin${winner < 0 ? ' draw' : ''}">${winner < 0 ? 'تعادل!' : `${TROPHY}<span>الفائز: ${rows[winner].name}</span>`}</p>`
    + `<div class="resCards">${rows.map((r, i) => `<div class="resCard${i === winner ? ' win' : ''}"><span class="resName">${r.name}</span><b class="resScore">${r.score}</b>`
      + `<span class="resNote">خصم <span class="num">${r.ded}</span></span><span class="resNote">مكافأة وقت <span class="num">+${r.bon}</span></span></div>`).join('')}</div>`;
  ask('انتهت اللعبة', box, 'لعبة جديدة', onNew);
}
// Called by the dialog 'close' listener: returns and clears the pending callbacks.
export function takeDialogCallbacks() { const r = {ok: dlgCb, cancel: dlgCancel}; dlgCb = dlgCancel = null; return r; }

// Setup flow: chooseMode -> chooseDuration -> confirmation (input.js) -> newGame. The mode is only applied at the end.
export function chooseMode() {
  if (S.board) S.paused = true;
  $('#mCancel').hidden = app.firstRun;   // the very first prompt cannot be skipped
  $('#md').returnValue = ''; $('#md').showModal();
}
export function chooseDuration() {
  if (S.board) S.paused = true;
  for (const b of $('#sf').children) b.setAttribute('aria-current', String(+b.value === app.minutes));   // marks the length in use
  $('#sd').returnValue = ''; $('#sd').showModal();
}
export function openBlankPicker() { $('#bd').returnValue = ''; $('#bd').showModal(); }
export function openSettings() { S.paused = true; syncDimRows(); gameInert(true); $('#ad').show(); showFloat('settings'); $('#aT').focus(); }

// ---------- Rendering (DOM is only touched when a cell/rack/list actually changed) ----------
const sqHTML = k => {
  if (!LABEL[k]) return '';
  const [m, w] = LABEL[k].split(' ');
  return k === 5 ? '<span class="pl"><span>نجمة</span></span>' : `<span class="pl"><span class="m">${m}</span><span>${w}</span></span>`;
};
function tileHTML(t) {
  const L = t.blank ? (t.as || '') : t.l, v = t.blank ? 0 : t.v;
  const mine = cur().rack.includes(t), mv = inMove(t);
  const ok = !S.ended && (S.swap ? mine : (mine || mv));
  const cls = ['tile', t.blank && 'blank', mv && 'cur', S.pick === t && 'pick', S.sel.has(t) && 'swp', S.land === t && 'land', !ok && 'dim'].filter(Boolean).join(' ');
  return `<div class="${cls}" data-id="${t.id}" draggable="${ok && !S.swap}" tabindex="0" role="button"${ok ? '' : ' aria-disabled="true"'} aria-label="${L || 'قطعة فارغة'} قيمة ${v}"><b${GLYPH[L] ? ` style="transform:translate(${GLYPH[L][0]}em,${GLYPH[L][1]}em)"` : ''}>${FACE[L] || L}</b><i>${v}</i></div>`;
}
function renderBoard() {
  cells.forEach((el, i) => {
    const r = i / SIZE | 0, c = i % SIZE, t = S.board[r][c], k = LAYOUT[r][c];
    const h = t ? tileHTML(t) : sqHTML(k);
    if (el._h === h) return;
    el._h = h; el.innerHTML = h;
    el.className = 'sq k' + k + (t ? ' has' + (inMove(t) ? ' mv' : '') + (S.pick === t || S.land === t ? ' up' : '') + (S.land === t ? ' fall' : '') : '');
    el.setAttribute('aria-label', t ? (t.blank ? t.as : t.l) : (LABEL[k] ? (k === 5 ? 'مربع نجمة' : 'مربع ' + LABEL[k]) : 'مربع فارغ'));
  });
}
function renderPlayers() {
  S.players.forEach((p, i) => {
    const on = i === S.cur && !S.ended;
    $('#pn' + i).className = 'panel' + (on ? ' on' : ''); $('#pn' + i).setAttribute('aria-current', on);
    const sc = $('#sc' + i); sc.textContent = p.score;
    if (S.pop === i) { sc.classList.remove('pop'); void sc.offsetWidth; sc.classList.add('pop'); }
    const rk = $('#rk' + i), h = p.rack.map((t, k) => `<div class="slot" data-p="${i}" data-i="${k}">${t ? tileHTML(t) : ''}</div>`).join('');
    if (rk._h !== h) { rk._h = h; rk.innerHTML = h; }
  });
  S.pop = null;
}
function renderControls() {
  const mv = S.move.length > 0, E = S.ended;
  $('#bSubmit .lbl').textContent = S.swap ? `تأكيد التبديل (${S.sel.size})` : 'احتساب';
  $('#bSubmit').disabled = E || (S.swap ? !S.sel.size : !mv);
  $('#bCancel .lbl').textContent = S.swap ? 'إلغاء التبديل' : 'إلغاء الحركة';
  $('#bCancel').disabled = E || (!S.swap && !mv);
  $('#bSwap').disabled = E || S.swap || mv;
  $('#bPass').disabled = E || S.swap || mv;
  $('#bUndo').disabled = E || S.swap || mv || !S.undo;
  $('#bJudge').disabled = E || S.swap || mv || !S.undo;
  $('#bagInfo').textContent = `${profile().labelAr} · الكيس: ${S.bag.length}`;
}
export function tickUI() {
  S.players.forEach((p, i) => {
    const el = $('#t' + i), tx = fmt(p.ms);
    if (el.textContent !== tx) el.textContent = tx;
    const cn = 'ptime' + (p.ms < 60000 ? ' low' : '') + (p.ms < 10000 ? ' crit' : '') + (p.ms === 0 ? ' out' : '') + (!S.started && !S.ended ? ' wait' : '');
    if (el.className !== cn) el.className = cn;
  });
}
// Word chips shared by the history list and the judge dialog.
export const chips = e => `<div class="jw">${e.words.map(w => `<span class="chip">${w.w} <b>${w.pts}</b></span>`).join('')}${e.bingo ? '<span class="chip bingo">+' + BINGO + '</span>' : ''}</div>`;
function histItem(e) {
  const cls = 'hi p' + e.p + (e.st === 'void' ? ' void' : ''), who = NAMES[e.p];
  if (e.type !== 'move')
    return `<li class="${cls}"><div class="hh"><span class="hn">${e.n}</span><span>${who} — ${e.type === 'pass' ? 'مرّر الدور' : `بدّل ${e.cnt} قطع`}</span></div></li>`;
  const j = e.st ? `<div class="hj ${e.st}">${e.st === 'ok' ? '✔ صحيح' : '✖ خطأ'}${e.pen ? ` · غرامة التحدي −${e.pen}` : ''}</div>` : '';
  return `<li class="${cls}"><div class="hh"><span class="hn">${e.n}</span><span>${who}</span><b class="hp">${e.st === 'void' ? 0 : '+' + e.total}</b></div>${chips(e)}${j}</li>`;
}
function renderHist() {
  if (hs.id === app.gameId && hs.v === S.hv) return;
  hs.id = app.gameId; hs.v = S.hv;
  const best = S.hist.filter(e => e.type === 'move' && e.st !== 'void')
    .flatMap(e => e.words.map(w => ({...w, p: e.p}))).reduce((b, w) => !b || w.pts > b.pts ? w : b, null);
  $('#hList').innerHTML = S.hist.length ? S.hist.map(histItem).reverse().join('') : '<li class="hempty">لم تُسجَّل أي حركة بعد.</li>';
  $('#hBest').textContent = best ? `أعلى كلمة: ${best.w} (${best.pts} نقطة — ${NAMES[best.p]})` : '';
}
// Optional observer called after every render (js/persist.js uses it to save the match); the UI itself does not depend on it.
let afterRender = null;
export const onAfterRender = fn => { afterRender = fn; };
export function render() {
  if (S.pick && !(cur().rack.includes(S.pick) || inMove(S.pick))) S.pick = null;
  renderBoard(); renderPlayers(); renderControls(); renderHist(); tickUI(); S.land = null;
  if (afterRender) afterRender();
}
