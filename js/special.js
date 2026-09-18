import { keyOf, positionOf } from './match.js';

function addArea(cells, board, center, radius) {
  for (let row = center.row - radius; row <= center.row + radius; row += 1) {
    for (let col = center.col - radius; col <= center.col + radius; col += 1) {
      if (board[row]?.[col]) cells.add(`${row},${col}`);
    }
  }
}

function addRow(cells, board, row) {
  for (let col = 0; col < board[0].length; col += 1) cells.add(`${row},${col}`);
}

function addCol(cells, board, col) {
  for (let row = 0; row < board.length; row += 1) cells.add(`${row},${col}`);
}

export function resolveTriggeredSpecials(board, initialCells, options = {}) {
  const cells = new Set(initialCells);
  const queue = [...cells];
  const triggered = new Set();
  while (queue.length) {
    const key = queue.shift();
    if (triggered.has(key)) continue;
    const position = positionOf(key);
    const piece = board[position.row]?.[position.col];
    if (!piece?.special || piece.special === 'rainbow') continue;
    triggered.add(key);
    const before = new Set(cells);
    if (piece.special === 'rocket-row') addRow(cells, board, position.row);
    if (piece.special === 'rocket-col') addCol(cells, board, position.col);
    if (piece.special === 'bomb') addArea(cells, board, position, options.perks?.includes('bombUpgrade') ? 2 : 1);
    for (const added of cells) if (!before.has(added)) queue.push(added);
  }
  return cells;
}

function isRocket(piece) {
  return piece?.special === 'rocket-row' || piece?.special === 'rocket-col';
}

export function resolveSpecialCombination(board, a, b, options = {}) {
  const first = board[a.row]?.[a.col];
  const second = board[b.row]?.[b.col];
  const cells = new Set([keyOf(a), keyOf(b)]);

  if (first?.special === 'rainbow' || second?.special === 'rainbow') {
    const rainbowPosition = first.special === 'rainbow' ? a : b;
    const target = first.special === 'rainbow' ? second : first;
    const targetType = target.type;
    const candidates = [];
    board.forEach((row, rowIndex) => row.forEach((piece, colIndex) => {
      if (piece?.type === targetType) candidates.push({ row: rowIndex, col: colIndex });
    }));
    if (isRocket(target)) {
      const converted = candidates.slice(0, 8);
      converted.forEach((position, index) => {
        if (index % 2 === 0) addRow(cells, board, position.row);
        else addCol(cells, board, position.col);
      });
      cells.add(keyOf(rainbowPosition));
      return { kind: 'rainbow-rocket', cells, converted };
    }
    candidates.forEach((position) => cells.add(keyOf(position)));
    cells.add(keyOf(rainbowPosition));
    return { kind: 'rainbow-color', cells, converted: [] };
  }

  if (isRocket(first) && isRocket(second)) {
    addRow(cells, board, a.row);
    addCol(cells, board, a.col);
    return { kind: 'rocket-rocket', cells, converted: [] };
  }

  if (first?.special === 'bomb' && second?.special === 'bomb') {
    addArea(cells, board, a, options.perks?.includes('bombUpgrade') ? 3 : 2);
    return { kind: 'bomb-bomb', cells, converted: [] };
  }

  const resolved = resolveTriggeredSpecials(board, cells, options);
  return { kind: 'mixed-special', cells: resolved, converted: [] };
}
