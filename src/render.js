import { CELL, CRYSTAL_PULSE } from './constants.js';
import { renderAgentsOverlay } from './agents.js';

export function initBackground(state){
  const { ctx, W, H } = state;
  state.frame = ctx.createImageData(W,H);
  state.bg    = ctx.createImageData(W,H);

  // ↓ фон заметно темнее/теплее
  for (let y=0; y<H; y++)
    for (let x=0; x<W; x++){
      const p=(y*W+x)<<2;
      const base = 16;                    // было ~25
      const grad = (y/H)*22;              // было *32
      const noise = (Math.random()*6)|0;  // было 8
      const v = base + grad + noise;

      state.bg.data[p  ] = 18 + v;          // R
      state.bg.data[p+1] = 14 + v*0.78;     // G
      state.bg.data[p+2] = 10 + v*0.48;     // B
      state.bg.data[p+3] = 255;
    }
}

export function render(state){
  const { ctx, grid, r,g,b } = state;
  state.frame.data.set(state.bg.data);

  const t = performance.now();
  for (let i=0; i<grid.length; i++){
    const type = grid[i];
    if (type===CELL.EMPTY) continue;
    const p=i<<2;
    let R=r[i], G=g[i], B=b[i];

    if (type===CELL.CRYSTAL){
      const k = CRYSTAL_PULSE.base + CRYSTAL_PULSE.amp*Math.sin(t/140 + i*0.37);
      R = Math.max(0, Math.min(255, (R*k)|0));
      G = Math.max(0, Math.min(255, (G*k)|0));
      B = Math.max(0, Math.min(255, (B*k)|0));
    }
    state.frame.data[p]=R; state.frame.data[p+1]=G; state.frame.data[p+2]=B; state.frame.data[p+3]=255;
  }
  
  renderAgentsOverlay(state);
  ctx.putImageData(state.frame,0,0);
}
    