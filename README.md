# Arabic Scrabble Integrated Version

A two-player, local Arabic Scrabble game that runs entirely in the browser.

This project evolved from the original repository, [DAXEI08/update-version](https://github.com/DAXEI08/update-version), and merges its two Arabic tile-set variants into one shared game engine, with a selectable visual theme system on top.

> **One game engine, one ruleset, two tile sets, multiple visual themes.**

## Features

- Two-player local Arabic Scrabble on the classic 15×15 board
- **Expanded** and **Basic** tile modes (chosen when a game starts)
- Selectable visual themes, applied instantly and remembered on the device
- Per-player timer (the clock starts after the first move)
- Undo of the last move
- Tile swap
- **Unlimited pass**: there is no pass or skip limit
- Human **tahkim** (judging): the challenger rules the last move **✔ صحيح** or **✖ خطأ**
- Move history with words, scores, bingos, passes, swaps and tahkim verdicts, with a show/hide toggle (إخفاء السجل / إظهار السجل) that never moves the racks, buttons or board
- Blank tiles (always worth 0)
- Responsive layout for desktop, tablet and mobile, portrait and landscape
- Adjustable interface dimensions (board, racks, buttons, history)
- **Installable, offline-capable PWA** (Android, iPhone/iPad, desktop) and **automatic match recovery** after a refresh, close or suspension (see "PWA" below)

There is no automatic dictionary: word validity is decided only by the players through tahkim.

## Modes

Both modes use the same engine, gameplay, board, scoring, timer, tahkim, UI, and features. **The only difference is the tile distribution and the blank-tile alphabet.**

| Mode | Arabic label | Tiles | Blank tile can become |
|---|---|---|---|
| Expanded | الحروف الموسعة | the 28 basic letters plus `أ إ آ ء ؤ ئ ة ى` (101 tiles incl. 2 blanks) | any of those 36 letters |
| Basic | الحروف الأساسية | the 28 basic letters only (84 tiles incl. 2 blanks) | only the 28 basic letters |

- The mode is picked at game setup: **PLAY → tile mode → duration → confirmation → game**. It cannot change while a game is running; **New game** goes back through mode selection.
- Tiles are never normalised (`أ` stays `أ`, `ة` stays `ة`, …). The letter `ه` is stored as plain `ه`; the `هـ` face on the tile is display-only (`FACE` in `config.js`).
- Both tile sets, their values and counts, and the blank alphabets live in `js/modes.js` as plain data. The engine just reads `TILE_MODES[app.mode]`.

## Themes

Themes only change presentation. They never affect the mode, tile distribution, scoring, timer, tahkim, board coordinates, placement, game state, history or dimensions. Choose one in **الإعدادات → المظهر**; it applies immediately without reloading and never resets the game.

| Theme | Arabic | Character |
|---|---|---|
| Classic | كلاسيكي | wood tones, cream tiles, dark green lettering (default) |
| Dark | داكن | charcoal panels, high-contrast light tiles, amber accents |
| Emerald | زمردي | emerald green, cream and gold |
| Desert | صحراوي | a light theme: sand, terracotta, warm brown, ivory, muted gold |

The selected theme is stored in `localStorage` under `scrabble.theme`. If the value is missing, unreadable, or not a known theme id, the game falls back to Classic. Interface dimensions are stored separately under `scrabble.dims`, so resetting one never affects the other.

### How themes work

`js/themes.js` only sets `<html data-theme="id">`. All colours are CSS custom properties defined once per theme in `css/themes.css`; there is no per-element styling from JavaScript and no duplicated stylesheet. To add a theme, add a block in `themes.css` that defines every token, and an entry in `THEMES` in `themes.js`.

## Tile effects and result screen

- **Touch highlight, not a permanent glow.** A picked tile flickers (a 1 Hz colour pulse on its ring). It does so on every device, including when the OS asks to reduce motion: it is feedback, involves no movement, and `prefers-reduced-motion` still switches off every other animation and transition. Once placed, a tile has no glow and no coloured outline: an unscored (pending) tile is told apart by a golden tint and a lifted shadow, a scored one by plain ivory and a tight shadow. `tests/contrast.py` checks that the tint stays clearly different from a scored tile and that letters stay readable on it.
- **Dynamic cast shadow.** Every tile on the board casts a shadow from its square (`.sq.has::before`, sized in container units so it scales with the board). It reacts to state: tight and dark at rest, shifted down and softer while the tile is pending (it "hovers"), and it converges from far and faint when a tile lands (`.fall`). Only `transform` and `opacity` are animated, so nothing is repainted; reduced-motion users get none of the animation.
- **Game length** is a single row of five choices (number over "دقيقة"); the length in use is outlined.
- **End of game** shows a centred announcement: the reason, the winner (or a draw), and one score card per player with the tile deduction and time bonus. The winner's card is outlined; a compact variant is used on short landscape screens so nothing scrolls.

## History toggle

The history panel has a small button in its corner: **إخفاء السجل** (hide) / **إظهار السجل** (show).

- **Strict layout stability.** The panel keeps its exact size, grid area and border width. Hiding only makes its surface and contents invisible (the `history-hidden` class); the element is never removed or `display:none`, and no grid rule changes. The racks, player panels, buttons and board stay exactly where they are in portrait and landscape.
- **The history keeps recording** while hidden, and shows the latest entries immediately when revealed.
- The button is a native `<button>` (Enter / Space) with `aria-expanded`; it stays visible and clickable while the content is hidden.
- The choice is a device preference stored in `localStorage` under `scrabble.historyVisible` (default: visible; a missing, invalid or unreadable value means visible). It is separate from `scrabble.theme` and `scrabble.dims`.
- Known limit: with the history text set to its maximum (160%) in a very narrow history column in tight landscape layouts, the title can wrap under the button.

## Floating dialogue and Floating Workspace (الإعدادات → التخطيط → الوضع العائم)

**In-game confirmations** (new game, undo, resume prompt after the match has started) are now a light floating panel instead of a blocking centred modal: ~92 % opaque theme surface, restrained blur, kept inside the safe area, placed on the free corner/edge that hides the least of the board, the racks and the controls, draggable by its title (double-click = automatic spot), Esc closes it. The game behind it stays frozen (`lockGame('dlg')` makes the whole `.app` inert and the clock is paused), so the look and the input lock are separate. The end-of-game result and every setup dialog (cover, mode, duration, blank letter, install help, judge) stay conventional modals.

**Floating Workspace** is an optional presentation layer, **OFF by default**. While OFF nothing changes: the Classic/Duel layouts, `dims.js`, history drawer/docked modes and every media query are authoritative and no handle exists. Turning it ON sets `<html data-floating="true">` (rules live only in `css/float.css`, all scoped to that attribute) and lets you move/resize four modules: **board** (`.boardWrap`, always 1:1, real width via `--float-board-size`, never `transform: scale`), **each player panel** (name, clock, score and rack stay together; width is the free dimension so tiles stay square), **controls** (one palette; buttons reflow, never individually floating) and the **word log**. The dialogue's width can also be changed.

- **Move** with the slim strip at the top of a module (word log / dialogue: their title). **Resize** with the corner grip. Dragging tiles, pressing buttons or scrolling the log never moves a module. Keyboard: Arrow keys on a strip move (Shift = bigger steps), `+` / `-` resize, arrow keys on a focused grip resize, double-click resets that one module.
- **Geometry** is saved per orientation (portrait / landscape) in `scrabble.floatWorkspace.v2` (`{v:2, enabled, portrait:{…}, landscape:{…}}`); popup positions keep the old `scrabble.float` format. Only user overrides are stored; everything else is recomputed from the live viewport, so rotation and window resizing re-clamp (safe-area aware) without erasing the arrangement. Nothing is written during a drag, only on release.
- **Precedence**: saved override > default derived from the current layout (player 1 left/right, panel height) and the Dimensions sliders (board scale shrinks the default board, rack scale narrows panels, history scales size the log). **إعادة ضبط العناصر العائمة** deletes the overrides (and popup positions) and returns to those defaults; theme, scores, clocks, history, layout and dimensions are untouched. Turning the mode OFF removes the attribute, handles and all inline geometry at once: no reload, no restart.
- **Stacking**: workspace modules 10–19, word log drawer / settings 30+, toast 45, dialogue 50, native modals above; z-order is ranked inside each band, never an ever-growing counter.
- Code: `js/float.js` (one engine for popups and modules), `js/layout.js` (the setting), `js/ui.js` (`ask()` and input lock), `css/float.css`. Game rules, scoring, clocks and board input code are untouched; the board still maps pointer targets through DOM elements, so moving or resizing it cannot desynchronise cells.
- Tests: `tests/layout/floating.mjs` (default OFF, enable/disable, exact return to the normal layout, move/resize, square board, tile placement after move/resize, persistence, rotation, clamping, keyboard, reset, dialogue lock).

## Layout (الإعدادات → التخطيط)

Device preferences stored in `localStorage` under `scrabble.layout`; they only set `data-layout`, `data-swap` and `data-hist` on `<html>` (`js/layout.js`).

- **التخطيط**: *كلاسيكي* (original) or *مواجهة* (player panels on either side of the board, buttons underneath). Short landscape phones always use the classic arrangement.
- **موضع اللاعب الأول**: left or right (duel only).
- **ارتفاع لوحات اللاعبين**: top / middle / bottom (default) position of the two panels beside the board (duel only). In duel on landscape screens (≥700×560) the board is sized from the real vertical overhead, so everything fits the viewport without scrolling.
- **أزرار التحكم**: icons only (default; labels remain for screen readers and as tooltips, تأكيد/احتساب keeps its text), icon over label, or the original text. Icons are inline SVG using `currentColor`, mirrored where direction matters (RTL). Icon-only mode needs one button row instead of two, which the duel board-size budget accounts for.
- **Floating windows** (`js/float.js`): the settings panel (non-modal, game frozen behind it) and the word-log drawer are draggable windows with identical behaviour: drag the title, or focus it and use the arrow keys (Shift = larger step); double-click the title or use *إعادة مواضع النوافذ العائمة* to reset. Positions are clamped to the viewport and remembered per device. Esc closes either window.
- **سجل الكلمات**: *عند الطلب* (default) keeps the log out of the layout and opens it as a drawer from a small icon button in the bottom corner of the board, on the end side of the bag counter (close with the same button or Esc; the label stays available to screen readers and as a tooltip); *مثبّت* keeps the original always-visible panel with its hide/show toggle.

Note: `tests/layout/history-toggle*.mjs` exercise the docked log, so the test helper `openGame` presets `scrabble.layout` to `{"hist":"docked"}` (override it with the `storage` option); `layout/log-icon.mjs` covers the default drawer.

## PWA: install, offline play, match recovery

The game is an installable Progressive Web App. It is still plain static files: no build step, no backend, no framework.

### Two separate features (do not confuse them)

| Feature | What it stores | Where | Code |
|---|---|---|---|
| **Offline app cache** | the game's own files (HTML, CSS, JS, fonts, icons) | Cache Storage, filled by the service worker | `sw.js`, `js/pwa.js` |
| **Match recovery** | the running match (board, racks, bag, scores, clocks, history, undo) | `localStorage` key `scrabble.match` | `js/persist.js` |

Offline use is only promised after the first successful online visit has finished downloading the files: Settings → التطبيق shows "جاهزة للعمل دون إنترنت" only once the service worker has installed (its install step downloads every file or fails as a whole).

### Files

```
manifest.webmanifest      name, icons, display: standalone, start_url "./", scope "./"
sw.js                     service worker (precache list, versioned cache, fetch strategy)
js/pwa.js                 registration, update bar, install UI, offline status, theme-color sync
js/persist.js             match save / validate / restore, resume prompt, pause-while-hidden
css/pwa.css               install suggestion, update bar, iOS guide, standalone touch hardening
assets/icons/             icon-192, icon-512, maskable-512, apple-touch-icon (180), favicon-32 (PNG)
tools/stamp-sw.mjs        writes the cache version into sw.js (run before every deploy)
tools/make-icons.mjs      dev-only: re-renders the PNG icons from tools/icon-source.html
.nojekyll                 tells GitHub Pages not to run Jekyll over the files
```

`id` is deliberately omitted from the manifest: it then defaults to `start_url`, which is already unique per deployment path. A fixed `id` would be resolved against the origin and could collide with other apps on the same `github.io` host. Add `"id": "/your-repo/"` only if you want to pin the identity to one known URL.

### Caching strategy

All URLs are relative and resolved against the service worker's scope (`self.registration.scope`), so the same files work at a domain root and under `https://user.github.io/repo/`.

- **install**: every file in `PRECACHE` is fetched with `cache: 'reload'` (never from a stale HTTP cache) into one versioned cache `arabic-scrabble-shell-<hash>`. If any file fails, the install fails, the partial cache is deleted and the previous version keeps serving. A half-downloaded version can never go live.
- **activate**: all older `arabic-scrabble-*` caches are deleted and open pages are claimed.
- **fetch**: app files come from the versioned cache only, so versions are never mixed. Navigations to the game (also with a query string) get the cached `index.html`. Other same-origin GET requests are network-first with a runtime-cache fallback; failed or non-basic responses are never stored; an unavailable file answers 503 instead of a fake success. Other origins, non-GET and `Range` requests are not touched.
- **update**: a new worker installs in the background and *waits*. The game shows "يتوفر إصدار أحدث" with **تحديث الآن** / **لاحقًا**; only on agreement does the page tell the worker to take over and reload. A match in progress is saved continuously, so it is offered again after the reload. Updates are checked on load and when the app returns to the foreground (at most every 15 minutes).
- **version**: `VERSION` in `sw.js` is a content hash of every precached file, written by `node tools/stamp-sw.mjs`. Browsers only re-install the worker when `sw.js` changes, so **you must stamp after changing any game file** (`--check` fails when it is stale; `tests/pwa/static.mjs` runs that check).

### Match recovery

- Saved (debounced, ~250 ms after each change, and always when the app is hidden or closed): mode, clock lengths and remaining times, board, racks, bag, scores, whose turn, blank letters, the unsubmitted move, undo snapshot, history (including tahkim verdicts).
- Not saved: settings (they have their own keys and are never touched), an open dialog, an in-progress tile *swap* selection, a finished game, a game with no move yet.
- On start-up, **PLAY** offers *متابعة* / *مباراة جديدة* when a valid save exists. Choosing a new game does not delete the old match until the new game really starts.
- A save is used only if it is completely consistent (every tile exactly once, sane clocks, words made only of Arabic letters, current tile data). Anything else (corrupted, tampered, from an incompatible version) is discarded and the game starts normally. Storage that is unavailable or full simply means no recovery.
- **Clocks pause while the app is in the background** (screen locked, app switched, tab hidden) and resume when it returns, so a phone call does not cost a player their time. This is the one behaviour change; set `PAUSE_CLOCK_WHEN_HIDDEN = false` in `js/persist.js` to restore the old behaviour.
- Two windows playing at once on the same device would overwrite each other's save (last writer wins).

### Deploying to GitHub Pages

1. `node tools/stamp-sw.mjs` (needs Node 18+; only the version stamp, nothing is built) and commit the result.
2. Push to GitHub. In the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`, **Save**.
3. Open `https://<user>.github.io/<repo>/` (HTTPS is provided by GitHub). Wait for the status line in Settings to say the game is ready for offline use, then test with airplane mode.
4. Every later change: edit, `node tools/stamp-sw.mjs`, commit, push. Players get the update bar on their next visit.

If you add or remove a file the game loads, update `PRECACHE` in `sw.js` (the static test lists any shipped file that is missing from it). Vercel, Netlify and any other static host work the same way, at the root or under a path.

### Installing

- **Android (Chrome, Edge, Samsung Internet)**: open the site; use the **تثبيت** button on the start screen or **الإعدادات → التطبيق → تثبيت التطبيق**, or the browser menu **⋮ → Install app / Add to Home screen**. The in-game buttons only appear when the browser has offered installation.
- **Desktop Chrome / Edge**: same buttons, or the install icon in the address bar.
- **iPhone and iPad (Safari)**: iOS has no install prompt. Tap **Share** (square with an up arrow; bottom bar on iPhone, top of the screen on iPad, sometimes inside **⋯**) → **Add to Home Screen** (under **View More** on some versions) → leave **Open as Web App** on if it is shown → **Add**. The app opens full screen from the new icon. The start screen shows a **طريقة التثبيت** button with these steps only on iOS/iPadOS in a browser tab; it is detected through `navigator.standalone`, not the user agent. The installed iOS app keeps its own storage, separate from Safari.
- The suggestion on the start screen can be dismissed (it stays away for 30 days); the entry in Settings remains. Nothing claims the app is installed unless it is actually running as an installed app.

### Known limitations

- Install flows on real Android and iOS devices, real GitHub Pages HTTPS, and Safari service-worker behaviour were not tested by the author of this change; see the test notes below for what was.
- iOS may evict a website's storage after a period of non-use; an app added to the Home Screen is not subject to that, a Safari tab can be.
- Offline caching covers the app itself; there is nothing online to sync, so no background sync or push is used.

## Technology

HTML, CSS, vanilla JavaScript (ES Modules). No framework, no build step, no dependencies, no audio subsystem. Fonts (Amiri for Arabic, Tinos for Latin and digits) are bundled locally.

## Running

ES modules need to be served over HTTP (opening `index.html` from `file://` is blocked by browsers). From the project folder:

```sh
python3 -m http.server 8000
```

then open <http://localhost:8000>. Any static host (GitHub Pages, Netlify, …) works as-is.

## Folder structure

```
index.html
README.md

css/
  style.css       layout and components (colours come from theme tokens)
  cover.css       cover screen
  pwa.css         install suggestion, update bar, iOS guide
  themes.css      theme palettes (CSS custom properties)

js/
  config.js       global constants: board size, durations, premium layout, glyph/label maps, dimension limits
  modes.js        Expanded and Basic tile data, blank alphabets, mode metadata
  themes.js       theme metadata, load/save/apply, theme selector
  histview.js     history show/hide toggle and its saved preference
  state.js        game state, tile bag, snapshots (undo / tahkim)
  game.js         turns, placement, submit, undo, swap, pass, game over
  scoring.js      word finding and scoring
  judge.js        tahkim
  ui.js           rendering and dialogs (including mode and duration selection, blank picker)
  input.js        click/tap, keyboard, drag and drop, buttons, dialog flow
  dims.js         interface dimension settings
  cover.js        cover screen (title in game tiles)
  main.js         start-up
  persist.js      match save / restore / resume prompt, pause-while-hidden
  pwa.js          service-worker registration, update bar, install UI

tests/            dev-only tests (not needed to play; see "Tests")
  package.json
  run-all.mjs     runs every suite below
  contrast.py     WCAG contrast and distinctness audit of css/themes.css
  logic/
    harness.mjs   loads the real modules in jsdom
    engine.mjs    modes, scoring, blanks, undo, tahkim, pass, themes, dimensions
    startup.mjs   real main.js start-up, cover, setup flow, Settings
  layout/
    lib.mjs       real-browser helpers (viewports, geometry, pixel checks)
    serve.mjs     tiny static server used by the tests
    baseline.mjs  regenerates baseline.json
    baseline.json reference layout of the docked history panel (see "Tests")
    history-toggle.mjs        bounding boxes before/after hide and show in 8 viewports
    history-toggle-extra.mjs  keyboard, persistence, extreme dimensions, all themes
    log-icon.mjs              default drawer: the word-log icon's size, corner, no overlap, open/close (2 layouts x 8 viewports)

manifest.webmanifest  PWA manifest
sw.js            service worker
tools/           stamp-sw.mjs (cache version), make-icons.mjs + icon-source.html (icon generator)

assets/
  icons/          PNG app icons
  fonts/
    Amiri-Regular.woff2
    Amiri-Bold.woff2
    Tinos-Regular.woff2
    Tinos-Bold.woff2
```

## Tests

Dev-only; the game itself has no dependencies. From the `tests/` folder:

```sh
npm install
npm test          # all suites; or: node run-all.mjs "extra.mjs b" to run one
```

- `logic/*` run the real modules against jsdom (including the tile state classes behind the cast shadow, the duration picker and the end-of-game result).
- `layout/*` drive a real Chromium (the Linux build bundled with `@sparticuz/chromium`; set `CHROME_PATH` to use your own Chrome) and compare the bounding boxes of the racks, buttons, panels, board and history before and after toggling, in portrait and landscape phone, tablet and desktop viewports. Hidden state is also checked pixel-wise, with a positive control showing that visible history would be detected.
- `pwa/static.mjs` (no browser): every theme defines every token, placed tiles have no glow, the landing shadow animates only transform/opacity; manifest and icons (real PNGs, sizes, alpha), relative-path rule, precache coverage of every shipped file and ES import, version stamp.
- `pwa/e2e.mjs` (Chromium via `playwright-core`; set `CHROME_PATH` for your own Chrome): service worker under a sub-path and at the root, Chrome's manifest/installability check, offline launch with the server actually stopped, match recovery (including an unsubmitted move, blanks, tampered saves), failed and successful updates, install UI (Android prompt, dismissal, iOS guide). It does **not** run on real devices or real HTTPS hosting.
- `layout/baseline.json` is the reference layout the docked history panel must match while visible (originally measured before the toggle existed; re-taken after the control buttons became icon-only). If you change the docked layout on purpose, regenerate it from a trusted checkout (see the comment in `baseline.mjs`).
- Known environment sensitivity: the pixel-residue check in `layout/history-toggle.mjs` can report a 1px full-width raster seam at the 360x640 viewport on some Chromium builds (it did on the build used while developing this change, with or without these edits). If it is the only failure, it is a screenshot artefact, not a layout regression.

## Credits

By esbepe. Evolved from [DAXEI08/update-version](https://github.com/DAXEI08/update-version).
