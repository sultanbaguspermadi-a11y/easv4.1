// Floating engine. One implementation of move / resize / clamp / raise / persist, used by two kinds of thing:
//   popups   Settings (#ad), the gameplay dialogue (#dlg) and the word-log drawer (#hist): always movable, remembered per device.
//   modules  Board, player panels, controls and word log: movable AND resizable, but only while "Floating Workspace" is ON.
// Floating Workspace is a presentation layer: it sets <html data-floating="true"> plus inline left/top/size on the modules.
// Turning it off removes all of that (attribute, handles, inline geometry), so the normal CSS layout and dims.js are back at once.
// Precedence while ON:  saved override for this orientation  >  default derived from the current layout + Dimensions sliders.
// Storage: scrabble.float (popup positions, unchanged format) and scrabble.floatWorkspace.v2 (on/off + per-orientation geometry).
// Pure UI: no game state is read or written here.
import { NAMES } from './config.js';

const LEGACY = 'scrabble.float', WSKEY = 'scrabble.floatWorkspace.v2', M = 8;
const ORI = ['portrait', 'landscape'];
const html = () => document.documentElement;
const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

// ---------- persisted state ----------
let saved = read(LEGACY) || {};                                  // popups: { id: [x, y] }
const ws = { enabled: false, portrait: {}, landscape: {} };      // workspace: per orientation { id: {x, y, s | w, h?} }
{
  const s = read(WSKEY);
  if (s && s.v === 2) {
    ws.enabled = s.enabled === true;
    for (const o of ORI) for (const [id, g] of Object.entries(s[o] || {}))
      if (g && typeof g === 'object' && Object.values(g).every(Number.isFinite)) ws[o][id] = g;
  }
}
const saveWS = () => write(WSKEY, { v: 2, enabled: ws.enabled, portrait: ws.portrait, landscape: ws.landscape });
const savePopups = () => write(LEGACY, saved);

// ---------- viewport: safe-area aware, never relies on 100vh ----------
let probe;
function area() {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.append(probe);
  }
  const c = getComputedStyle(probe), p = k => parseFloat(c[k]) || 0;
  const a = { x0: p('paddingLeft') + M, y0: p('paddingTop') + M, x1: innerWidth - p('paddingRight') - M, y1: innerHeight - p('paddingBottom') - M };
  a.w = Math.max(0, a.x1 - a.x0); a.h = Math.max(0, a.y1 - a.y0);
  return a;
}
const orient = () => innerWidth > innerHeight ? 'landscape' : 'portrait';
const fit = (x, y, w, h) => { const a = area(); return [clamp(x, a.x0, a.x1 - w), clamp(y, a.y0, a.y1 - h)]; };

// ---------- module table ----------
// axes: 's' = square (board, 1:1), 'x' = width only (height follows the content, so racks and buttons are never stretched), 'xy' = both
const DEFS = {
  board: { sel: '.boardWrap', axes: 's', label: 'اللوح' },
  p0: { sel: '#pn0', axes: 'x', label: NAMES[0] },
  p1: { sel: '#pn1', axes: 'x', label: NAMES[1] },
  ctrls: { sel: '.ctrls', axes: 'x', label: 'أزرار التحكم' },
  hist: { axes: 'xy', label: 'سجل الكلمات' },
  dlg: { axes: 'x', label: 'النافذة', popupPos: true }   // the dialogue keeps its position with the popups; only its width is a workspace value
};
const things = {};   // id -> { id, el, def, isPopup, canMove(), canResize(), place() }
// z-index bands: workspace modules < popups (settings, open word log) < gameplay dialogue < native modal dialogs (top layer) < PWA notices
const BASE = { mod: 10, pop: 30, dlg: 50 }, order = { mod: [], pop: [], dlg: [] };
const inWs = t => ws.enabled && !!t.def && !t.def.popupPos;
const bandOf = t => t.id === 'dlg' ? 'dlg' : inWs(t) ? 'mod' : 'pop';
export function raise(t) {
  if (typeof t === 'string') t = things[t];
  if (!t) return;
  for (const b of Object.values(order)) { const i = b.indexOf(t); if (i >= 0) b.splice(i, 1); }
  const k = bandOf(t); order[k].push(t);
  order[k].forEach((x, i) => { x.el.style.zIndex = BASE[k] + i; });   // ranks inside a band: bounded, never an ever-growing counter
}

function limits(t) {
  const a = area(), id = t.id;
  if (id === 'board') {
    const b = t.el.querySelector('.board'), extra = Math.max(0, t.el.offsetHeight - (b ? b.offsetHeight : 0));
    const maxW = Math.max(120, Math.min(a.w, a.h - extra));   // on a tiny window the board may drop below its usual minimum rather than leave the screen
    return { minW: Math.min(240, maxW), maxW, extra };
  }
  if (id === 'hist') return { minW: 200, maxW: Math.min(a.w, 560), minH: 160, maxH: a.h };
  if (id === 'ctrls') return { minW: 144, maxW: Math.min(a.w, 640) };
  if (id === 'dlg') return { minW: 260, maxW: Math.min(a.w, 560) };
  return { minW: 160, maxW: Math.min(a.w, 520) };   // player panels
}

// ---------- applying geometry ----------
function setSize(t, w, h) {
  const L = limits(t), el = t.el;
  if (t.def.axes === 's') { el.style.setProperty('--float-board-size', clamp(w, L.minW, L.maxW) + 'px'); return; }
  el.style.width = clamp(w, L.minW, L.maxW) + 'px';
  if (t.def.axes === 'xy' && h != null) el.style.height = clamp(h, L.minH, L.maxH) + 'px';
}
function setPos(t, x, y) {
  const r = t.el.getBoundingClientRect(), [px, py] = fit(x, y, r.width, r.height);
  t.el.style.left = px + 'px'; t.el.style.top = py + 'px';
}
function geomOf(t) {   // what is on screen right now, in storable form
  const r = t.el.getBoundingClientRect(), g = { x: r.left, y: r.top };
  if (t.def.axes === 's') g.s = r.width; else g.w = r.width;
  if (t.def.axes === 'xy') g.h = r.height;
  return g;
}
function applyGeom(t, g) {
  if (g.s != null || g.w != null) setSize(t, g.s ?? g.w, g.h);
  setPos(t, g.x, g.y);
}

// ---------- default geometry: from the live viewport, the Classic/Duel preferences and the Dimensions sliders ----------
const cssNum = n => parseFloat(getComputedStyle(html()).getPropertyValue(n)) || 1;
function defaults(o) {
  const a = area(), d = html().dataset, T = things, g = {};
  const bs = Math.min(1, cssNum('--board-scale')), rs = cssNum('--rack-scale'), hw = cssNum('--hist-w'), hh = cssNum('--hist-hs');
  const left = d.swap === 'true' ? 'p1' : 'p0', right = left === 'p0' ? 'p1' : 'p0';
  const histOn = d.hist === 'docked' && !T.hist.el.classList.contains('history-hidden');
  const dock = d.pdock || 'bottom';
  const anchor = (h, top, bot) => dock === 'top' ? top : dock === 'middle' ? top + (bot - top - h) / 2 : bot - h;
  const measure = (t, w) => { t.el.style.width = w + 'px'; return t.el.offsetHeight; };
  const bl = limits(T.board), extra = bl.extra;
  if (o === 'landscape') {
    // board centred and as tall as the screen allows; player panels hug it on both sides; controls under the right panel
    const s = clamp(Math.min(a.h - extra, a.w - 2 * 176 - 2 * M) * bs, bl.minW, bl.maxW);
    const colW = clamp((a.w - s) / 2 - M, 168, 300), pw = clamp(colW * (0.5 + 0.5 * rs), 160, 300);
    const bx = a.x0 + (a.w - s) / 2, lx = Math.max(a.x0, bx - M - pw), rx = Math.min(a.x1 - pw, bx + s + M);
    const hp = measure(T[left], pw); measure(T[right], pw); const hc = measure(T.ctrls, pw);
    const stack = hp + M + hc, ctrlsRight = stack <= a.h;   // a very short screen moves the controls under the other panel
    const yR = anchor(ctrlsRight ? stack : hp, a.y0, a.y1), yL = anchor(ctrlsRight ? hp : stack, a.y0, a.y1);
    g.board = { x: bx, y: a.y0, s };
    g[right] = { x: rx, y: yR, w: pw }; g[left] = { x: lx, y: yL, w: pw };
    g.ctrls = ctrlsRight ? { x: rx, y: yR + hp + M, w: pw } : { x: lx, y: yL + hp + M, w: pw };
    const wid = clamp(colW * hw, 200, Math.min(560, a.w)), below = (ctrlsRight ? yL + hp : yL + stack) + M, room = a.y1 - below;
    g.hist = room >= 160 ? { x: Math.max(a.x0, lx + pw - wid), y: below, w: wid, h: clamp(Math.min(room, 560 * hh), 160, a.h) }
      : { x: Math.max(a.x0, lx), y: a.y0, w: wid, h: clamp(Math.min(a.h, 560 * hh), 160, a.h) };
  } else {
    // board on top at full width, the two panels side by side under it, controls under them
    const pw = Math.floor((a.w - M) / 2);
    const hp = measure(T[left], pw); measure(T[right], pw); const hc = measure(T.ctrls, a.w);
    const s = clamp(Math.min(a.w, a.h - extra - M - hp - M - hc - (histOn ? 150 + M : 0)) * bs, bl.minW, bl.maxW);
    const yP = a.y0 + s + extra + M, below = yP + hp + M + hc + M;
    g.board = { x: a.x0 + (a.w - s) / 2, y: a.y0, s };
    g[left] = { x: a.x0, y: yP, w: pw }; g[right] = { x: a.x1 - pw, y: yP, w: pw };
    g.ctrls = { x: a.x0, y: yP + hp + M, w: a.w };
    const wid = clamp(Math.min(a.w, 380) * hw, 200, a.w);
    g.hist = histOn && a.y1 - below >= 150 ? { x: a.x0, y: below, w: a.w, h: Math.min(a.y1 - below, 560 * hh) }
      : { x: a.x0 + (a.w - wid) / 2, y: a.y0, w: wid, h: clamp(Math.min(a.h, 560 * hh, 0.7 * innerHeight), 160, a.h) };
  }
  return g;
}

export function refreshWorkspace() {
  if (!ws.enabled || !things.board) return;
  const o = orient(), mods = Object.values(things).filter(t => t.def && !t.def.popupPos);
  const D = mods.some(t => !ws[o][t.id]) ? defaults(o) : null;   // overrides are only clamped for display, never rewritten
  for (const t of mods) applyGeom(t, ws[o][t.id] || D[t.id]);
  const dlg = things.dlg; if (dlg) dlg.el.style.width = ws[o].dlg ? clamp(ws[o].dlg.w, 260, Math.min(area().w, 560)) + 'px' : '';
}
function reflowPopups() {
  for (const t of Object.values(things)) if (t.isPopup && !inWs(t) && t.canMove() && t.el.matches('[open],.open')) { const r = t.el.getBoundingClientRect(); setPos(t, r.left, r.top); }
}
const schedule = (() => { let f = 0; return () => { if (f) return; f = requestAnimationFrame(() => { f = 0; refreshWorkspace(); reflowPopups(); }); }; })();

// ---------- commit (only on pointerup / keyboard step, never while moving) ----------
function commit(t, resized) {
  const r = t.el.getBoundingClientRect(), o = orient();
  if (ws.enabled && t.def && !t.def.popupPos) { ws[o][t.id] = geomOf(t); saveWS(); return; }
  saved[t.id] = [r.left, r.top]; savePopups();
  if (ws.enabled && t.def && resized) { ws[o][t.id] = { w: r.width }; saveWS(); }
}
function resetOne(t) {
  const o = orient();
  if (ws.enabled && t.def) { delete ws[o][t.id]; saveWS(); }
  if (inWs(t)) return refreshWorkspace();
  delete saved[t.id]; savePopups(); if (t.def && t.id === 'dlg') t.el.style.removeProperty('width'); t.place();
}

// ---------- pointer + keyboard behaviour shared by every move handle and resize grip ----------
const flag = (t, on) => t.el.classList.toggle('flActive', on);
function bindHandle(t, h) {
  let drag = null, raf = 0;
  h.addEventListener('pointerdown', e => {
    if (e.button || !t.canMove()) return;
    const r = t.el.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    h.setPointerCapture(e.pointerId); e.preventDefault(); raise(t); flag(t, true);
  });
  h.addEventListener('pointermove', e => {
    if (!drag) return; drag.x = e.clientX - drag.dx; drag.y = e.clientY - drag.dy;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (drag) setPos(t, drag.x, drag.y); });
  });
  const end = () => {
    if (!drag) return; cancelAnimationFrame(raf); raf = 0;
    if (drag.x != null) setPos(t, drag.x, drag.y);
    drag = null; flag(t, false); commit(t);
  };
  h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  h.addEventListener('dblclick', () => { if (t.canMove()) resetOne(t); });
  h.addEventListener('keydown', e => {
    if (!t.canMove() || e.altKey || e.ctrlKey || e.metaKey) return;
    const s = e.shiftKey ? 64 : 16, r = t.el.getBoundingClientRect();
    const mv = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
    if (mv) { e.preventDefault(); setPos(t, r.left + mv[0], r.top + mv[1]); commit(t); return; }
    const grow = { '+': s, '=': s, '-': -s, _: -s }[e.key];   // keyboard resize that leaves the arrow keys to movement
    if (grow && t.canResize()) { e.preventDefault(); resizeBy(t, grow, grow); }
  });
  h.addEventListener('focus', () => raise(t));
}
function resizeBy(t, dw, dh) {
  const r = t.el.getBoundingClientRect(), a = area(), ax = t.def.axes;
  if (ax === 's') setSize(t, Math.min(r.width + dw, a.x1 - r.left, a.y1 - r.top - limits(t).extra), 0);
  else setSize(t, Math.min(r.width + dw, a.x1 - r.left), ax === 'xy' ? Math.min(r.height + dh, a.y1 - r.top) : null);
  setPos(t, r.left, r.top); commit(t, true);
}
function bindGrip(t, g) {
  let rs = null, raf = 0;
  const apply = e => {
    const a = area(), r = t.el.getBoundingClientRect(), dx = e.clientX - rs.x, dy = e.clientY - rs.y, ax = t.def.axes;
    if (ax === 's') { const d = Math.abs(dx) >= Math.abs(dy) ? dx : dy; setSize(t, Math.min(rs.w + d, a.x1 - r.left, a.y1 - r.top - limits(t).extra), 0); }
    else setSize(t, Math.min(rs.w + dx, a.x1 - r.left), ax === 'xy' ? Math.min(rs.h + dy, a.y1 - r.top) : null);
  };
  g.addEventListener('pointerdown', e => {
    if (e.button || !t.canResize()) return;
    const r = t.el.getBoundingClientRect(); rs = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
    g.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation(); raise(t); flag(t, true);
  });
  g.addEventListener('pointermove', e => { if (rs && !raf) raf = requestAnimationFrame(() => { raf = 0; if (rs) apply(e); }); });
  const end = e => {
    if (!rs) return; cancelAnimationFrame(raf); raf = 0;
    if (e.type === 'pointerup') apply(e);
    rs = null; flag(t, false); commit(t, true);
  };
  g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
  g.addEventListener('keydown', e => {
    const s = e.shiftKey ? 64 : 16, d = { ArrowRight: s, ArrowDown: s, ArrowLeft: -s, ArrowUp: -s }[e.key];
    if (d && t.canResize()) { e.preventDefault(); resizeBy(t, d, d); }
  });
  g.addEventListener('dblclick', () => { if (t.canResize()) resetOne(t); });
}
const GRIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10L10 20M20 16l-4 4"/></svg>';
function addChrome(t) {
  if (t.chrome) return; t.chrome = [];
  if (!t.isPopup) {   // modules without a title bar get a slim move strip (word log and dialogue reuse their title)
    const h = document.createElement('button'); h.type = 'button'; h.className = 'flMove';
    h.setAttribute('aria-label', `تحريك ${t.def.label}: الأسهم للتحريك، + و − للحجم، نقر مزدوج لإعادة الضبط`); h.title = 'اسحب لتحريك ' + t.def.label;
    t.el.prepend(h); bindHandle(t, h); t.chrome.push(h);
  }
  const g = document.createElement('button'); g.type = 'button'; g.className = 'flGrip';
  g.setAttribute('aria-label', `تغيير حجم ${t.def.label}: الأسهم`); g.title = 'اسحب لتغيير الحجم'; g.innerHTML = GRIP;
  t.el.append(g); bindGrip(t, g); t.chrome.push(g);
}
const removeChrome = t => { (t.chrome || []).forEach(n => n.remove()); t.chrome = null; };
const clearInline = t => { for (const p of ['left', 'top', 'width', 'height', 'z-index', '--float-board-size']) t.el.style.removeProperty(p); };

// ---------- popups: settings, gameplay dialogue, word-log drawer ----------
const isFixed = t => getComputedStyle(t.el).position === 'fixed' && !t.el.classList.contains('dlgModal');
// opts.def: name of the DEFS entry that makes this popup resizable while Floating Workspace is ON ('hist', 'dlg')
export function makeFloating(el, id, handle, defPos, opts = {}) {
  const t = things[id] = { id, el, handle, def: opts.def ? DEFS[opts.def] : null, isPopup: true };
  t.canMove = () => isFixed(t);
  t.canResize = () => !!t.def && ws.enabled && isFixed(t);
  t.place = () => { if (inWs(t)) return refreshWorkspace(); const p = saved[id] || defPos(el); setPos(t, p[0], p[1]); };
  handle.classList.add('floatHandle'); handle.tabIndex = 0;
  handle.title = 'اسحب لتحريك النافذة · مزدوج النقر لإعادة الموضع';
  el.addEventListener('pointerdown', () => raise(t), true);
  bindHandle(t, handle);
}
export function showFloat(id) { const t = things[id]; if (t) { t.place(); raise(t); } }
// Default spot for the gameplay dialogue: the free corner/edge that hides the least of the board, the racks and the controls.
export function autoPos(el) {
  const a = area(), w = el.offsetWidth, h = el.offsetHeight;
  const rects = [['#board', 4], ['.panel.on .rack', 5], ['.rack', 2], ['.ctrls', 2.5], ['.panel', 1]]
    .flatMap(([s, k]) => [...document.querySelectorAll(s)].map(n => [n.getBoundingClientRect(), k])).filter(([r]) => r.width && r.height);
  const xs = [a.x0, (a.x0 + a.x1 - w) / 2, a.x1 - w], ys = [a.y0, (a.y0 + a.y1 - h) / 2, a.y1 - h];
  const tries = orient() === 'portrait' ? [[1, 0], [1, 2], [0, 0], [2, 0], [0, 2], [2, 2], [0, 1], [2, 1], [1, 1]]
    : [[0, 0], [2, 0], [0, 2], [2, 2], [0, 1], [2, 1], [1, 0], [1, 2], [1, 1]];
  let best = null;
  for (const [i, j] of tries) {
    const x = xs[i], y = ys[j]; let sc = 0;
    for (const [r, k] of rects) sc += k * Math.max(0, Math.min(x + w, r.right) - Math.max(x, r.left)) * Math.max(0, Math.min(y + h, r.bottom) - Math.max(y, r.top));
    if (!best || sc < best.sc - 1) best = { sc, x, y };
  }
  return [best.x, best.y];
}
// Resets popup positions and workspace geometry only; theme, dimensions, layout, game state and history are not touched.
export function resetFloats() {
  saved = {}; savePopups(); ws.portrait = {}; ws.landscape = {}; saveWS();
  if (ws.enabled) refreshWorkspace();
  for (const t of Object.values(things)) if (t.isPopup && !inWs(t) && t.canMove() && t.el.matches('[open],.open')) { if (t.id === 'dlg') t.el.style.removeProperty('width'); t.place(); }
}

// ---------- input lock: how a dialogue looks never decides whether the game behind it can be touched ----------
const locks = new Set();
function applyLocks() {
  document.querySelectorAll('.app > *').forEach(n => { n.inert = locks.has('dlg') || (locks.has('settings') && n.id !== 'hist'); });
}
export function lockGame(reason, on) { if (on) locks.add(reason); else locks.delete(reason); applyLocks(); }
// While the settings window floats (non-modal) the game behind it stays frozen, exactly as the old modal did.
export const gameInert = on => lockGame('settings', on);

// ---------- Floating Workspace on/off ----------
export const isFloating = () => ws.enabled;
export function initWorkspace() {   // after buildDom(): the player panels exist now
  for (const id of ['board', 'p0', 'p1', 'ctrls']) {
    const el = document.querySelector(DEFS[id].sel);
    const t = things[id] = { id, el, def: DEFS[id], isPopup: false, canMove: () => ws.enabled, canResize: () => ws.enabled };
    el.addEventListener('pointerdown', () => raise(t), true);
  }
  addEventListener('resize', schedule); addEventListener('orientationchange', schedule);
  document.addEventListener('eas:dims', schedule);
  document.fonts?.ready.then(schedule);
  if (ws.enabled) enter();
}
function enter() {
  html().dataset.floating = 'true';
  for (const t of Object.values(things)) if (t.def) addChrome(t);
  refreshWorkspace();
  for (const t of Object.values(things)) if (t.def && !t.def.popupPos) raise(t);
}
function leave() {
  delete html().dataset.floating;
  for (const t of Object.values(things)) {
    if (!t.def) continue;
    removeChrome(t);
    if (t.id === 'dlg') t.el.style.removeProperty('width'); else clearInline(t);
  }
  for (const b of Object.values(order)) b.length = 0;
  const h = things.hist; if (h && h.el.classList.contains('open')) showFloat('hist');   // drawer open: back to its remembered popup spot
}
export function setFloating(on) {
  on = !!on; if (on === ws.enabled) return;
  ws.enabled = on; saveWS();
  if (on) enter(); else leave();
}
// Layout preference / dimension change while ON: modules without an override follow the new defaults.
export const refresh = schedule;
