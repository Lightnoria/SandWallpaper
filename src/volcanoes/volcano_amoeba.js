// volcanoes/volcano_amoeba.js
import { CELL } from '../constants.js';
import { setCellRGB, setSandRGB } from '../grid.js';
import { pickVolcanoTheme, rockPickerByDepth } from '../materials.js';

function writeRockOrCrystal(state, x,y, theme, opts){
  const { overwriteChance=0.35, crystalChance=0.02, depthBias=0.45, blendChance=0.3 } = opts||{};
  if (x<0||x>=state.W||y<0||y>=state.H) return false;
  if (state.rockBudget<=0) return false;

  const i = y*state.W + x;
  const typeAt = state.grid[i];
  const allowOverwrite = (typeAt===CELL.SAND) ? true : (Math.random() < overwriteChance);
  if (typeAt!==CELL.EMPTY && !allowOverwrite) return false;

  const baseRock = (Math.random()<depthBias ? rockPickerByDepth(y, state.H)() : theme.rockPick());
  setCellRGB(state, x,y, Math.random()<crystalChance?CELL.CRYSTAL:CELL.ROCK,
             Math.random()<crystalChance ? theme.crystalPick() : baseRock);
  state.rockBudget--;
  return true;
}

export function spawnVolcanoAmoeba(state, cx, cy){
  const theme = pickVolcanoTheme();
  const frontier = new Set([`${cx},${cy}`]);
  return { type:'volcano_amoeba', cx, cy, t:0, ttl:900, theme, frontier, area:new Set(), sandCooldown:8, sizeCap: 4200 + ((Math.random()*2200)|0), grewThisTick:false };
}
export function stepVolcanoAmoeba(state, S){
  const { theme } = S;
  S.grewThisTick=false;
  let steps = 80;
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

  S.sandCooldown--;
  if (S.sandCooldown<=0 && S.theme.sandPickers.length>0 && S.grewThisTick){
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
