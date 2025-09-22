export const CELL = { EMPTY:0, SAND:1, ROCK:2, CRYSTAL:3, BOT:4 };

export const SOURCE_TYPES = [
  { t:'spiral',          w:1 },
  { t:'branches',        w:2 },
  { t:'maze',            w:3 },
  { t:'volcano',         w:4 }, // включает «обычные ромбы»
  { t:'supervolcano',    w:1 }, // включает «лучистые ромбы»
  { t:'volcano_amoeba',  w:1 },
];

export const ROCK_DRAWS_BUDGET = 1500;
export const SPAWN_PROB_BASE   = 0.0001;
export const WATCHDOG_FRAMES   = 800;

// глобальные шкалы цвета
export const COLOR_SCALE = 0.75;   // породы/песок (тусклее)
export const CRYSTAL_COLOR_SCALE = 0.95; // кристаллы (чуть ярче)
export const CRYSTAL_PULSE = { base: 0.70, amp: 0.25 };

// профили (для тестов все = ACTIVE/60 FPS)
export const PERFORMANCE_PROFILES = {
  ACTIVE: { fps: 60, simScale: 1.00, spawnMul: 1.00, rockMul: 1.00 },
  DIMMED: { fps: 60, simScale: 1.00, spawnMul: 1.00, rockMul: 1.00 },
  HIDDEN: { fps: 60, simScale: 1.00, spawnMul: 1.00, rockMul: 1.00 },
};
