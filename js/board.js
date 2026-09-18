import { BOARD_SIZE, PIECE_TYPES } from './config.js';

let nextId = 1;

export function createPiece(type, special = null) {
  return { id: `piece-${nextId++}`, type, special };
}

export function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

export function areAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function inBounds(board, position) {
  return position.row >= 0 && position.col >= 0 && position.row < board.length && position.col < board[0].length;
}

export function swapCells(board, a, b) {
  if (!inBounds(board, a) || !inBounds(board, b)) return board;
  [board[a.row][a.col], board[b.row][b.col]] = [board[b.row][b.col], board[a.row][a.col]];
  return board;
}

function randomType(random) {
  return PIECE_TYPES[Math.floor(random() * PIECE_TYPES.length) % PIECE_TYPES.length];
}

function typeAt(board, row, col) {
  return board[row]?.[col]?.type ?? null;
}

export function createsMatchAt(board, row, col) {
  const type = typeAt(board, row, col);
  if (!type || type === 'rainbow') return false;

  let horizontal = 1;
  for (let c = col - 1; c >= 0 && typeAt(board, row, c) === type; c -= 1) horizontal += 1;
  for (let c = col + 1; c < board[0].length && typeAt(board, row, c) === type; c += 1) horizontal += 1;

  let vertical = 1;
  for (let r = row - 1; r >= 0 && typeAt(board, r, col) === type; r -= 1) vertical += 1;
  for (let r = row + 1; r < board.length && typeAt(board, r, col) === type; r += 1) vertical += 1;

  return horizontal >= 3 || vertical >= 3;
}

export function createsAnyMatch(board) {
  return board.some((row, rowIndex) => row.some((_, colIndex) => createsMatchAt(board, rowIndex, colIndex)));
}

export function findLegalMoves(board) {
  const moves = [];
  const directions = [[0, 1], [1, 0]];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[0].length; col += 1) {
      for (const [dr, dc] of directions) {
        const other = { row: row + dr, col: col + dc };
        if (!inBounds(board, other)) continue;
        const current = { row, col };
        const a = board[row][col];
        const b = board[other.row][other.col];
        if (a?.special === 'rainbow' || b?.special === 'rainbow') {
          moves.push([current, other]);
          continue;
        }
        swapCells(board, current, other);
        const valid = createsMatchAt(board, current.row, current.col) || createsMatchAt(board, other.row, other.col);
        swapCells(board, current, other);
        if (valid) moves.push([current, other]);
      }
    }
  }
  return moves;
}

export function hasLegalMove(board) {
  return findLegalMoves(board).length > 0;
}

export function createBoard(rows = BOARD_SIZE, cols = BOARD_SIZE, random = Math.random) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const board = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        let type;
        do {
          type = randomType(random);
        } while (
          (col >= 2 && board[row][col - 1]?.type === type && board[row][col - 2]?.type === type)
          || (row >= 2 && board[row - 1][col]?.type === type && board[row - 2][col]?.type === type)
        );
        board[row][col] = createPiece(type);
      }
    }
    if (hasLegalMove(board)) return board;
  }
  throw new Error('无法生成含有合法移动的棋盘');
}

export function collapseBoard(board, random = Math.random) {
  const rows = board.length;
  const cols = board[0].length;
  for (let col = 0; col < cols; col += 1) {
    const survivors = [];
    for (let row = rows - 1; row >= 0; row -= 1) {
      if (board[row][col]) survivors.push(board[row][col]);
    }
    let survivorIndex = 0;
    for (let row = rows - 1; row >= 0; row -= 1) {
      board[row][col] = survivorIndex < survivors.length
        ? survivors[survivorIndex++]
        : createPiece(randomType(random));
    }
  }
  return board;
}

export function reshuffleBoard(board, random = Math.random) {
  const rows = board.length;
  const cols = board[0].length;
  const specials = board.flat().filter((piece) => piece?.special);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const fresh = createBoard(rows, cols, random);
    specials.forEach((piece, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      fresh[row][col] = { ...piece, id: createPiece(piece.type).id };
    });
    if (!createsAnyMatch(fresh) && hasLegalMove(fresh)) return fresh;
  }
  return createBoard(rows, cols, random);
}
