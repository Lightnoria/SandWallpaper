// sources.js
import { CELL, WATCHDOG_FRAMES, SOURCE_TYPES } from './constants.js';
import { pickWeighted } from './utils.js';
import { setCellRGB } from './grid.js';
import { crystalPickerByDepth, rockPickerByDepth } from './materials.js';
import {
  spawnVolcano, stepVolcano,
  spawnSuperVolcano, stepSuperVolcano,
  spawnVolcanoAmoeba, stepVolcanoAmoeba
} from './volcanoes.js';

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

/* ──────────────────────────────────────────────────────────────────────────────
   МАЗЕ-ВУЛКАН (тонкие стенки, заранее посчитан, растёт от центра к шумному кругу)
   ────────────────────────────────────────────────────────────────────────────── */

/** классический DFS-лабиринт на сетке gw×gh */
function buildSimpleMaze(gw, gh){
  const cells = Array.from({length:gh}, ()=> Array.from({length:gw}, ()=> ({
    n:true, e:true, s:true, w:true, vis:false
  })));
  const inb = (x,y)=> x>=0&&x<gw&&y>=0&&y<gh;

  const stack = [];
  const sx=(Math.random()*gw)|0, sy=(Math.random()*gh)|0;
  stack.push([sx,sy]); cells[sy][sx].vis=true;

  const nbrs = (x,y)=>[
    [x, y-1, 'n','s'],
    [x+1,y,  'e','w'],
    [x, y+1, 's','n'],
    [x-1,y,  'w','e'],
  ].filter(([nx,ny])=> inb(nx,ny) && !cells[ny][nx].vis);

  while (stack.length){
    const [x,y] = stack[stack.length-1];
    const options = nbrs(x,y);
    if (!options.length){ stack.pop(); continue; }
    const [nx,ny,dir,opp] = options[(Math.random()*options.length)|0];
    cells[y][x][dir] = false;
    cells[ny][nx][opp] = false;
    cells[ny][nx].vis = true;
    stack.push([nx,ny]);
  }
  return cells;
}

/** генератор «шумной окружности»: радиус R(θ) = R0 * (base + шум синусами) */
function makeNoisyCircle(cx, cy, R0){
  const a = 0.88 + Math.random()*0.06;     // базовый коэффициент (легкая эллиптичность)
  const b = 0.95 + Math.random()*0.08;
  const k1 = 2 + ((Math.random()*3)|0);
  const k2 = 3 + ((Math.random()*4)|0);
  const n1 = Math.random()*Math.PI*2;
  const n2 = Math.random()*Math.PI*2;
  const jitter = 0.18 + Math.random()*0.12; // амплитуда «рваности» края
  return (x,y)=>{
    const th = Math.atan2(y-cy, x-cx);
    const base = R0 * (0.9 + 0.12*Math.sin(k1*th+n1) + 0.08*Math.sin(k2*th+n2));
    const rEdge = base * (1 + jitter*(Math.random()*2-1)*0.15);
    const r = Math.hypot(x-cx, y-cy);
    return r <= rEdge;
  };
}

/** перевод стен лабиринта в пиксельные сегменты с тонкими стенками */
function wallsFromMaze(cells, ox, oy, cell, gw, gh){
  const segs = [];
  // внутренние стены по данным клеток (толщина=1 — тонкие)
  for (let y=0; y<gh; y++){
    for (let x=0; x<gw; x++){
      const c = cells[y][x];
      const x0 = ox + x*cell, y0 = oy + y*cell;
      const x1 = ox + (x+1)*cell, y1 = oy + (y+1)*cell;
      if (c.n) segs.push({o:'h', y:y0, x1:x0, x2:x1, th:1});
      if (c.w) segs.push({o:'v', x:x0, y1:y0, y2:y1, th:1});
      // для правого/нижнего края, чтобы замкнуть периметр ячейки
      if (x===gw-1 && c.e) segs.push({o:'v', x:x1, y1:y0, y2:y1, th:1});
      if (y===gh-1 && c.s) segs.push({o:'h', y:y1, x1:x0, x2:x1, th:1});
    }
  }
  return segs;
}

/** лёгкая фильтрация и «обрывы» стен */
function filterAndFragmentSegments(segs, cx, cy, inCircle){
  const out = [];
  const gapProb = 0.22 + Math.random()*0.12; // вероятность «обрыва» целого сегмента
  for (const s of segs){
    // центр сегмента
    const mx = (s.o==='h') ? ((s.x1+s.x2)/2) : s.x;
    const my = (s.o==='h') ? s.y : ((s.y1+s.y2)/2);

    // оставляем только те, кто в шумной окружности (как будто кратер)
    if (!inCircle(mx,my)) continue;

    // иногда выкидываем сегмент целиком — «оборвано»
    if (Math.random()<gapProb) continue;

    // для фрагментации длинного сегмента: разбиваем на 2-3 куска и выкидываем случайный
    if (s.o==='h'){
      const len = Math.max(1, Math.abs(s.x2 - s.x1));
      const parts = (len>10) ? 2 + ((Math.random()*2)|0) : 1;
      const step = len/parts;
      for (let i=0;i<parts;i++){
        const px1 = Math.round(s.x1 + i*step);
        const px2 = Math.round(s.x1 + (i+1)*step);
        if (Math.random()<0.18) continue; // убрать случайный кусок
        out.push({o:'h', y:s.y, x1:px1, x2:px2, th:s.th});
      }
    } else {
      const len = Math.max(1, Math.abs(s.y2 - s.y1));
      const parts = (len>10) ? 2 + ((Math.random()*2)|0) : 1;
      const step = len/parts;
      for (let i=0;i<parts;i++){
        const py1 = Math.round(s.y1 + i*step);
        const py2 = Math.round(s.y1 + (i+1)*step);
        if (Math.random()<0.18) continue;
        out.push({o:'v', x:s.x, y1:py1, y2:py2, th:s.th});
      }
    }
  }

  // Сортировка по расстоянию от центра — чтобы рост шёл «из центра наружу»
  out.sort((a,b)=>{
    const ax = (a.o==='h') ? ((a.x1+a.x2)/2) : a.x;
    const ay = (a.o==='h') ? a.y : ((a.y1+a.y2)/2);
    const bx = (b.o==='h') ? ((b.x1+b.x2)/2) : b.x;
    const by = (b.o==='h') ? b.y : ((b.y1+b.y2)/2);
    return Math.hypot(ax-cx, ay-cy) - Math.hypot(bx-cx, by-cy);
  });

  // Перемешиваем слегка внутри локальных «раундов», чтобы было хаотичнее
  const chunk = 20;
  for (let i=0; i<out.length; i+=chunk){
    const slice = out.slice(i, i+chunk);
    for (let k=slice.length-1;k>0;k--){ const j=(Math.random()*(k+1))|0; [slice[k],slice[j]]=[slice[j],slice[k]]; }
    out.splice(i, slice.length, ...slice);
  }

  return out;
}

/** простая запись камня/кристалла, тонкая стенка */
function writeRockOrCrystalSimple(state, x,y, yH){
  if (x<0||x>=state.W||y<0||y>=state.H) return false;
  if (state.rockBudget<=0) return false;
  const useCrystal = Math.random()<0.015; // ещё реже кристаллы
  const col = useCrystal ? crystalPickerByDepth(y,yH)() : rockPickerByDepth(y,yH)();
  setCellRGB(state, x,y, useCrystal?CELL.CRYSTAL:CELL.ROCK, col);
  state.rockBudget--;
  return true;
}

/** рисуем один сегмент (толщина=1) с лёгкой «рябью» пикселей */
function drawThinSegment(state, seg){
  const clamp = (v,min,max)=> v<min?min: v>max?max:v;

  if (seg.o==='v'){
    const x = seg.x|0;
    const y1 = clamp(seg.y1|0, 0, state.H-1);
    const y2 = clamp(seg.y2|0, 0, state.H-1);
    for (let y=y1; y<=y2 && state.rockBudget>0; y++){
      // редкие пропуски по пикселю, чтобы стенка казалась «рваной»
      if (Math.random()<0.06) continue;
      writeRockOrCrystalSimple(state, x, y, state.H);
    }
  } else { // 'h'
    const y = seg.y|0;
    const x1 = clamp(seg.x1|0, 0, state.W-1);
    const x2 = clamp(seg.x2|0, 0, state.W-1);
    for (let x=x1; x<=x2 && state.rockBudget>0; x++){
      if (Math.random()<0.06) continue;
      writeRockOrCrystalSimple(state, x, y, state.H);
    }
  }
}

function spawnMazeVolcano(state, cx, cy){
  // размеры сетки и ячейки (тонкие и частые)
  const cell = 2; // меньше шаг → тоньше фактическая структура
  const gw = Math.max(50, Math.min(((state.W-40)/cell)|0, 46));
  const gh = Math.max(50, Math.min(((state.H-40)/cell)|0, 34));

  const widthPx  = gw*cell;
  const heightPx = gh*cell;
  const ox = Math.max(2, Math.min(cx - (widthPx>>1),  state.W - widthPx  - 2));
  const oy = Math.max(2, Math.min(cy - (heightPx>>1), state.H - heightPx - 2));

  // 1) строим лабиринт
  const maze = buildSimpleMaze(gw, gh);

  // 2) переводим в сегменты (тонкие)
  const rawSegs = wallsFromMaze(maze, ox, oy, cell, gw, gh);

  // 3) шумная окружность (кривая «чаша» кратера) и обрывистость
  const R0 = Math.min(widthPx, heightPx) * (0.48 + Math.random()*0.08);
  const inside = makeNoisyCircle(cx, cy, R0);
  const segs = filterAndFragmentSegments(rawSegs, cx, cy, inside);

  return {
    type:'maze',
    cx, cy,
    t:0,
    ttl: 680,
    segs,     // уже предвычисленный список тонких сегментов
    k: 0,
    batchMin: 10,
    batchMax: 22
  };
}

function stepMazeVolcano(state, S){
  // растём «кольцами» от центра наружу, но чуть хаотично
  const batch = S.batchMin + ((Math.random()*(S.batchMax - S.batchMin + 1))|0);
  for (let n=0; n<batch && state.rockBudget>0 && S.k < S.segs.length; n++){
    drawThinSegment(state, S.segs[S.k++]);
  }
  if (S.k >= S.segs.length) S.ttl -= 10; // когда всё построено — быстро «затухаем»
}

/* ──────────────────────────────────────────────────────────────────────────────
   ОСНОВНОЙ ШАГ ИСТОЧНИКОВ (без изменений для прочих типов)
   ────────────────────────────────────────────────────────────────────────────── */

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

  // PASS 1: вулканы (включая «maze»)
  state.rockBudget = budgetVol;
  for (let s=volcanic.length-1; s>=0 && state.rockBudget>0; s--){
    const S = volcanic[s]; S.t++;
    if (S.type==='volcano') stepVolcano(state, S);
    else if (S.type==='supervolcano') stepSuperVolcano(state, S);
    else if (S.type==='volcano_amoeba') stepVolcanoAmoeba(state, S);
    else if (S.type==='maze') stepMazeVolcano(state, S);

    if (--S.ttl<=0){ const idx = Sarr.indexOf(S); if (idx>=0) Sarr.splice(idx,1); }
  }

  // PASS 2: паттерны
  state.rockBudget = budgetPat;
  for (let s=patterns.length-1; s>=0 && state.rockBudget>0; s--){
    const S = patterns[s]; S.t++;

    // спираль
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

    // ветки
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
