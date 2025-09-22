import { CELL } from './constants.js';
import { setCell } from './grid.js';

export function initInput(state){
  const { canvas, W, H } = state;
  state.mouse = { x:W>>1, y:H>>1 };
  state.brush = 10;
  state.eraseHeld = false; // ← теперь стираем, когда зажат пробел

  canvas.addEventListener('contextmenu', e=>e.preventDefault());

  function eventToCell(e){
    const rect = canvas.getBoundingClientRect();
    const sx=(e.clientX-rect.left)/rect.width, sy=(e.clientY-rect.top)/rect.height;
    state.mouse.x = (sx*W)|0;
    state.mouse.y = (sy*H)|0;
  }

  // курсор — также на движение по странице, не только над канвасом
  addEventListener('mousemove', e=>eventToCell(e));

  // убираем логику ЛКМ; вместо этого — пробел
  addEventListener('keydown', (e)=>{
    if (e.code==='Space'){ e.preventDefault(); state.eraseHeld = true; }
  });
  addEventListener('keyup', (e)=>{
    if (e.code==='Space'){ e.preventDefault(); state.eraseHeld = false; }
  });

  state.applyBrush = ()=>{
    const { x,y } = state.mouse;
    const r2 = state.brush*state.brush;
    for(let dy=-state.brush; dy<=state.brush; dy++)
      for(let dx=-state.brush; dx<=state.brush; dx++)
        if (dx*dx+dy*dy<=r2) setCell(state, x+dx, y+dy, CELL.EMPTY);
  };
}
