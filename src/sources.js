// sources.js
import { CELL, WATCHDOG_FRAMES, SOURCE_TYPES } from './constants.js';
import { pickWeighted } from './utils.js';
import { setCellRGB } from './grid.js';
import { crystalPickerByDepth, rockPickerByDepth } from './materials.js';
import {
  spawnVolcano, stepVolcano,
  spawnSuperVolcano, stepSuperVolcano,
  spawnVolcanoAmoeba, stepVolcanoAmoeba,
  spawnMazeVolcano, stepMazeVolcano
} from './volcanoes/index.js';

export function initSources(state){
  state.sources = [];
  state.noSourceFrames = 0;
  state.rockBudgetBase = state.rockBudgetBase ?? 1500;
  state.rockBudget = state.rockBudgetBase;
}

export function spawnSourceType(state, type, cx=state.W>>1, cy=state.H>>1){
  if (type==='volcano')             state.sources.push(spawnVolcano(state, cx, cy));
  else if (type==='supervolcano')   state.sources.push(spawnSuperVolcano(state, cx, cy));
  else if (type==='volcano_amoeba') state.sources.push(spawnVolcanoAmoeba(state, cx, cy));
  else if (type==='maze')           state.sources.push(spawnMazeVolcano(state, cx, cy));
  else state.sources.push({type, cx, cy, t:0, ttl:520});
}

export function stepSources(state){
  const Sarr = state.sources;

  if (Sarr.length===0){
    state.noSourceFrames++;
    if (state.noSourceFrames>WATCHDOG_FRAMES){
      spawnSourceType(state, pickWeighted(SOURCE_TYPES), (Math.random()*state.W)|0, (Math.random()*state.H*0.6)|0);
      state.noSourceFrames=0;
    }
  }
  if (Math.random() < (state.spawnProb ?? 0.0001)){
    spawnSourceType(state, pickWeighted(SOURCE_TYPES), (Math.random()*state.W)|0, (Math.random()*state.H*0.6)|0);
  }

  const isVolc = t => t==='volcano' || t==='supervolcano' || t==='volcano_amoeba' || t==='maze';
  const volcanic = Sarr.filter(s => isVolc(s.type));
  const patterns = Sarr.filter(s => !isVolc(s.type));

  const shuffle = arr => { for (let i=arr.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [arr[i],arr[j]]=[arr[j],arr[i]]; } };
  shuffle(volcanic); shuffle(patterns);

  const total = Math.max(1, Math.floor(state.rockBudgetBase));
  let budgetVol = Math.max(1, Math.floor(total*0.7));
  let budgetPat = Math.max(0, total - budgetVol);

  // PASS 1: вулканы
  state.rockBudget = budgetVol;
  for (let s=volcanic.length-1; s>=0 && state.rockBudget>0; s--){
    const S = volcanic[s]; S.t++;
    if (S.type==='volcano') stepVolcano(state, S);
    else if (S.type==='supervolcano') stepSuperVolcano(state, S);
    else if (S.type==='volcano_amoeba') stepVolcanoAmoeba(state, S);
    else if (S.type==='maze') stepMazeVolcano(state, S);

    if (--S.ttl<=0){ const idx = Sarr.indexOf(S); if (idx>=0) Sarr.splice(idx,1); }
  }

  // PASS 2: паттерны (без изменений)
  state.rockBudget = budgetPat;
  for (let s=patterns.length-1; s>=0 && state.rockBudget>0; s--){
    const S = patterns[s]; S.t++;

    if (S.type==='spiral'){
      const steps=8;
      for(let k=0;k<steps && state.rockBudget>0;k++){
        const th=(S.t*0.06 + k*0.25);
        const rad=1.2 + S.t*0.22 + k*0.25;
        for(let w=-1; w<=1 && state.rockBudget>0; w++){
          const x1=(S.cx+rad*Math.cos(th)+w)|0, y1=(S.cy+rad*Math.sin(th))|0;
          const x2=(S.cx+rad*Math.cos(th))|0,   y2=(S.cy+rad*Math.sin(th)+w)|0;
          const isC1 = Math.random()<0.03, isC2 = Math.random()<0.03;
          const c1 = isC1? crystalPickerByDepth(y1, state.H)() : rockPickerByDepth(y1, state.H)();
          const c2 = isC2? crystalPickerByDepth(y2, state.H)() : rockPickerByDepth(y2, state.H)();
          setCellRGB(state, x1,y1, isC1?CELL.CRYSTAL:CELL.ROCK, c1); state.rockBudget--;
          if (state.rockBudget<=0) break;
          setCellRGB(state, x2,y2, isC2?CELL.CRYSTAL:CELL.ROCK, c2); state.rockBudget--;
        }
      }
    }
    else if (S.type==='branches'){
      if (!S.init){
        S.init=true;
        const r0 = 5 + ((Math.random()*3)|0);
        for (let dy=-r0; dy<=r0; dy++){
          for (let dx=-r0; dx<=r0; dx++){
            if (dx*dx+dy*dy<=r0*r0 && state.rockBudget>0){
              const y = S.cy+dy, x = S.cx+dx;
              const isC = Math.random()<0.08;
              const col = isC ? crystalPickerByDepth(y,state.H)() : rockPickerByDepth(y,state.H)();
              setCellRGB(state, x,y, isC?CELL.CRYSTAL:CELL.ROCK, col);
              state.rockBudget--;
            }
          }
        }
        const ang0 = Math.random()*Math.PI*2;
        S.br=[
          {x:S.cx,y:S.cy,ang:ang0,life:260,thickness:4},
          {x:S.cx,y:S.cy,ang:ang0+(Math.random()<0.5?1:-1)*0.5,life:200,thickness:3},
        ];
      }
      const MAX_TWIGS=30, BR_PROB=0.05;

      for (const br of S.br){
        const t = Math.max(1, br.thickness|0);
        for (let dy=-t; dy<=t && state.rockBudget>0; dy++){
          for (let dx=-t; dx<=t && state.rockBudget>0; dx++){
            if (Math.abs(dx)+Math.abs(dy) <= t){
              const yy=(br.y+dy)|0, xx=(br.x+dx)|0;
              const isC = Math.random()<0.07;
              const col = isC ? crystalPickerByDepth(yy,state.H)() : rockPickerByDepth(yy,state.H)();
              setCellRGB(state, xx,yy, isC?CELL.CRYSTAL:CELL.ROCK, col);
              state.rockBudget--;
            }
          }
        }
        const margin = 14;
        let steer = 0;
        if (br.x < margin)           steer += (margin - br.x)/margin * 0.12;
        if (br.x > state.W-1-margin) steer -= (br.x - (state.W-1-margin))/margin * 0.12;
        if (br.y < margin)           steer += (margin - br.y)/margin * 0.08 * (Math.cos(br.ang)>0?1:-1);
        if (br.y > state.H-1-margin) steer -= (br.y - (state.H-1-margin))/margin * 0.08 * (Math.cos(br.ang)>0?1:-1);
        br.ang += steer + (Math.random()*2-1)*0.04;

        const speed = 1.0;
        let nx = br.x + Math.cos(br.ang)*speed;
        let ny = br.y + Math.sin(br.ang)*speed;
        if (nx<1 || nx>state.W-2){ br.ang = Math.PI - br.ang + (Math.random()*0.3-0.15); nx = Math.min(Math.max(nx,1), state.W-2); br.life += 12; }
        if (ny<1 || ny>state.H-2){ br.ang = -br.ang + (Math.random()*0.3-0.15); ny = Math.min(Math.max(ny,1), state.H-2); br.life += 12; }
        br.x = nx; br.y = ny;

        br.life--;
        if (br.thickness>1 && Math.random()<0.03) br.thickness -= 1;
        if (Math.random()<BR_PROB && S.br.length<MAX_TWIGS && br.thickness>=2){
          S.br.push({x:br.x,y:br.y,ang:br.ang+(Math.random()<0.5?1:-1)*0.6,life:120,thickness:Math.max(1, br.thickness-1)});
        }
      }
      S.br = S.br.filter(b=>b.life>0);
    }

    if (--S.ttl<=0){ const idx = Sarr.indexOf(S); if (idx>=0) Sarr.splice(idx,1); }
  }

  state.rockBudget = state.rockBudgetBase;
}
