// volcanoes/supervolcano.js
import { CELL } from '../constants.js';
import { setCellRGB, setSandRGB } from '../grid.js';
import { pickVolcanoTheme, rockPickerByDepth } from '../materials.js';
import { mixRGB } from '../utils.js';

// используем такую же writeRockOrCrystal, что и в кольцевом
import { spawnVolcano as _dummy, stepVolcano as _dummy2 } from './volcano_ring.js'; // чтобы переиспользовать функцию
const writeRockOrCrystal = (state,x,y,theme,opts)=> {
  // прокинем через кольцевой модуль (чтобы не дублировать)
  return _dummy2 && (()=>{}), // no-op, просто чтобы импорт не удалился бандлером
  (function(){
    const { overwriteChance=0.12, crystalChance=0.025, depthBias=0.5, blendChance=0.35 } = opts||{};
    // локальная копия логики (минимальная)
    if (x<0||x>=state.W||y<0||y>=state.H) return false;
    if (state.rockBudget<=0) return false;
    const i = y*state.W + x;
    const typeAt = state.grid[i];
    const allowOverwrite = (typeAt===CELL.SAND) ? true : (Math.random() < overwriteChance);
    if (typeAt!==CELL.EMPTY && !allowOverwrite) return false;
    const baseRock = (Math.random()<depthBias ? rockPickerByDepth(y, state.H)() : state._themeRock?.() ?? theme.rockPick());
    const useCrystal = (Math.random() < crystalChance);
    if (useCrystal) setCellRGB(state, x,y, CELL.CRYSTAL, theme.crystalPick());
    else            setCellRGB(state, x,y, CELL.ROCK, baseRock);
    state.rockBudget--;
    return true;
  })();
};

function pickPeripheralVents(S, count){
  const arr = S.ds
    .map(d=>({ d, R: Math.hypot(d.cx - S.cx, d.cy - S.cy)}))
    .sort((a,b)=>b.R-a.R)
    .slice(0, Math.max(count*3, count));
  const out=[];
  while (out.length<count && arr.length){
    const i=(Math.random()*arr.length)|0;
    out.push(arr.splice(i,1)[0].d);
  }
  return out;
}
function spraySand(state, x,y, pickSand, shots, dirBias=[0,-1]){
  for (let i=0;i<shots && state.rockBudget>0;i++){
    const ang = Math.atan2(dirBias[1], dirBias[0]) + (Math.random()*0.9-0.45);
    const len = 3 + ((Math.random()*10)|0);
    for (let t=0; t<len; t++){
      const ox = Math.round(Math.cos(ang)*t + (Math.random()*1.5-0.75));
      const oy = Math.round(Math.sin(ang)*t + (Math.random()*1.5-0.75));
      setSandRGB(state, x+ox, y+oy, pickSand());
    }
  }
}

export function spawnSuperVolcano(state, cx, cy){
  const theme = pickVolcanoTheme();
  return { type:'supervolcano', cx, cy, t:0, ttl:760, theme, ds:[], rings:0, fault:{r:8, rmax: Math.min(150, Math.max(60, Math.min(state.W,state.H)*0.65|0))}, sandCooldown:0 };
}
export function stepSuperVolcano(state, S){
  const { theme } = S;
  const prevR=S.fault.r|0; S.fault.r += 1; const curR=S.fault.r|0;

  if(curR>prevR && curR<=S.fault.rmax){
    const n = 8 + ((Math.random()*16)|0);
    for(let k=0;k<n;k++){
      const a = Math.random()*Math.PI*2;
      const jitter = (Math.random()*6-3);
      const cx = Math.round(S.cx + (curR+jitter)*Math.cos(a));
      const cy = Math.round(S.cy + (curR+jitter)*Math.sin(a));
      if (!S.ds.some(d=>Math.hypot(d.cx-cx, d.cy-cy)<20)){
        const rmax = 4 + ((Math.random()*6)|0);
        S.ds.push({cx,cy,r:0,rmax,drawn:0, vent:true});
      }
    }
    if ((++S.rings % 3)===0){
      for (let th=0; th<Math.PI*2; th+=Math.PI/32){
        const rx = Math.round(S.cx + curR*Math.cos(th));
        const ry = Math.round(S.cy + curR*Math.sin(th));
        for (let off=-1; off<=1; off++){
          writeRockOrCrystal(state, rx+off, ry, theme, {overwriteChance:0.12, crystalChance:0.02, depthBias:0.45, blendChance:0.35});
          writeRockOrCrystal(state, rx, ry+off, theme, {overwriteChance:0.12, crystalChance:0.02, depthBias:0.45, blendChance:0.35});
        }
      }
    }
  }

  let allDone = (curR> S.fault.rmax) && S.ds.length>0;
  for(const d of S.ds){
    if(d.drawn < d.rmax){
      if((S.t & 1)===0) d.r = Math.min(d.rmax, d.r+1);
      if(d.drawn < d.r){
        const size = d.drawn+2;
        for(let dx=-size; dx<=size; dx++){
          const dy = size - Math.abs(dx);
          if(Math.random()<0.06) continue;
          writeRockOrCrystal(state, d.cx+dx, d.cy+dy, theme, {overwriteChance:0.12, crystalChance:0.025, depthBias:0.5, blendChance:0.35});
          writeRockOrCrystal(state, d.cx+dx, d.cy-dy, theme, {overwriteChance:0.12, crystalChance:0.025, depthBias:0.5, blendChance:0.35});
        }
        d.drawn = size;
      }
    }
    if(d.drawn < d.rmax) allDone = false;
  }

  S.sandCooldown--;
  const stillBuilding = (curR<=S.fault.rmax);
  if (S.sandCooldown<=0 && theme.sandPickers.length>0 && stillBuilding){
    S.sandCooldown = 10 + ((Math.random()*14)|0);
    const vents = pickPeripheralVents(S, 2 + ((Math.random()*3)|0));
    for (const v of vents){
      const pickSand = theme.sandPickers[(Math.random()*theme.sandPickers.length)|0];
      spraySand(state, v.cx, v.cy, pickSand, 12 + ((Math.random()*14)|0), [0,-1]);
      const tang = Math.atan2(v.cy - S.cy, v.cx - S.cx) + Math.PI/2;
      spraySand(state, v.cx, v.cy, pickSand, 8 + ((Math.random()*10)|0), [Math.cos(tang), Math.sin(tang)]);
    }
  }
  if(allDone){ S.ttl = 0; }
}
