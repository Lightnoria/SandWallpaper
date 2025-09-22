import { CELL } from './constants.js';
import { setCellRGB, setSandRGB } from './grid.js';
import { pickVolcanoTheme, rockPickerByDepth } from './materials.js';
import { mixRGB } from './utils.js';

function writeRockOrCrystal(state, x,y, theme, opts){
  const { overwriteChance=0.45, crystalChance=0.03, depthBias=0.35, blendChance=0.25 } = opts||{};
  if (x<0||x>=state.W||y<0||y>=state.H) return false;
  if (state.rockBudget<=0) return false;

  const i = y*state.W + x;
  const typeAt = state.grid[i];

  // песок — всегда замещаем
  const allowOverwrite = (typeAt===CELL.SAND) ? true : (Math.random() < overwriteChance);
  if (typeAt!==CELL.EMPTY && !allowOverwrite) return false;

  const baseRock = (Math.random()<depthBias ? rockPickerByDepth(y, state.H)() : theme.rockPick());
  let rgbRock = baseRock;

  if (Math.random()<blendChance){
    const neigh = [];
    if (y>0)         { const j=i-state.W; if (state.grid[j]===CELL.ROCK) neigh.push([state.r[j],state.g[j],state.b[j]]); }
    if (y<state.H-1) { const j=i+state.W; if (state.grid[j]===CELL.ROCK) neigh.push([state.r[j],state.g[j],state.b[j]]); }
    if (x>0)         { const j=i-1;        if (state.grid[j]===CELL.ROCK) neigh.push([state.r[j],state.g[j],state.b[j]]); }
    if (x<state.W-1) { const j=i+1;        if (state.grid[j]===CELL.ROCK) neigh.push([state.r[j],state.g[j],state.b[j]]); }
    if (neigh.length){
      const ncol = neigh[(Math.random()*neigh.length)|0];
      rgbRock = mixRGB(baseRock, ncol, 0.5);
    }
  }

  const useCrystal = (Math.random() < crystalChance);
  if (useCrystal) setCellRGB(state, x,y, CELL.CRYSTAL, theme.crystalPick());
  else            setCellRGB(state, x,y, CELL.ROCK, rgbRock);
  state.rockBudget--;
  return true;
}

// выбор «вентов»: предпочитаем более дальние от центра (периферийные)
function pickPeripheralVents(S, count){
  const arr = S.ds
    .map(d=>({ d, R: Math.hypot(d.cx - S.cx, d.cy - S.cy)}))
    .sort((a,b)=>b.R-a.R)
    .slice(0, Math.max(count*3, count));     // возьмём верхушку
  const out=[];
  while (out.length<count && arr.length){
    const i=(Math.random()*arr.length)|0;
    out.push(arr.splice(i,1)[0].d);
  }
  return out;
}
// «струя» песка вдоль направления (меняется от кадра к кадру)
function spraySand(state, x,y, pickSand, shots, dirBias=[0,-1]){
  for (let i=0;i<shots && state.rockBudget>0;i++){
    const ang = Math.atan2(dirBias[1], dirBias[0]) + (Math.random()*0.9-0.45); // веер
    const len = 3 + ((Math.random()*10)|0);
    for (let t=0; t<len; t++){
      const ox = Math.round(Math.cos(ang)*t + (Math.random()*1.5-0.75));
      const oy = Math.round(Math.sin(ang)*t + (Math.random()*1.5-0.75));
      setSandRGB(state, x+ox, y+oy, pickSand());
    }
  }
}

/* обычный «кольцевой» вулкан */
export function spawnVolcano(state, cx, cy){
  const theme = pickVolcanoTheme();
  return { type:'volcano', cx, cy, t:0, ttl:560, theme, ds:[], fault:{r:6, rmax: Math.min(90, Math.max(26, Math.min(state.W,state.H)/2|0))}, sandCooldown:0 };
}
export function stepVolcano(state, S){
  const { theme } = S;
  const prevR=S.fault.r|0; S.fault.r += 1; const curR=S.fault.r|0;

  if(curR>prevR && curR<=S.fault.rmax){
    const n = 4 + ((Math.random()*10)|0);
    for(let k=0;k<n;k++){
      const a = Math.random()*Math.PI*2;
      const jitter = (Math.random()*4-2);
      const cx = Math.round(S.cx + (curR+jitter)*Math.cos(a));
      const cy = Math.round(S.cy + (curR+jitter)*Math.sin(a));
      if (!S.ds.some(d=>Math.hypot(d.cx-cx, d.cy-cy)<18)){
        const rmax = 3 + ((Math.random()*4)|0);
        S.ds.push({cx,cy,r:0,rmax,drawn:0, vent:true});
      }
    }
  }

  let allDone = (curR> S.fault.rmax) && S.ds.length>0;
  for(const d of S.ds){
    if(d.drawn < d.rmax){
      if((S.t & 1)===0) d.r = Math.min(d.rmax, d.r+1);
      if(d.drawn < d.r){
        const size = d.drawn+1;
        for(let dx=-size; dx<=size; dx++){
          const dy = size - Math.abs(dx);
          if(Math.random()<0.08) continue;
          writeRockOrCrystal(state, d.cx+dx, d.cy+dy, theme, {overwriteChance:0.45, crystalChance:0.03, depthBias:0.35, blendChance:0.25});
          writeRockOrCrystal(state, d.cx+dx, d.cy-dy, theme, {overwriteChance:0.45, crystalChance:0.03, depthBias:0.35, blendChance:0.25});
        }
        d.drawn = size;
      }
    }
    if(d.drawn < d.rmax) allDone = false;
  }

  // периферийные «струи» песка (без прямоугольников)
  S.sandCooldown--;
  const stillBuilding = (curR<=S.fault.rmax);
  if (S.sandCooldown<=0 && theme.sandPickers.length>0 && stillBuilding){
    S.sandCooldown = 12 + ((Math.random()*18)|0);
    const vents = pickPeripheralVents(S, 1 + ((Math.random()*2)|0));
    for (const v of vents){
      const pickSand = theme.sandPickers[(Math.random()*theme.sandPickers.length)|0];
      // вверх и по касательной
      spraySand(state, v.cx, v.cy, pickSand, 6 + ((Math.random()*10)|0), [0,-1]);
      const tang = Math.atan2(v.cy - S.cy, v.cx - S.cx) + Math.PI/2;
      spraySand(state, v.cx, v.cy, pickSand, 4 + ((Math.random()*6)|0), [Math.cos(tang), Math.sin(tang)]);
    }
  }
  if(allDone){ S.ttl = 0; }
}

/* супервулкан — толще гребни и мощнее струи */
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

/* амёба — больше и не плюётся песком после завершения роста */
export function spawnVolcanoAmoeba(state, cx, cy){
  const theme = pickVolcanoTheme();
  const frontier = new Set([`${cx},${cy}`]);
  return { type:'volcano_amoeba', cx, cy, t:0, ttl:900, theme, frontier, area:new Set(), sandCooldown:8, sizeCap: 4200 + ((Math.random()*2200)|0), grewThisTick:false };
}
export function stepVolcanoAmoeba(state, S){
  const { theme } = S;
  S.grewThisTick=false;
  let steps = 80; // существенный рост
  while (steps-- > 0 && S.frontier.size>0 && S.area.size < S.sizeCap && state.rockBudget>0){
    const pick = [...S.frontier][(Math.random()*S.frontier.size)|0];
    S.frontier.delete(pick);
    const [sx,sy] = pick.split(',').map(n=>parseInt(n,10));
    if (sx<0||sx>=state.W||sy<0||sy>=state.H) continue;

    if (writeRockOrCrystal(state, sx,sy, theme, {overwriteChance:0.35, crystalChance:0.02, depthBias:0.45, blendChance:0.3})){
      S.area.add(pick);
      S.grewThisTick=true;
      for (const [dx,dy,p] of [[1,0,0.9],[-1,0,0.9],[0,1,0.85],[0,-1,0.85],[1,1,0.5],[-1,1,0.5],[1,-1,0.5],[-1,-1,0.5]]){
        if (Math.random()<p) S.frontier.add(`${sx+dx},${sy+dy}`);
      }
    }
  }

  // плюём песком только пока реально растём
  S.sandCooldown--;
  if (S.sandCooldown<=0 && theme.sandPickers.length>0 && S.grewThisTick){
    S.sandCooldown = 22 + ((Math.random()*24)|0);
    const pickSand = theme.sandPickers[(Math.random()*theme.sandPickers.length)|0];
    const fr = [...S.frontier];
    for (let k=0;k<8 && fr.length>0; k++){
      const idx = (Math.random()*fr.length)|0;
      const [fx,fy] = fr.splice(idx,1)[0].split(',').map(n=>parseInt(n,10));
      const shots = 6 + ((Math.random()*8)|0);
      for (let i=0;i<shots && state.rockBudget>0;i++){
        const ang = Math.random()*Math.PI*2;
        const len = 2 + ((Math.random()*5)|0);
        for (let t=0;t<len;t++){
          const ox = Math.round(Math.cos(ang)*t);
          const oy = Math.round(Math.sin(ang)*t);
          setSandRGB(state, fx+ox, fy+oy, pickSand());
        }
      }
    }
  }
}
