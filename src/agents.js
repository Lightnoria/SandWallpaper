// agents.js
import { CELL } from './constants.js';
import { getCell, setCell, setCellRGB } from './grid.js';
import { rockPickerByDepth } from './materials.js';

// ── настройки бота (логика 1x1, визуал 4x4) ─────────────────────────
const BOT = {
  HP_MAX: 10,
  DIG_CD: 5,
  BUILD_CD: 14,
  ROOF_LOOKUP: 6,
  DMG_PER_SAND_COL: 1,    // урон за «колонну» песка над головой
  REPLAN_CD: 18,
  SPRITE_W: 4, SPRITE_H: 4,   // визуальный размер
};

export function initAgents(state){
  state.agents = state.agents ?? [];
}

export function spawnAgent(state, x=state.W>>1, y=state.H>>1){
  x = clamp(x, 0, state.W-1);
  y = clamp(y, 0, state.H-1);

  const a = {
    x, y,
    hp: BOT.HP_MAX,
    digCd: 0,
    buildCd: 0,
    planCd: 0,
    path: [],
    target: randomTarget(state),
  };
  // помечаем клетку как BOT (логическое присутствие 1x1)
  setCell(state, a.x, a.y, CELL.BOT);
  state.agents.push(a);
}

export function stepAgents(state){
  if (!state.agents?.length) return;

  const alive=[];
  for (const a of state.agents){
    // 0) урон от песка сверху и попытка поставить «крышу»
    applySandDamageAndRoof(state, a);
    if (a.hp<=0){ setCell(state, a.x, a.y, CELL.EMPTY); continue; }

    // 1) перезарядки
    a.digCd = Math.max(0, a.digCd-1);
    a.buildCd = Math.max(0, a.buildCd-1);
    a.planCd = Math.max(0, a.planCd-1);

    // 2) цель
    if (!a.target || !inBounds(state,a.target.x,a.target.y)){
      a.target = randomTarget(state);
      a.path.length=0;
    }

    // 3) план (A*)
    if ((!a.path || a.path.length===0) && a.planCd===0){
      a.path = astar(state, {x:a.x,y:a.y}, a.target);
      a.planCd = BOT.REPLAN_CD;
    }

    // 4) движение или копание
    if (a.path && a.path.length){
      const n = a.path[0];
      if (walkable1x1(state, n.x, n.y)){
        moveBot(state, a, n.x, n.y);
        a.path.shift();
      } else {
        tryDigToward(state, a, n);
      }
    } else {
      tryDigToward(state, a, a.target);
      if (Math.random()<0.01) a.target = randomTarget(state);
    }

    alive.push(a);
  }
  state.agents = alive;
}

// ── урон от песка и «крыша» ────────────────────────────────────────
function applySandDamageAndRoof(state, a){
  // смотрим столбик над головой на высоту ROOF_LOOKUP
  let hasSand = false;
  for (let dy=1; dy<=BOT.ROOF_LOOKUP; dy++){
    const t = getCellSafe(state, a.x, a.y-dy);
    if (t===CELL.SAND){ hasSand=true; break; }
  }
  if (hasSand) a.hp -= BOT.DMG_PER_SAND_COL;

  // ставим «крышу» 3×1 над головой, если над нами пусто, а выше есть песок
  if (a.buildCd===0){
    let needRoof=false;
    if (getCellSafe(state, a.x, a.y-1)===CELL.EMPTY){
      for (let dy=2; dy<=BOT.ROOF_LOOKUP; dy++){
        if (getCellSafe(state, a.x, a.y-dy)===CELL.SAND){ needRoof=true; break; }
      }
    }
    if (needRoof){
      const yRoof = a.y-1;
      if (yRoof>=0){
        for (let dx=-1; dx<=1; dx++){
          const rx=a.x+dx, ry=yRoof;
          if (!inBounds(state,rx,ry)) continue;
          const col = rockPickerByDepth(ry, state.H)();
          setCellRGB(state, rx, ry, CELL.ROCK, col);
        }
        a.buildCd = BOT.BUILD_CD;
      }
    }
  }
}

// ── движение/копание ───────────────────────────────────────────────
function moveBot(state, a, nx, ny){
  // очистить старую 1x1 клетку
  setCell(state, a.x, a.y, CELL.EMPTY);
  a.x = nx; a.y = ny;
  setCell(state, a.x, a.y, CELL.BOT);
}

function tryDigToward(state, a, tgt){
  if (a.digCd>0) return;
  const dx = Math.sign(tgt.x - a.x);
  const dy = Math.sign(tgt.y - a.y);
  const dirs = (Math.abs(tgt.x-a.x)>Math.abs(tgt.y-a.y)) ? [[dx,0],[0,dy],[dx,dy]] : [[0,dy],[dx,0],[dx,dy]];

  for (const [sx,sy] of dirs){
    const rx = a.x + sx, ry = a.y + sy;
    if (!inBounds(state,rx,ry)) continue;
    const t = getCell(state, rx, ry);
    if (t!==CELL.EMPTY && t!==CELL.BOT){
      setCell(state, rx, ry, CELL.EMPTY);
      a.digCd = BOT.DIG_CD;
      return;
    }
  }
}

// ── A* для 1x1 узлов ───────────────────────────────────────────────
function astar(state, start, goal){
  const open = new Map(), came = new Map(), g = new Map(), f = new Map();
  const sk = K(start.x,start.y);
  g.set(sk,0); f.set(sk,heur(start,goal));
  open.set(sk,{x:start.x,y:start.y,f:f.get(sk)});

  const closed = new Set();
  while(open.size){
    const cur = popBest(open);
    const ck = K(cur.x,cur.y);
    if (cur.x===goal.x && cur.y===goal.y) return reconstruct(came,cur);

    closed.add(ck);
    for (const [nx,ny] of n4(cur.x,cur.y)){
      if (!walkable1x1(state,nx,ny)) continue;
      const nk = K(nx,ny);
      if (closed.has(nk)) continue;

      const tentative = (g.get(ck)??1e9)+1;
      if (!open.has(nk) || tentative < (g.get(nk)??1e9)){
        came.set(nk,cur);
        g.set(nk,tentative);
        f.set(nk, tentative + heur({x:nx,y:ny},goal));
        open.set(nk,{x:nx,y:ny,f:f.get(nk)});
      }
    }
  }
  return [];
}

function walkable1x1(state, x,y){
  if (!inBounds(state,x,y)) return false;
  const t = getCell(state,x,y);
  return (t===CELL.EMPTY || t===CELL.BOT); // бот может «стоять» там, где он уже стоит
}

function n4(x,y){ return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]; }
function heur(a,b){ return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }
function reconstruct(came, cur){
  const out=[]; while(cur){ out.unshift({x:cur.x,y:cur.y}); cur=came.get(K(cur.x,cur.y)); }
  out.shift(); return out;
}
function popBest(open){
  let bk=null,bv=null;
  for (const [k,v] of open){ if (!bv || v.f<bv.f){ bv=v; bk=k; } }
  if (bk) open.delete(bk);
  return bv;
}

// ── overlay-рендер спрайта 4×4 поверх кадра ────────────────────────
export function renderAgentsOverlay(state){
  if (!state.agents?.length) return;
  const { W } = state;
  const data = state.frame.data;

  for (const a of state.agents){
    const x0 = a.x - ((BOT.SPRITE_W-1)>>1);
    const y0 = a.y - ((BOT.SPRITE_H-1)>>1);

    for (let j=0;j<BOT.SPRITE_H;j++){
      for (let i=0;i<BOT.SPRITE_W;i++){
        const x = x0+i, y = y0+j;
        if (!inBounds(state,x,y)) continue;

        // простая пиксельная «капсула»: контур + свет внутри
        const edge = (i===0||j===0||i===BOT.SPRITE_W-1||j===BOT.SPRITE_H-1);
        const base = edge ? [235,220,105] : [250,245,120];
        const spec = (i===1 && j===1) ? [255,255,160] : base;

        const p = (y*W + x) << 2;
        data[p  ] = spec[0];
        data[p+1] = spec[1];
        data[p+2] = spec[2];
        data[p+3] = 255;
      }
    }
  }
}

// ── утилиты ────────────────────────────────────────────────────────
function K(x,y){ return `${x},${y}`; }
function clamp(v,lo,hi){ return v<lo?lo:v>hi?hi:v; }
function inBounds(state,x,y){ return x>=0&&y>=0&&x<state.W&&y<state.H; }
function getCellSafe(state,x,y){
  if (!inBounds(state,x,y)) return CELL.ROCK;
  return getCell(state,x,y);
}
function randomTarget(state){
  return { x:(Math.random()*state.W)|0, y:(Math.random()*state.H)|0 };
}
