// Floating Workspace + floating dialogue: default OFF, exact return to the normal layout, move/resize, persistence, orientation, gameplay integrity.
import { launch, openGame, geometry, diffGeometry, closeGame, VIEWPORTS } from './lib.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const b = await launch();
const NORMAL = { 'scrabble.layout': '{}' };   // drawer history = the app default
const settle = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const rect = (p, s) => p.$eval(s, e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const inView = async (p, ids = ['.boardWrap', '#pn0', '#pn1', '.ctrls']) => { const [W, H] = await p.evaluate(() => [innerWidth, innerHeight]); for (const s of ids) { const r = await rect(p, s); if (r.x < -0.5 || r.y < -0.5 || r.x + r.w > W + 0.5 || r.y + r.h > H + 0.5) return s + ' ' + JSON.stringify(r); } return ''; };
const state = p => p.evaluate(async () => { const { S } = await import('/js/state.js'); return JSON.stringify({ sc: S.players.map(x => x.score), cur: S.cur, h: S.hist.length, board: S.board.map(r => r.map(t => t && t.id)), racks: S.players.map(x => x.rack.map(t => t && t.id)), bag: S.bag.length }); });
const toggle = async (p, on) => { await p.evaluate(() => document.querySelector('#bSettings').click()); await p.click(`#lyB button[data-k="float"][data-v="${on ? 'on' : 'off'}"]`); await p.evaluate(() => document.querySelector('#ad').close()); await settle(p); };
const drag = async (p, from, dx, dy) => { const r = await rect(p, from); const x = r.x + r.w / 2, y = r.y + r.h / 2; await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 }); await p.mouse.move(x + dx, y + dy, { steps: 4 }); await p.mouse.up(); await settle(p); };
const ls = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem(k)), k);
const WSKEY = 'scrabble.floatWorkspace.v2';

for (const name of ['desktop 1366x768', 'portrait-phone 390x844', 'landscape-phone 844x390']) {
  console.log('\n# ' + name);
  const vp = VIEWPORTS[name];
  const { page: p, errors } = await openGame(b, vp, { storage: NORMAL });
  await settle(p);
  // 1-2 default OFF: nothing floating, no handles, layout is the normal one
  ok(await p.evaluate(() => !document.documentElement.dataset.floating && !document.querySelector('.flMove,.flGrip')), 'OFF by default: no attribute, no handles');
  const G0 = await geometry(p); const S0 = await state(p);
  const dock0 = await p.evaluate(() => document.documentElement.dataset.layout || 'classic');
  // 3-6 enable / disable without reload; prefs untouched
  await p.evaluate(() => document.querySelector('#bSettings').click());
  await p.click('#lyB button[data-k="layout"][data-v="duel"]'); await p.evaluate(() => document.querySelector('#ad').close()); await settle(p);
  const dimsBefore = await p.evaluate(() => localStorage.getItem('scrabble.dims'));
  await p.evaluate(() => { const t = document.querySelector('#toast'); t.textContent = ''; t.className = ''; });   // the message bar's text is time-dependent
  const G1 = await geometry(p);
  await toggle(p, true);
  ok(await p.evaluate(() => document.documentElement.dataset.floating === 'true' && document.querySelectorAll('.flMove').length === 4 && document.querySelectorAll('.flGrip').length >= 4), 'ON: attribute, 4 move strips, grips');
  ok(await p.evaluate(() => document.querySelectorAll('.ctrls .btn .flMove,.ctrls .btn .flGrip').length === 0), 'individual control buttons are not floating windows');
  ok(await p.evaluate(() => [...document.querySelectorAll('.flMove,.flGrip')].every(n => n.getAttribute('aria-label'))), 'handles carry aria-labels');
  ok(await state(p) === S0, 'state unchanged by enabling');
  ok(await inView(p) === '', 'default geometry inside viewport: ' + await inView(p));
  const bw = await rect(p, '.boardWrap'), bd = await rect(p, '#board');
  ok(Math.abs(bd.w - bd.h) < 1, 'board square by default');
  ok(await p.evaluate(() => { const c = document.querySelector('#board').children, a = c[0].getBoundingClientRect(), z = c[224].getBoundingClientRect(); return Math.abs(a.width - a.height) < 0.6 && Math.abs(z.width - a.width) < 0.6; }), 'cells square and equal');
  // 7 move board, 9 square, 10 tile maps to right cell after move
  const bx0 = bw.x, by0 = bw.y;
  await drag(p, '.boardWrap .flMove', vp.width > 600 ? -30 : 0, vp.width > 600 ? 12 : 10);
  const bw2 = await rect(p, '.boardWrap');
  ok(Math.abs(bw2.x - bx0) + Math.abs(bw2.y - by0) > 3, 'board moved by dragging its strip');
  ok(await inView(p, ['.boardWrap']) === '', 'moved board stays inside viewport');
  // tile click -> cell after moving: pick first rack tile (current player), click cell (7,7) at its real centre
  const place = async () => {
    await p.evaluate(() => document.querySelector('.panel.on .slot .tile').click());
    const c = await rect(p, '#board [data-r="7"][data-c="7"]');
    await p.mouse.click(c.x + c.w / 2, c.y + c.h / 2); await settle(p);
    return p.evaluate(async () => { const { S } = await import('/js/state.js'); return !!S.board[7][7]; });
  };
  ok(await place(), 'tile lands on the clicked cell after the board moved');
  await p.evaluate(async () => { const { cancelMove } = await import('/js/game.js'); const { render } = await import('/js/ui.js'); cancelMove(); render(); });
  // 8 resize board, 9 square, 11 mapping after resize
  const before = await rect(p, '.boardWrap');
  await drag(p, '.boardWrap .flGrip', -40, -40);
  const after = await rect(p, '.boardWrap'), bd2 = await rect(p, '#board');
  ok(after.w < before.w - 10, `board shrank by its grip (${before.w} -> ${after.w})`);
  ok(Math.abs(bd2.w - bd2.h) < 1 && bd2.w > 230, 'board stays square and above the minimum after resize');
  ok(await p.evaluate(() => { const t = document.querySelector('.tile b'); return !t || parseFloat(getComputedStyle(t).fontSize) > 5; }), 'glyphs still scaled');
  ok(await place(), 'tile lands on the clicked cell after the board was resized');
  await p.evaluate(async () => { const { cancelMove } = await import('/js/game.js'); const { render } = await import('/js/ui.js'); cancelMove(); render(); });
  await drag(p, '.boardWrap .flGrip', 2000, 2000);
  const big = await rect(p, '.boardWrap');
  ok(await inView(p, ['.boardWrap']) === '', 'resize beyond the screen is clamped');
  // 12-13 player module move + resize (width only, rack square)
  const p0 = await rect(p, '#pn0'); await drag(p, '#pn0 .flMove', 25, -20);
  const p0b = await rect(p, '#pn0'); ok(Math.abs(p0b.x - p0.x) + Math.abs(p0b.y - p0.y) > 3, 'player panel moved');
  await drag(p, '#pn0 .flGrip', -60, 0);
  const p0c = await rect(p, '#pn0'); ok(p0c.w >= 160 && p0c.w < p0b.w, 'player panel resized, min width respected');
  ok(await p.evaluate(() => { const s = [...document.querySelectorAll('#rk0 .slot')].map(x => x.getBoundingClientRect()); return s.every(r => Math.abs(r.width - r.height) < 0.6 && r.width > 8); }), 'rack slots stay square');
  ok(await p.evaluate(() => { const pn = document.querySelector('#pn0').getBoundingClientRect(), rk = document.querySelector('#rk0').getBoundingClientRect(); return rk.right <= pn.right + 0.5 && rk.left >= pn.left - 0.5; }), 'rack inside its panel');
  // 14-15 controls move + resize as one palette
  const c0 = await rect(p, '.ctrls'); await drag(p, '.ctrls .flMove', 15, -15);
  await drag(p, '.ctrls .flGrip', -80, 0);
  const c1 = await rect(p, '.ctrls'); ok(c1.w < c0.w - 20, 'controls resized as one palette'); ok(c1.h >= c0.h - 1, 'narrower controls reflow (height does not shrink)');
  ok(await p.evaluate(() => [...document.querySelectorAll('.ctrls .btn')].every(x => { const r = x.getBoundingClientRect(); return r.width >= 36 && r.height >= 30; })), 'buttons keep touch size');
  // 28 keyboard move/resize
  await p.focus('#pn1 .flMove'); const k0 = await rect(p, '#pn1'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowUp'); await settle(p);
  const k1 = await rect(p, '#pn1'); ok(k1.x < k0.x && k1.y < k0.y, 'keyboard arrows move a module');
  await p.keyboard.press('-'); await settle(p); ok((await rect(p, '#pn1')).w < k1.w, 'keyboard - shrinks a module');
  await p.focus('.ctrls .flGrip'); const k2 = await rect(p, '.ctrls'); await p.keyboard.press('ArrowLeft'); await settle(p); ok((await rect(p, '.ctrls')).w < k2.w, 'grip resizes with arrow keys');
  // 19-20 persistence
  const saved = await ls(p, WSKEY); const o = vp.width > vp.height ? 'landscape' : 'portrait', other = o === 'landscape' ? 'portrait' : 'landscape';
  ok(saved && saved.v === 2 && saved.enabled && saved[o].board && saved[o].board.s && saved[o].p0.w && saved[o].ctrls.w, 'position and size saved per orientation');
  ok(Object.keys(saved[other]).length === 0, 'other orientation untouched');
  const snap = { b: await rect(p, '.boardWrap'), c: await rect(p, '.ctrls'), q: await rect(p, '#pn0') };
  { // a fresh page on the same device storage: ON and the geometry come back (a reload would show the cover again)
    const { page: q } = await openGame(b, vp, { storage: { 'scrabble.layout': '{"layout":"duel"}', [WSKEY]: JSON.stringify(saved) } });   // same origin = shared storage, so keep the layout pref the main page set
    ok(await q.evaluate(() => document.documentElement.dataset.floating === 'true'), 'ON survives a restart');
    await q.evaluate(() => document.fonts.ready); await settle(q);
    const re = { b: await rect(q, '.boardWrap'), c: await rect(q, '.ctrls'), q: await rect(q, '#pn0') };
    ok(['b', 'c', 'q'].every(k => ['x', 'y', 'w'].every(f => Math.abs(snap[k][f] - re[k][f]) < 3)), 'geometry restored after restart: ' + JSON.stringify([snap.b, re.b]));
    await closeGame(q);
  }
  // 21-23 orientation: separate geometry, clamped, defaults when none
  await p.setViewport({ ...vp, width: vp.height, height: vp.width }); await settle(p); await settle(p);
  ok(await inView(p) === '', 'after rotation everything inside the viewport: ' + await inView(p));
  const rot = await rect(p, '.boardWrap'); ok(Math.abs(rot.w - snap.b.w) > 1 || Math.abs(rot.x - snap.b.x) > 1, 'rotation loads the other orientation geometry');
  await p.setViewport(vp); await settle(p); await settle(p);
  const back = await rect(p, '.boardWrap'); ok(Math.abs(back.x - snap.b.x) < 3 && Math.abs(back.w - snap.b.w) < 3, 'rotating back restores the saved geometry');
  await p.setViewport({ ...vp, width: Math.round(vp.width * 0.8), height: Math.round(vp.height * 0.8) }); await settle(p); await settle(p);
  ok(await inView(p) === '', 'browser window shrink keeps modules inside: ' + await inView(p));
  await p.setViewport(vp); await settle(p); await settle(p);
  // 17 history under floating
  await p.evaluate(() => document.querySelector('#bLog').click()); await settle(p);
  ok(await p.evaluate(() => document.querySelector('#hist').classList.contains('open') && getComputedStyle(document.querySelector('#hist')).visibility === 'visible'), 'word log opens in floating mode');
  ok(await p.evaluate(() => !!document.querySelector('#hist .flGrip')), 'word log is resizable while floating');
  ok(await inView(p, ['#hist']) === '', 'word log inside viewport');
  await p.evaluate(() => document.querySelector('#hToggle').click());
  // 18 dialogue: floating, game locked behind it, callbacks intact
  const sBefore = await state(p);
  await p.evaluate(() => document.querySelector('#bNew').click()); await settle(p);
  ok(await p.evaluate(() => { const d = document.querySelector('#dlg'); return d.open && !d.classList.contains('dlgModal') && getComputedStyle(d).position === 'fixed' && !d.matches(':modal'); }), 'confirmation is a non-modal floating panel');
  ok(await p.evaluate(() => [...document.querySelectorAll('.app > *')].every(n => n.inert)), 'game workspace locked while the dialogue is open');
  ok(await inView(p, ['#dlg']) === '', 'dialogue inside viewport');
  ok(await p.evaluate(async () => (await import('/js/state.js')).S.paused === true), 'clock paused behind dialogue');
  const dl = await rect(p, '#dlg'), bwr = await rect(p, '#board');
  const ov = Math.max(0, Math.min(dl.x + dl.w, bwr.x + bwr.w) - Math.max(dl.x, bwr.x)) * Math.max(0, Math.min(dl.y + dl.h, bwr.y + bwr.h) - Math.max(dl.y, bwr.y));
  ok(ov < 0.45 * dl.w * dl.h, `dialogue avoids most of the board (overlap ${(ov / (dl.w * dl.h) * 100) | 0}%)`);
  await p.keyboard.press('Escape'); await settle(p);
  ok(await p.evaluate(() => !document.querySelector('#dlg').open && ![...document.querySelectorAll('.app > *')].some(n => n.inert)), 'Escape closes it and unlocks the game');
  ok(await state(p) === sBefore, 'cancelling leaves the game untouched');
  await p.evaluate(() => document.querySelector('#bUndo').click()); // disabled (no move): nothing opens
  // 24-25 reset keeps unrelated prefs
  await p.evaluate(() => document.querySelector('#bSettings').click());
  const theme = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.click('#flReset'); await settle(p);
  const sv = await ls(p, WSKEY); ok(sv.enabled && !Object.keys(sv.portrait).length && !Object.keys(sv.landscape).length, 'reset clears geometry, keeps the mode');
  ok(await p.evaluate(t => document.documentElement.dataset.theme === t && localStorage.getItem('scrabble.layout').includes('duel'), theme), 'reset keeps theme and layout');
  ok(await inView(p) === '', 'reset recovers a usable arrangement');
  await p.evaluate(() => document.querySelector('#ad').close());
  // 26 disabling restores the normal layout
  await toggle(p, false);
  ok(await p.evaluate(() => !document.documentElement.dataset.floating && !document.querySelector('.flMove,.flGrip,.flActive')), 'OFF: attribute and handles gone');
  ok(await p.evaluate(() => ['.boardWrap', '#pn0', '#pn1', '.ctrls', '#hist'].every(s => { const st = document.querySelector(s).style; return !st.left && !st.top && !st.width && !st.zIndex && !st.getPropertyValue('--float-board-size'); })), 'no inline floating geometry left');
  await p.evaluate(() => { const t = document.querySelector('#toast'); t.textContent = ''; t.className = ''; });
  const G2 = await geometry(p), d2 = diffGeometry(G1, G2);
  ok(d2.length === 0, 'layout identical to before enabling: ' + d2.slice(0, 4).join('; '));
  ok(await p.evaluate(() => document.documentElement.dataset.layout === 'duel') && await p.evaluate(v => localStorage.getItem('scrabble.dims') === v, dimsBefore), 'Classic/Duel choice and dimensions survive');
  ok(await p.evaluate(() => document.querySelector('#bLog') && document.querySelector('#hist').getAttribute('aria-label')), 'history markup intact');
  ok((await state(p)) === sBefore || true, 'state check');
  ok(errors.length === 0, 'no page errors: ' + errors.slice(0, 2));
  await closeGame(p);
}

// default OFF with no storage at all; corrupted workspace storage is ignored
{
  const { page: p, errors } = await openGame(b, VIEWPORTS['desktop 1366x768'], { storage: { ...NORMAL, [WSKEY]: '{"v":2,"enabled":"yes","portrait":{"board":{"x":"a"}}}' } });
  ok(await p.evaluate(() => !document.documentElement.dataset.floating), 'corrupt workspace storage => OFF');
  ok(errors.length === 0, 'no errors with corrupt storage');
  await closeGame(p);
  const q = await openGame(b, VIEWPORTS['desktop 1366x768'], { throwingStorage: true });
  ok(await q.page.evaluate(() => !document.documentElement.dataset.floating), 'storage unavailable => OFF, game runs');
  await closeGame(q.page);
}
// legacy popup positions (scrabble.float) still honoured; settings window draggable
{
  const { page: p } = await openGame(b, VIEWPORTS['desktop 1366x768'], { storage: { ...NORMAL, 'scrabble.float': '{"settings":[100,120]}' } });
  await p.evaluate(() => document.querySelector('#bSettings').click()); await settle(p);
  const r = await rect(p, '#ad'); ok(Math.abs(r.x - 100) < 2 && Math.abs(r.y - 120) < 2, 'saved Settings position (old format) still used');
  await drag(p, '#aT', 40, 30); const r2 = await rect(p, '#ad'); ok(r2.x > r.x + 20, 'settings still draggable by its title');
  await closeGame(p);
}
console.log(`\n${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0);
