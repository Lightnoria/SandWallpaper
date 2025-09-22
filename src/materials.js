import { clamp8 } from './utils.js';

function jitter([r,g,b], a){
  return [
    clamp8(r + ((Math.random()*2-1)*a)|0),
    clamp8(g + ((Math.random()*2-1)*a)|0),
    clamp8(b + ((Math.random()*2-1)*a)|0),
  ];
}
const mkPicker = (palette, a=4) => () => jitter(palette[(Math.random()*palette.length)|0], a);

// ===== CRYSTALS 
const CRYSTAL_PALETTES = {
  green:   [[110,230,150],[100,220,140],[120,240,160]],
  blue:    [[ 80,150,245],[ 70,140,235],[ 90,165,255]],
  red:     [[255,110,110],[235, 95, 95],[255,135,135]],
  violet:  [[235,135,255],[220,120,245],[245,150,255]],
  white:   [[240,245,250],[230,235,240],[250,250,255]],
  cyan:    [[130,220,245],[120,210,235],[140,230,250]],
};

export const CRYSTAL_TYPES = Object.fromEntries(
  Object.keys(CRYSTAL_PALETTES).map(k => [k, mkPicker(CRYSTAL_PALETTES[k], 4)])
);
export const CRYSTAL_ORDER = ['green','blue','red','violet','white','cyan'];

// ===== ROCKS =====
const ROCK_PALETTES = {
  violet:  [[120,100,140],[110, 92,130],[128,108,150]],
  yellow:  [[175,150, 95],[168,142, 90],[182,156,102]],
  grass:   [[ 70, 85, 70],[ 64, 78, 64],[ 76, 92, 76]],
  gstone:  [[ 25, 25, 28],[ 20, 20, 22],[ 18, 18, 20]],
};
export const ROCK_TYPES = Object.fromEntries(
  Object.keys(ROCK_PALETTES).map(k => [k, mkPicker(ROCK_PALETTES[k], 3)])
);
export const ROCK_ORDER = ['violet','yellow','grass','gstone'];

// ===== SANDS (красный — рыжеватый) =====
const SAND_PALETTES = {
  red:   [[225,105, 60],[215, 95, 52],[235,115, 68]],
  blue:  [[ 90,120,200],[ 84,112,188],[ 96,126,208]],
  white: [[210,210,210],[200,200,200],[220,220,220]],
  gray:  [[120,120,120],[112,112,112],[128,128,128]],
};
export const SAND_TYPES = Object.fromEntries(
  Object.keys(SAND_PALETTES).map(k => [k, mkPicker(SAND_PALETTES[k], 5)])
);

// ===== Темы вулканов (один кристалл на вулкан) =====
export function pickVolcanoTheme(){
  const rockRoll = Math.random();
  let rockKey = 'yellow';
  if (rockRoll < 0.05) rockKey = 'gstone';
  else if (rockRoll < 0.40) rockKey = 'violet';
  else if (rockRoll < 0.70) rockKey = 'grass';

  const crystalKeys = Object.keys(CRYSTAL_TYPES);
  const crystalKey = crystalKeys[(Math.random()*crystalKeys.length)|0];

  const sandKeys = Object.keys(SAND_TYPES);
  const pool = sandKeys.slice().sort(()=>Math.random()-0.5);
  const count = (Math.random()<0.45)?2:1;
  const chosenSandKeys = pool.slice(0, count);

  return {
    rockKey,
    crystalKey,
    sands: chosenSandKeys,
    rockPick: ROCK_TYPES[rockKey],
    crystalPick: CRYSTAL_TYPES[crystalKey],
    sandPickers: chosenSandKeys.map(k => SAND_TYPES[k]),
    label: `rock:${rockKey} / crystal:${crystalKey} / sands:[${chosenSandKeys.join(', ')}]`
  };
}

// ===== Глубина (оставляем породы и кристаллы) =====
function clamp01(x){ return x<0?0:x>1?1:x; }
function depthIndex(y,H,n){
  const t = clamp01(y/(H-1));
  const noise = (Math.random()*0.6-0.3);
  const v = clamp01(t + noise*0.15);
  return Math.round(v*(n-1));
}
export function rockPickerByDepth(y,H){
  const key = ROCK_ORDER[ depthIndex(y,H,ROCK_ORDER.length) ];
  return ROCK_TYPES[key];
}
export function crystalPickerByDepth(y,H){
  const key = CRYSTAL_ORDER[ depthIndex(y,H,CRYSTAL_ORDER.length) ];
  return CRYSTAL_TYPES[key];
}
