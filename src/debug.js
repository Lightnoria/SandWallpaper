import { spawnSourceType } from './sources.js';
import { CELL } from './constants.js';
import { spawnAgent } from './agents.js'; // ← добавить

function clearAll(state){
  state.grid.fill(CELL.EMPTY);
  state.next.fill(CELL.EMPTY);
  state.r.fill(0); state.g.fill(0); state.b.fill(0);
  state.sources.length = 0;
}

function btn(label, onClick){
  const b = document.createElement('button');
  b.textContent = label;
  Object.assign(b.style, {
    padding: '6px 10px',
    margin: '4px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)',
    color: '#eee',
    cursor: 'pointer',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '12px',
    backdropFilter: 'blur(6px)',
  });
  b.onmouseenter = ()=> b.style.background = 'rgba(255,255,255,0.15)';
  b.onmouseleave = ()=> b.style.background = 'rgba(255,255,255,0.08)';
  b.onclick = onClick;
  return b;
}

export function attachDebugPanel(state){
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed',
    right: '10px',
    bottom: '10px',
    zIndex: 9999,
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '14px',
    padding: '8px',
    display: 'flex',
    flexWrap: 'wrap',
    maxWidth: '340px',
    gap: '4px',
    boxShadow: '0 6px 22px rgba(0,0,0,0.45)',
    backdropFilter: 'blur(8px)',
    userSelect: 'none'
  });

  const center = ()=> [state.W>>1, state.H>>1];

  box.append(
    btn('Вулкан (центр)',   ()=>{ const [x,y]=center(); spawnSourceType(state,'volcano',x,y); }),
    btn('Супер-вулкан',     ()=>{ const [x,y]=center(); spawnSourceType(state,'supervolcano',x,y); }),
    btn('Амёба',            ()=>{ const [x,y]=center(); spawnSourceType(state,'volcano_amoeba',x,y); }),
    btn('Ветки',            ()=>{ const [x,y]=center(); spawnSourceType(state,'branches',x,y); }),
    btn('Лабиринт',         ()=>{ const [x,y]=center(); spawnSourceType(state,'maze',x,y); }),
    btn('БОТ',            ()=>{ const [x,y]=center(); spawnAgent(state,x,y); }),
    btn('Очистить экран',   ()=>{ clearAll(state); })
  );

  document.body.appendChild(box);

  addEventListener('keydown', (e)=>{
    const [x,y] = center();
    if (e.code==='KeyV' && !e.shiftKey){ spawnSourceType(state,'volcano',x,y); }
    else if (e.code==='KeyV' && e.shiftKey){ spawnSourceType(state,'supervolcano',x,y); }
    else if (e.code==='KeyA'){ spawnSourceType(state,'volcano_amoeba',x,y); }
    else if (e.code==='KeyB'){ spawnSourceType(state,'branches',x,y); }
    else if (e.code==='KeyM'){ spawnSourceType(state,'maze',x,y); }
    else if (e.code==='KeyX'){ clearAll(state); }
  });
}
