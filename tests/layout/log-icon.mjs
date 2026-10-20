// Word-log icon in the default drawer layout: a small icon in the board's end corner that never covers the board, the bag counter or the page edge,
// in both layouts (classic, duel) and at every viewport; it must open/close the drawer and keep an accessible name.
import { launch, openGame, closeGame, VIEWPORTS } from './lib.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const b = await launch();
const MEASURE = () => {
  const btn = document.querySelector('#bLog'), wrap = document.querySelector('.boardWrap'), bag = document.querySelector('#bagInfo'), board = document.querySelector('#board');
  const r = btn.getBoundingClientRect(), w = wrap.getBoundingClientRect(), bd = board.getBoundingClientRect(), g = document.createRange(); g.selectNodeContents(bag);
  const t = g.getBoundingClientRect(), bagBox = bag.getBoundingClientRect(), pad = 6;   // pad = the invisible touch area around the icon (.logBtn::after)
  const hits = (a, c) => !(a.right <= c.left || a.left >= c.right || a.bottom <= c.top || a.top >= c.bottom);
  const touch = { left: r.left - pad, right: r.right + pad, top: r.top - pad, bottom: r.bottom + pad };
  const cs = getComputedStyle(btn);
  return {
    shown: cs.display !== 'none', w: r.width, h: r.height, text: btn.textContent.trim(), label: btn.getAttribute('aria-label'), svg: !!btn.querySelector('svg'),
    rtl: getComputedStyle(document.documentElement).direction === 'rtl', cornerGap: Math.abs(r.left - w.left), cornerGapR: Math.abs(r.right - w.right),
    overBoard: hits(r, bd), touchOverSquare: [...document.querySelectorAll('#board .sq')].some(s => hits(touch, s.getBoundingClientRect())),
    overText: hits(r, { left: t.left, right: t.right, top: bagBox.top, bottom: bagBox.bottom }),
    inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0, hOverflow: document.documentElement.scrollWidth > innerWidth,
    layout: document.documentElement.dataset.layout, hist: document.documentElement.dataset.hist,
  };
};
for (const layout of ['classic', 'duel']) {
  let first = true;
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    const tag = `${layout} / ${name}`;
    const { page, errors } = await openGame(b, vp, { storage: { 'scrabble.layout': JSON.stringify({ layout }) } });   // no "hist" key = the default drawer
    const m = await page.evaluate(MEASURE);
    ok((m.layout ?? 'classic') === layout && m.hist === 'drawer', `${tag}: test setup is ${layout} + drawer (got ${m.layout ?? 'classic'}/${m.hist})`);   // classic = no data-layout attribute
    ok(m.shown && m.svg && m.text === '' && !!m.label, `${tag}: icon-only button with an accessible name (${JSON.stringify({ shown: m.shown, svg: m.svg, text: m.text, label: m.label })})`);
    ok(m.w >= 24 && m.w <= 36 && Math.abs(m.w - m.h) < 0.5, `${tag}: small and round-ish (${m.w}x${m.h})`);
    ok(m.rtl ? m.cornerGap <= 1 : m.cornerGapR <= 1, `${tag}: sits in the board's end corner (gap ${m.cornerGap.toFixed(1)}px)`);
    ok(!m.overBoard, `${tag}: does not cover the board`);
    ok(!m.touchOverSquare, `${tag}: its touch padding does not reach any board square`);
    ok(!m.overText, `${tag}: does not overlap the bag counter text`);
    ok(m.inView && !m.hOverflow, `${tag}: inside the viewport, no horizontal scroll`);
    if (first) {   // behaviour once per layout: opens, closes with the same button, closes with Esc
      first = false;
      const st = () => page.evaluate(() => ({ open: document.querySelector('#hist').classList.contains('open'), exp: document.querySelector('#bLog').getAttribute('aria-expanded') }));
      ok(JSON.stringify(await st()) === '{"open":false,"exp":"false"}', `${tag}: drawer starts closed`);
      await page.$eval('#bLog', e => e.click()); ok(JSON.stringify(await st()) === '{"open":true,"exp":"true"}', `${tag}: click opens the drawer`);
      await page.$eval('#bLog', e => e.click()); ok(JSON.stringify(await st()) === '{"open":false,"exp":"false"}', `${tag}: second click closes it`);
      await page.$eval('#bLog', e => e.click()); await page.keyboard.press('Escape'); ok(JSON.stringify(await st()) === '{"open":false,"exp":"false"}', `${tag}: Esc closes it`);
    }
    ok(errors.length === 0, `${tag}: no page errors: ${errors.join(';')}`);
    await closeGame(page);
  }
}
await b.close();
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
