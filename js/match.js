import { SPECIALS } from './config.js';

export function keyOf(position) {
  return `${position.row},${position.col}`;
}

export function positionOf(key) {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

function scanRuns(board) {
  const runs = [];
  const rows = board.length;
  const cols = board[0].length;

  for (let row = 0; row < rows; row += 1) {
    let start = 0;
    while (start < cols) {
      const type = board[row][start]?.type;
      let end = start + 1;
      while (type && end < cols && board[row][end]?.type === type) end += 1;
      if (type && end - start >= 3) {
        runs.push({
          type,
          direction: 'row',
          cells: Array.from({ length: end - start }, (_, index) => ({ row, col: start + index })),
        });
      }
      start = end;
    }
  }

  for (let col = 0; col < cols; col += 1) {
    let start = 0;
    while (start < rows) {
      const type = board[start][col]?.type;
      let end = start + 1;
      while (type && end < rows && board[end][col]?.type === type) end += 1;
      if (type && end - start >= 3) {
        runs.push({
          type,
          direction: 'col',
          cells: Array.from({ length: end - start }, (_, index) => ({ row: start + index, col })),
        });
      }
      start = end;
    }
  }
  return runs;
}

function mergeRuns(runs) {
  const groups = [];
  for (const run of runs) {
    const runKeys = new Set(run.cells.map(keyOf));
    const touching = groups.filter((group) => group.type === run.type && [...runKeys].some((key) => group.cellKeys.has(key)));
    if (touching.length === 0) {
      groups.push({ type: run.type, runs: [run], cellKeys: runKeys });
      continue;
    }
    const target = touching[0];
    target.runs.push(run);
    runKeys.forEach((key) => target.cellKeys.add(key));
    for (const extra of touching.slice(1)) {
      extra.runs.forEach((item) => target.runs.push(item));
      extra.cellKeys.forEach((key) => target.cellKeys.add(key));
      groups.splice(groups.indexOf(extra), 1);
    }
  }
  return groups;
}

function selectSpecial(group, preferredCell, random, perks) {
  const longest = [...group.runs].sort((a, b) => b.cells.length - a.cells.length)[0];
  const directions = new Set(group.runs.map((run) => run.direction));
  let kind = null;
  if (longest.cells.length >= 5) kind = SPECIALS.RAINBOW;
  else if (directions.size > 1) kind = SPECIALS.BOMB;
  else if (longest.cells.length === 4) {
    const blessed = perks?.includes?.('rainbowBlessing') && random() < 0.12;
    kind = blessed ? SPECIALS.RAINBOW : longest.direction === 'row' ? SPECIALS.ROCKET_ROW : SPECIALS.ROCKET_COL;
  }
  if (!kind) return null;

  let position = preferredCell && group.cellKeys.has(keyOf(preferredCell)) ? preferredCell : null;
  if (!position && directions.size > 1) {
    const counts = new Map();
    group.runs.flatMap((run) => run.cells).forEach((cell) => counts.set(keyOf(cell), (counts.get(keyOf(cell)) ?? 0) + 1));
    const intersection = [...counts.entries()].find(([, count]) => count > 1);
    if (intersection) position = positionOf(intersection[0]);
  }
  if (!position) position = longest.cells[Math.floor(longest.cells.length / 2)];
  return { kind, position: { ...position }, type: group.type };
}

export function findMatches(board, preferredCell = null, options = {}) {
  if (!board?.length || !board[0]?.length) return { cells: new Set(), groups: [] };
  const random = options.random ?? Math.random;
  const perks = options.perks ?? [];
  const groups = mergeRuns(scanRuns(board)).map((group) => ({
    type: group.type,
    cells: [...group.cellKeys].map(positionOf),
    runs: group.runs,
    special: selectSpecial(group, preferredCell, random, perks),
  }));
  return {
    cells: new Set(groups.flatMap((group) => group.cells.map(keyOf))),
    groups,
  };
}
