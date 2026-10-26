// Application entry point.
import { TICK_MS } from './config.js';
import { S } from './state.js';
import { buildDom, onAfterRender } from './ui.js';
import { tick, newGame } from './game.js';
import { initInput } from './input.js';
import { initThemes } from './themes.js';
import { initHistoryToggle } from './histview.js';
import { showCover } from './cover.js';
import { initDims } from './dims.js';
import { initLayout } from './layout.js';
import { initWorkspace } from './float.js';
import { loadSaved, initPersistence, startFlow, schedule } from './persist.js';
import { initPwa } from './pwa.js';

function start() {
  const saved = loadSaved();   // an unfinished match from a previous visit, validated; read before anything can overwrite it
  initThemes();
  initDims();
  initHistoryToggle();
  initLayout();
  buildDom();
  initWorkspace();   // needs the player panels that buildDom just created; a saved "Floating Workspace: ON" is restored here
  initInput();
  setInterval(tick, TICK_MS);
  newGame();
  S.paused = true;       // clock stays frozen until the setup flow finishes
  initPersistence(saved);   // before the render hook, so the start-up game can never replace a saved match
  onAfterRender(schedule);
  showCover(() => startFlow(saved));   // cover first; "Play" offers to resume a saved match, else opens mode selection, then duration
  initPwa();
}

start();
