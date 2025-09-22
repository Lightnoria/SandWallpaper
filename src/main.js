import { createGrid, setCell } from './grid.js';
import { initInput } from './input.js';
import { initSources } from './sources.js';
import { initSpawnMask, step } from './sim.js';
import { initBackground, render } from './render.js';
import { CELL, PERFORMANCE_PROFILES, ROCK_DRAWS_BUDGET, SPAWN_PROB_BASE } from './constants.js';
import { attachDebugPanel } from './debug.js';

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d',{alpha:false});
const W=canvas.width, H=canvas.height;

const state = {
  canvas, ctx, W, H,
  ...createGrid(W,H),

  // фиксируем «ACTIVE» для тестов
  profile: PERFORMANCE_PROFILES.ACTIVE,
  targetFPS: 60,
  simScale:  1.00,
  spawnProb: SPAWN_PROB_BASE,
  rockBudgetBase: ROCK_DRAWS_BUDGET,
};

initInput(state);
initSources(state);
initSpawnMask(state);
initBackground(state);
attachDebugPanel(state);

// стартовый слой песка
for (let x=0; x<W; x++)
  for (let y=0; y<((Math.random()*10)|0); y++)
    setCell(state, x,y, CELL.SAND);

let lastFrame = 0;
function loop(now){
  const minDelta = 1000 / state.targetFPS;
  if (now - lastFrame >= minDelta){
    lastFrame = now;
    step(state);
    render(state);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
