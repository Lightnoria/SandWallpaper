import { CELL } from './constants.js';
import { idx } from './utils.js';
import { setCell, getCell } from './grid.js';
import { stepSources } from './sources.js';
import { initAgents, stepAgents } from './agents.js';

export function initSpawnMask(state){
  state.spawnMask = new Float32Array(state.W);
  for (let x=0; x<state.W; x++){
    let v = 0.6*Math.sin(x*0.09) + 0.3*Math.sin(x*0.031+1.3) + 0.1*Math.sin(x*0.013-0.7);
    v = 0.15 + 0.85*(0.5+0.5*v);
    state.spawnMask[x] = Math.max(0, Math.min(1, v)) * (0.9 + Math.random()*0.1);
  }
}

function move(state, i,x0,y0,x1,y1){
  const j = idx(x1,y1,state.W);
  state.next[i]=CELL.EMPTY;
  state.next[j]=CELL.SAND;
  state.r[j]=state.r[i]; state.g[j]=state.g[i]; state.b[j]=state.b[i];
  state.r[i]=state.g[i]=state.b[i]=0;
}

export function step(state){
  const { W,H } = state;
  state.next.set(state.grid);

  // верхний «дождь» песка (замедляется пропорционально профилю)
  for (let x=0; x<W; x++){
    if (state.grid[x]===CELL.EMPTY){
      const chance = 0.06 * state.spawnMask[x] * (state.simScale ?? 1.0);
      if (Math.random() < chance) setCell(state, x,0, CELL.SAND);
    }
  }

  // падение
  for (let y=H-2; y>=0; y--){
    for (let x=0; x<W; x++){
      const i = idx(x,y,W);
      if (state.grid[i]!==CELL.SAND) continue;

      if (getCell(state,x,y+1)===CELL.EMPTY){ move(state,i,x,y,x,y+1); continue; }
      const dir = Math.random()<0.5?-1:1;
      if (getCell(state,x+dir,y+1)===CELL.EMPTY && getCell(state,x+dir,y)===CELL.EMPTY){ move(state,i,x,y,x+dir,y+1); continue; }
      if (getCell(state,x-dir,y+1)===CELL.EMPTY && getCell(state,x-dir,y)===CELL.EMPTY){ move(state,i,x,y,x-dir,y+1); continue; }
    }
  }

  // swap
  const tmp = state.grid; state.grid = state.next; state.next = tmp;

  // источники и «ластик»
  stepSources(state);
  if (state.eraseHeld) state.applyBrush();
  
  stepAgents(state);
}
