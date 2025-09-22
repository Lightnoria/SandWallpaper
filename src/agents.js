// agents.js
import { CELL } from './constants.js';
import { getCell, setCell } from './grid.js';
import { rockPickerByDepth } from './materials.js';

// ── Публичный API ────────────────────────────────────────────────
export function initAgents(state){
  state.agents = state.agents ?? [];
}

export function spawnAgent(state, x=state.W>>1, y=state.H>>1){
  const a = {
    x, y,
    hp: 3,
    digCooldown: 0,
    buildCooldown: 0,
    dir: Math.random()<0.5?-1:1,
    thinkTimer: 0,
  };
  state.agents.push(a);
  // размещаем бота на сетке
  setCell(state, a.x, a.y, CELL.BOT);
}

export function stepAgents(state){
  if (!state.agents || !state.agents.length) return;

  // 1) Смерть от «падения сверху»: если поверх BOT оказался материал — бот погибает
  crushCheck(state);

  // 2) Ходим/копаем/строим для каждого живого бота
  const alive = [];
  for (const a of state.agents){
    const at = getCell(state, a.x, a.y);
    if (at !== CELL.BOT) continue; // уже раздавлен/удалён

    a.thinkTimer--;
    if (a.thinkTimer<=0){
      a.thinkTimer = 30 + ((Math.random()*40)|0);
      // иногда меняем направление движения
      if (Math.random()<0.35) a.dir = (Math.random()<0.5?-1:1);
    }

    a.digCooldown = Math.max(0, a.digCooldown-1);
    a.buildCooldown = Math.max(0, a.buildCooldown-1);

    // простейшая гравитация для бота: если снизу пусто — падаем
    if (getCell(state, a.x, a.y+1) === CELL.EMPTY){
      moveAgentTo(state, a, a.x, a.y+1);
      alive.push(a);
      continue;
    }

    // пробуем шаг вбок (с приоритетом обхода препятствия по диагонали вниз)
    const nx = a.x + a.dir;
    if (getCell(state, nx, a.y) === CELL.EMPTY){
      moveAgentTo(state, a, nx, a.y);
    } else if (getCell(state, nx, a.y+1) === CELL.EMPTY){
      moveAgentTo(state, a, nx, a.y+1);
    } else {
      // если упёрлись — шанс покопать
      if (a.digCooldown===0){
        const tx = nx, ty = a.y; // целевая клетка перед ботом
        const tCell = getCell(state, tx, ty);
        if (tCell===CELL.SAND || tCell===CELL.ROCK || tCell===CELL.CRYSTAL){
          setCell(state, tx, ty, CELL.EMPTY); // выкопали
          a.digCooldown = 6;
        } else if (tCell===CELL.EMPTY && a.buildCooldown===0 && Math.random()<0.15){
          // Иногда «строим» камень как маркер/ступеньку
          const rgb = rockPickerByDepth(ty, state.H)();
          // небольшой хак: упростим запись — через setCell + перерисовка цветом
          setCell(state, tx, ty, CELL.ROCK);
          // Цвет уже назначит grid.setCell для ROCK; можно было бы setCellRGB, но ok
          a.buildCooldown = 25;
        } else {
          // смена направления, чтобы не клинить
          a.dir = -a.dir;
        }
      }
    }

    alive.push(a);
  }
  state.agents = alive;
}

// ── Вспомогательные ─────────────────────────────────────────────
function moveAgentTo(state, a, nx, ny){
  // очистим старую клетку
  setCell(state, a.x, a.y, CELL.EMPTY);
  a.x = nx; a.y = ny;
  // поставим бота на новую клетку
  setCell(state, a.x, a.y, CELL.BOT);
}

function crushCheck(state){
  // Бот умирает, если после шага песка/источников его клетка стала не BOT.
  // Т.е. любой материал «упал в него» → раздавило.
  for (let i=state.agents.length-1; i>=0; i--){
    const a = state.agents[i];
    const t = getCell(state, a.x, a.y);
    if (t !== CELL.BOT){
      // бот погибает — удаляем ссылку
      state.agents.splice(i,1);
    }
  }
}