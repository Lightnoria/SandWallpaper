import { CELL, COLOR_SCALE, CRYSTAL_COLOR_SCALE } from './constants.js';
import { idx, scaleRGB } from './utils.js';
import { pickSand, pickRock } from './palettes.js';
import { CRYSTAL_TYPES } from './materials.js';

export function createGrid(W,H){
  return {
    grid: new Uint8Array(W*H),
    next: new Uint8Array(W*H),
    r: new Uint8ClampedArray(W*H),
    g: new Uint8ClampedArray(W*H),
    b: new Uint8ClampedArray(W*H),
  };
}

export function setCell(state, x,y, t){
  const { W,H } = state;
  if (x<0||x>=W||y<0||y>=H) return;
  const i = idx(x,y,W);
  state.grid[i]=t;

  if (t===CELL.EMPTY){ state.r[i]=state.g[i]=state.b[i]=0; return; }

  let col;
  if (t===CELL.SAND)         col = pickSand();
  else if (t===CELL.ROCK)    col = pickRock();
  else if (t===CELL.CRYSTAL) col = CRYSTAL_TYPES.cyan();   // как было по умолчанию
  else if (t===CELL.BOT)     col = [250,245,120];          // БОТ: тёпло-жёлтый

  const scale = (t===CELL.CRYSTAL) ? CRYSTAL_COLOR_SCALE : COLOR_SCALE;
  const [R,G,B] = scaleRGB(col, scale);
  state.r[i]=R; state.g[i]=G; state.b[i]=B;
}

export function setCellRGB(state, x,y, t, rgb){
  const { W,H } = state;
  if (x<0||x>=W||y<0||y>=H) return;
  const i = idx(x,y,W);
  // чтобы внешние системы случайно не перерисовали бота цветом:
  if (state.grid[i]===CELL.BOT && t!==CELL.EMPTY && t!==CELL.BOT) {
    // разрешаем лишь очистить бота (EMPTY) или переместить бота (BOT)
    return;
  }
  state.grid[i]=t;
  const scale = (t===CELL.CRYSTAL) ? CRYSTAL_COLOR_SCALE : COLOR_SCALE;
  const [R,G,B] = scaleRGB(rgb, scale);
  state.r[i]=R; state.g[i]=G; state.b[i]=B;
}

export const setSandRGB = (state,x,y,rgb)=> setCellRGB(state,x,y,CELL.SAND,rgb);

export function getCell(state, x,y){
  const { W,H } = state;
  if (x<0||x>=W||y<0||y>=H) return CELL.ROCK;
  return state.grid[idx(x,y,W)];
}
