export const BOARD_SIZE = 8;

export const PIECES = [
  { type: 'flower', symbol: '🌸', name: '粉色花朵', color: '#ff86ad' },
  { type: 'star', symbol: '⭐', name: '黄色星星', color: '#ffd45d' },
  { type: 'bubble', symbol: '🫧', name: '蓝色泡泡', color: '#77ccef' },
  { type: 'clover', symbol: '🍀', name: '绿色四叶草', color: '#7bd19b' },
  { type: 'heart', symbol: '💜', name: '紫色爱心', color: '#b997ef' },
];

export const PIECE_TYPES = PIECES.map((piece) => piece.type);
export const PIECE_BY_TYPE = Object.fromEntries(PIECES.map((piece) => [piece.type, piece]));

export const TIMINGS = {
  swap: 180,
  invalid: 240,
  clear: 220,
  fall: 260,
  combo: 520,
};

export const SPECIALS = {
  ROCKET_ROW: 'rocket-row',
  ROCKET_COL: 'rocket-col',
  BOMB: 'bomb',
  RAINBOW: 'rainbow',
};
