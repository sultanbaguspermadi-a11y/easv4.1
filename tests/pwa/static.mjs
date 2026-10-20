// Static PWA checks (no browser): manifest, icons, paths, precache coverage, version stamp.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process'; import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = p => fs.readFileSync(path.join(root, p), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name).split(path.sep).join('/')]);

// --- manifest
const mf = JSON.parse(rd('manifest.webmanifest'));
for (const k of ['name', 'short_name', 'description', 'lang', 'start_url', 'scope', 'display', 'background_color', 'theme_color', 'icons']) ok(mf[k], `manifest has ${k}`);
ok(mf.display === 'standalone', 'display standalone');
ok(mf.start_url === './' && mf.scope === './', 'start_url and scope are relative to the manifest (deployment base path)');
ok(!/^\//.test(mf.start_url) && mf.icons.every(i => !/^\//.test(i.src)), 'no root-relative URLs in the manifest');
ok(mf.short_name.length <= 15, 'short_name is short enough for a home screen label');
const png = p => { const b = fs.readFileSync(path.join(root, p)); return { sig: b.subarray(0, 8).toString('hex'), w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: b[25] }; };
for (const i of mf.icons) {
  ok(fs.existsSync(path.join(root, i.src)), `icon exists: ${i.src}`);
  const { sig, w, h } = png(i.src), [sw, sh] = i.sizes.split('x').map(Number);
  ok(sig === '89504e470d0a1a0a' && w === sw && h === sh, `${i.src} is a real PNG of ${i.sizes} (got ${w}x${h})`);
}
ok(mf.icons.some(i => i.sizes === '192x192' && i.purpose === 'any') && mf.icons.some(i => i.sizes === '512x512' && i.purpose === 'any'), '192 and 512 any icons');
ok(mf.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'), '512 maskable icon');
ok(mf.icons.every(i => !/\s/.test(i.purpose) ), 'purposes are not combined ("any maskable" renders badly on some launchers)');
const apple = png('assets/icons/apple-touch-icon.png');
ok(apple.w === 180 && apple.h === 180 && apple.type === 2, 'apple-touch-icon is 180x180 and opaque (colour type RGB, no alpha)');
ok(png('assets/icons/maskable-512.png').type === 2, 'maskable icon is opaque full-bleed');
ok(png('assets/icons/icon-512.png').type === 6, '"any" icon keeps its transparent rounded corners');

// --- index.html
const html = rd('index.html');
ok(/<link rel="manifest" href="manifest\.webmanifest">/.test(html), 'manifest linked (relative)');
ok(/<meta name="theme-color"/.test(html) && /<meta name="viewport"[^>]*viewport-fit=cover/.test(html), 'theme-color and viewport-fit=cover');
ok(/rel="apple-touch-icon" href="assets\/icons\/apple-touch-icon\.png"/.test(html), 'apple-touch-icon linked');
ok(/apple-mobile-web-app-capable/.test(html) && /mobile-web-app-capable" content="yes"/.test(html) && /apple-mobile-web-app-title/.test(html), 'iOS + Chromium web-app metadata');
const refs = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map(m => m[1]).filter(u => !/^(https?:|data:|mailto:)/.test(u));
for (const r of refs) { ok(!r.startsWith('/'), `index.html reference is relative: ${r}`); ok(fs.existsSync(path.join(root, r)), `index.html reference resolves: ${r}`); }

// --- no root-relative URLs anywhere in shipped code (would break a /repo/ sub-path)
for (const f of ['index.html', 'sw.js', ...walk('css'), ...walk('js')]) {
  const t = rd(f);
  const bad = [...t.matchAll(/(?:url\(\s*['"]?|href=["']|src=["']|fetch\(\s*['"`]|register\(\s*['"`]|from\s+['"])\/(?!\/)/g)];
  ok(bad.length === 0, `no root-relative URL in ${f}`);
}

// --- service worker: precache list covers everything the game loads, nothing missing, version stamped
const sw = rd('sw.js');
const list = new Function('return ' + /const PRECACHE = (\[[\s\S]*?\]);/.exec(sw)[1])();
ok(new Set(list).size === list.length, 'PRECACHE has no duplicates');
for (const p of list) ok(fs.existsSync(path.join(root, p)), `PRECACHE file exists: ${p}`);
const shipped = ['index.html', 'manifest.webmanifest', ...walk('css'), ...walk('js'), ...walk('assets')];
for (const p of shipped) ok(list.includes(p), `shipped file is precached: ${p}`);
const mods = walk('js').flatMap(f => [...rd(f).matchAll(/from\s+'(\.\/[^']+)'/g)].map(m => 'js/' + m[1].slice(2)));
for (const m of mods) ok(list.includes(m), `imported module is precached: ${m}`);
for (const m of rd('css/style.css').matchAll(/url\('\.\.\/([^']+)'\)/g)) ok(list.includes(m[1]), `CSS asset is precached: ${m[1]}`);
ok(!list.some(p => /^(tests|tools)\//.test(p)), 'dev-only folders are not precached');
ok(!/const VERSION = 'dev'/.test(sw), 'sw.js VERSION has been stamped');
try { execFileSync('node', ['tools/stamp-sw.mjs', '--check'], { cwd: root, stdio: 'pipe' }); ok(true); }
catch (e) { ok(false, 'sw.js VERSION is current: ' + (e.stderr || e.stdout || e.message)); }

// --- themes + board styling guards
const themesCss = rd('css/themes.css'), styleCss = rd('css/style.css');
const themeBlocks = [...themesCss.matchAll(/\[data-theme="(\w+)"\]\s*\{([\s\S]*?)\n\}/g)].map(m => [m[1], new Set([...m[2].matchAll(/(--[\w-]+)\s*:/g)].map(t => t[1]))]);
const allTokens = new Set(themeBlocks.flatMap(([, t]) => [...t]));
ok(themeBlocks.length === 4, 'four theme blocks found in themes.css');
for (const [id, toks] of themeBlocks) { const missing = [...allTokens].filter(t => !toks.has(t)); ok(!missing.length, `theme ${id} defines every token (missing: ${missing.join(', ')})`); }
ok(allTokens.has('--tile-cast'), 'themes define --tile-cast (colour of the shadow a placed tile casts)');
// Placed tiles carry no glow: a blur-only shadow (0 0 Npx) on .tile.cur is what used to make them glow after placement. The glow belongs to .pick (touch) only.
const curRule = styleCss.match(/\n\.tile\.cur\{([^}]*)\}/);
const layers = (curRule?.[1].match(/box-shadow:([^;]*)/)?.[1] ?? '').split(/,(?![^(]*\))/).map(l => l.trim()).filter(Boolean);
ok(curRule && layers.length > 0 && layers.every(l => l.startsWith('inset') || !/^0 0 [\d.]+(px|cqw)/.test(l)), '.tile.cur (placed, unscored tile) has no outer glow (only an inset ring): ' + layers.join(' | '));
ok(/\.sq\.has::before\{[^}]*var\(--tile-cast/.test(styleCss), 'board tiles cast their shadow from the square (.sq.has::before, themed by --tile-cast)');
ok(/\.sq\.has\.fall::before\{animation:cast/.test(styleCss) && /@keyframes cast\{from\{transform:[^}]*opacity/.test(styleCss), 'landing shadow animates transform + opacity only');
ok(!/@keyframes cast\{[^]*?(box-shadow|filter)/.test(styleCss.match(/@keyframes cast\{[^\n]*/)[0]), 'landing shadow keyframes do not animate box-shadow/filter (repaint-free)');
// Word log: icon-only button that still has an accessible name
const indexHtml = rd('index.html'), bLog = indexHtml.match(/<button[^>]*id="bLog"[^>]*>([\s\S]*?)<\/button>/);
ok(bLog && /aria-label="[^"]+"/.test(bLog[0]) && /<svg/.test(bLog[1]) && !/>\s*[^<\s]/.test(bLog[1].replace(/<svg[\s\S]*<\/svg>/, '')), 'word-log button is icon-only (svg, no text) and has an aria-label');

console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
