export const PERKS = [
  { id: 'luckyStar', icon: '✨', name: '幸运星', description: '新关卡随机出现一个特殊块' },
  { id: 'bombUpgrade', icon: '💥', name: '爆炸升级', description: '范围炸弹扩大一圈' },
  { id: 'comboBoost', icon: '🎶', name: '闪耀连击', description: 'Combo 3以上额外获得20%积分' },
  { id: 'extraMoves', icon: '👣', name: '多一点时间', description: '之后每关额外增加2步' },
  { id: 'rainbowBlessing', icon: '🌈', name: '彩虹祝福', description: '四连偶尔升级成彩虹星' },
  { id: 'luckyStart', icon: '🍀', name: '幸运开局', description: '开局随机清除5个棋子' },
  { id: 'specialBonus', icon: '⭐', name: '星星奖励', description: '生成特殊块时额外获得100分' },
];

const BASE_LEVELS = [
  { moves: 15, goals: { score: 3000 }, threeStarScore: 4500, ice: 0 },
  { moves: 20, goals: { collect: { flower: 25 } }, threeStarScore: 5200, ice: 0 },
  { moves: 20, goals: { collect: { bubble: 20 } }, threeStarScore: 5600, ice: 0 },
  { moves: 22, goals: { ice: 8 }, threeStarScore: 6200, ice: 8 },
  { moves: 20, goals: { score: 6000 }, threeStarScore: 8500, ice: 0 },
  { moves: 22, goals: { collect: { star: 18 }, ice: 6 }, threeStarScore: 9000, ice: 6 },
];

const COMBO_MULTIPLIERS = [1, 1.5, 2, 3, 4];

export function scoreMatch(size, combo, perks = []) {
  const base = size >= 5 ? 400 : size === 4 ? 200 : 100;
  const multiplier = COMBO_MULTIPLIERS[Math.min(Math.max(combo, 1), 5) - 1];
  const comboBonus = combo >= 3 && perks.includes('comboBoost') ? 1.2 : 1;
  return Math.round(base * multiplier * comboBonus);
}

function scaledGoals(goals, tier) {
  const factor = 1 + tier * 0.22;
  const result = {};
  if (goals.score) result.score = Math.round(goals.score * factor / 100) * 100;
  if (goals.ice) result.ice = goals.ice + tier * 2;
  if (goals.collect) {
    result.collect = Object.fromEntries(Object.entries(goals.collect).map(([type, amount]) => [type, Math.ceil(amount * factor)]));
  }
  return result;
}

export function getLevel(number, perks = []) {
  const index = (Math.max(number, 1) - 1) % BASE_LEVELS.length;
  const tier = Math.floor((Math.max(number, 1) - 1) / BASE_LEVELS.length);
  const base = BASE_LEVELS[index];
  return {
    number,
    moves: base.moves + (perks.includes('extraMoves') ? 2 : 0),
    goals: scaledGoals(base.goals, tier),
    threeStarScore: Math.round(base.threeStarScore * (1 + tier * 0.2) / 100) * 100,
    ice: base.ice ? base.ice + tier * 2 : 0,
  };
}

export function updateGoals(state, event) {
  state.score += event.score ?? 0;
  state.iceCleared += event.iceCleared ?? 0;
  for (const [type, amount] of Object.entries(event.removed ?? {})) {
    state.collected[type] = (state.collected[type] ?? 0) + amount;
  }
  return state;
}

export function goalsComplete(level, state) {
  if (level.goals.score && state.score < level.goals.score) return false;
  if (level.goals.ice && state.iceCleared < level.goals.ice) return false;
  for (const [type, amount] of Object.entries(level.goals.collect ?? {})) {
    if ((state.collected[type] ?? 0) < amount) return false;
  }
  return true;
}

export function applyIceDamage(ice, cells) {
  let cleared = 0;
  for (const key of cells) {
    const [row, col] = key.split(',').map(Number);
    if ((ice[row]?.[col] ?? 0) > 0) {
      ice[row][col] -= 1;
      if (ice[row][col] === 0) cleared += 1;
    }
  }
  return cleared;
}

export function rateLevel(state, level) {
  let stars = 1;
  if (state.movesLeft >= Math.ceil(level.moves * 0.2)) stars = 2;
  if (state.score >= level.threeStarScore) stars = 3;
  return stars;
}

export function pickPerks(owned = [], random = Math.random) {
  const pool = PERKS.map((perk) => perk.id).filter((id) => !owned.includes(id));
  const choices = [];
  while (pool.length && choices.length < 3) {
    const index = Math.floor(random() * pool.length) % pool.length;
    choices.push(pool.splice(index, 1)[0]);
  }
  return choices;
}

export function createIce(rows, cols, count, random = Math.random) {
  const ice = Array.from({ length: rows }, () => Array(cols).fill(0));
  const available = Array.from({ length: rows * cols }, (_, index) => index);
  for (let placed = 0; placed < count && available.length; placed += 1) {
    const pick = Math.floor(random() * available.length) % available.length;
    const index = available.splice(pick, 1)[0];
    ice[Math.floor(index / cols)][index % cols] = 2;
  }
  return ice;
}
