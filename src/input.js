import { CELL } from './constants.js';
import { setCell } from './grid.js';

export function initInput(state){
  const { canvas, W, H } = state;
  state.mouse = { x: W >> 1, y: H >> 1 };
  state.brush = 10;
  state.eraseHeld = false; // зажата ли ЛКМ для «очистки»

  // правый клик не вызывает контекстное меню
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // переводим событие в координаты ячеек
  function eventToCell(e){
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / rect.width;
    const sy = (e.clientY - rect.top) / rect.height;
    state.mouse.x = (sx * W) | 0;
    state.mouse.y = (sy * H) | 0;
  }

  // ===== Pointer Events (надёжнее в Wallpaper Engine) =====

  // обновляем позицию даже когда курсор вне канваса
  addEventListener('pointermove', e => {
    eventToCell(e);
  }, { passive: true });

  // зажали ЛКМ — начинаем «стирание»
  canvas.addEventListener('pointerdown', e => {
    if (e.button === 0) {
      state.eraseHeld = true;
      // на время драга отключаем выделение и берём захват указателя
      document.body.__prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    eventToCell(e);
  }, { passive: false });

  // отпустили кнопку — перестаём стирать и возвращаем выделение
  addEventListener('pointerup', e => {
    if (e.button === 0) {
      state.eraseHeld = false;
      if (document.body.__prevUserSelect !== undefined) {
        document.body.style.userSelect = document.body.__prevUserSelect;
        delete document.body.__prevUserSelect;
      }
    }
  });

  // если система отменила жест/ушли с фокуса — тоже сбрасываем
  addEventListener('pointercancel', () => {
    state.eraseHeld = false;
    if (document.body.__prevUserSelect !== undefined) {
      document.body.style.userSelect = document.body.__prevUserSelect;
      delete document.body.__prevUserSelect;
    }
  });
  addEventListener('blur', () => {
    state.eraseHeld = false;
    if (document.body.__prevUserSelect !== undefined) {
      document.body.style.userSelect = document.body.__prevUserSelect;
      delete document.body.__prevUserSelect;
    }
  });

  // основное действие кисти «очистки»
  state.applyBrush = () => {
    const { x, y } = state.mouse;
    const r2 = state.brush * state.brush;
    for (let dy = -state.brush; dy <= state.brush; dy++)
      for (let dx = -state.brush; dx <= state.brush; dx++)
        if (dx*dx + dy*dy <= r2)
          setCell(state, x + dx, y + dy, CELL.EMPTY);
  };
}
