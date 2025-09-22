// volcanoes/volcano_maze.js
import { CELL } from '../constants.js';
import { setCellRGB } from '../grid.js';
import { crystalPickerByDepth, rockPickerByDepth } from '../materials.js';

/* === генерация лабиринта и «неровного круга» === */
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

function makeNoisyCircle(cx, cy, R0){
  const k1 = 2 + ((Math.random()*3)|0);
  const k2 = 3 + ((Math.random()*4)|0);
  const p1 = Math.random()*Math.PI*2;
  const p2 = Math.random()*Math.PI*2;
  const jitter = 0.18 + Math.random()*0.12;
  return (x,y)=>{
    const th = Math.atan2(y-cy, x-cx);
    const base = R0 * (0.94 + 0.12*Math.sin(k1*th+p1) + 0.08*Math.sin(k2*th+p2));
    const rEdge = base * (1 + jitter*(Math.random()*2-1)*0.15);
    const r = Math.hypot(x-cx, y-cy);
    return r <= rEdge;
  };
}

function wallsFromMaze(cells, ox, oy, cell, gw, gh){
  const segs = [];
  for (let y=0; y<gh; y++){
    for (let x=0; x<gw; x++){
      const c = cells[y][x];
      const x0 = ox + x*cell, y0 = oy + y*cell;
      const x1 = ox + (x+1)*cell, y1 = oy + (y+1)*cell;
      if (c.n) segs.push({o:'h', y:y0, x1:x0, x2:x1});
      if (c.w) segs.push({o:'v', x:x0, y1:y0, y2:y1});
      if (x===gw-1 && c.e) segs.push({o:'v', x:x1, y1:y0, y2:y1});
      if (y===gh-1 && c.s) segs.push({o:'h', y:y1, x1:x0, x2:x1});
    }
  }
  return segs;
}

function filterAndFragmentSegments(segs, cx, cy, inCircle){
  const out = [];
  const gapProb = 0.22 + Math.random()*0.12;
  for (const s of segs){
    const mx = (s.o==='h') ? ((s.x1+s.x2)/2) : s.x;
    const my = (s.o==='h') ? s.y : ((s.y1+s.y2)/2);
    if (!inCircle(mx,my)) continue;
    if (Math.random()<gapProb) continue;

    if (s.o==='h'){
      const len = Math.max(1, Math.abs(s.x2 - s.x1));
      const parts = (len>20) ? 3 : (len>10 ? 2 : 1);
      const step = len/parts;
      for (let i=0;i<parts;i++){
        const px1 = Math.round(s.x1 + i*step);
        const px2 = Math.round(s.x1 + (i+1)*step);
        if (Math.random()<0.18) continue;
        out.push({o:'h', y:s.y, x1:px1, x2:px2});
      }
    } else {
      const len = Math.max(1, Math.abs(s.y2 - s.y1));
      const parts = (len>20) ? 3 : (len>10 ? 2 : 1);
      const step = len/parts;
      for (let i=0;i<parts;i++){
        const py1 = Math.round(s.y1 + i*step);
        const py2 = Math.round(s.y1 + (i+1)*step);
        if (Math.random()<0.18) continue;
        out.push({o:'v', x:s.x, y1:py1, y2:py2});
      }
    }
  }

  out.sort((a,b)=>{
    const ax = (a.o==='h') ? ((a.x1+a.x2)/2) : a.x;
    const ay = (a.o==='h') ? a.y : ((a.y1+a.y2)/2);
    const bx = (b.o==='h') ? ((b.x1+b.x2)/2) : b.x;
    const by = (b.o==='h') ? b.y : ((b.y1+b.y2)/2);
    return Math.hypot(ax-cx, ay-cy) - Math.hypot(bx-cx, by-cy);
  });

  const chunk = 20;
  for (let i=0; i<out.length; i+=chunk){
    const slice = out.slice(i, i+chunk);
    for (let k=slice.length-1;k>0;k--){ const j=(Math.random()*(k+1))|0; [slice[k],slice[j]]=[slice[j],slice[k]]; }
    out.splice(i, slice.length, ...slice);
  }

  return out;
}

/* === отрисовка тонких стен === */
function putPixel(state, x,y){
  if (x<0||x>=state.W||y<0||y>=state.H) return;
  if (state.rockBudget<=0) return;
  if (Math.random()<0.06) return; // лёгкая «рваность»
  const useCrystal = Math.random()<0.015;
  const col = useCrystal ? crystalPickerByDepth(y,state.H)() : rockPickerByDepth(y,state.H)();
  setCellRGB(state, x,y, useCrystal?CELL.CRYSTAL:CELL.ROCK, col);
  state.rockBudget--;
}

function drawSegmentThin(state, seg){
  const clamp = (v,min,max)=> v<min?min: v>max?max:v;
  if (seg.o==='v'){
    const x = seg.x|0;
    const y1 = clamp(seg.y1|0, 0, state.H-1);
    const y2 = clamp(seg.y2|0, 0, state.H-1);
    for (let y=y1; y<=y2 && state.rockBudget>0; y++) putPixel(state, x, y);
  } else {
    const y = seg.y|0;
    const x1 = clamp(seg.x1|0, 0, state.W-1);
    const x2 = clamp(seg.x2|0, 0, state.W-1);
    for (let x=x1; x<=x2 && state.rockBudget>0; x++) putPixel(state, x, y);
  }
}

/* === публичный API: spawn/step === */
export function spawnMazeVolcano(state, cx, cy){
  // твои настройки (тончайшая сетка):
 const cell = 2; 
 const gw = Math.max(120, Math.min(((state.W-40)/cell)|0, 46)); 
 const gh = Math.max(90, Math.min(((state.H-40)/cell)|0, 34));

  const widthPx  = gw*cell;
  const heightPx = gh*cell;
  const ox = Math.max(8, Math.min(cx - (widthPx>>1),  state.W - widthPx  - 2));
  const oy = Math.max(8, Math.min(cy - (heightPx>>1), state.H - heightPx - 2));

  const maze = buildSimpleMaze(gw, gh);
  const rawSegs = wallsFromMaze(maze, ox, oy, cell, gw, gh);

  const R0 = Math.min(widthPx, heightPx) * (0.5 + Math.random()*0.08);
  const inside = makeNoisyCircle(cx, cy, R0);
  const segs = filterAndFragmentSegments(rawSegs, cx, cy, inside);

  return {
    type:'maze',
    cx, cy,
    t:0,
    ttl: 680,
    segs,
    k: 0,
    batchMin: 14,
    batchMax: 26
  };
}

export function stepMazeVolcano(state, S){
  const batch = S.batchMin + ((Math.random()*(S.batchMax - S.batchMin + 1))|0);
  for (let n=0; n<batch && state.rockBudget>0 && S.k < S.segs.length; n++){
    drawSegmentThin(state, S.segs[S.k++]);
  }
  if (S.k >= S.segs.length) S.ttl -= 10;
}
