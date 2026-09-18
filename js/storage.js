import { createsAnyMatch, hasLegalMove } from './board.js';
import { PIECE_TYPES } from './config.js';

export const SAVE_KEY = 'star-match-house-save-v1';

export const DEFAULT_SAVE = Object.freeze({
  version: 1,
  level: 1,
  highestLevel: 1,
  highScore: 0,
  tutorialSeen: false,
  perks: [],
  pendingPerk: false,
  currentRun: null,
  settings: {
    music: true,
    sound: true,
    vibration: true,
  },
});

function freshDefault() {
  return {
    ...DEFAULT_SAVE,
    perks: [],
    currentRun: null,
    settings: { ...DEFAULT_SAVE.settings },
  };
}

function validSave(value) {
  return value
    && value.version === 1
    && Number.isInteger(value.level)
    && value.level >= 1
    && Array.isArray(value.perks)
    && value.settings
    && typeof value.settings.music === 'boolean'
    && typeof value.settings.sound === 'boolean'
    && typeof value.settings.vibration === 'boolean';
}

function validMatrix(matrix, cellValidator) {
  return Array.isArray(matrix)
    && matrix.length === 8
    && matrix.every((row) => Array.isArray(row) && row.length === 8 && row.every(cellValidator));
}

function validCurrentRun(run) {
  if (run === null) return true;
  if (!run || !Number.isInteger(run.level) || run.level < 1 || !Array.isArray(run.perks)) return false;
  const normalTypes = new Set(PIECE_TYPES);
  const specialTypes = new Set(['rocket-row', 'rocket-col', 'bomb', 'rainbow']);
  const validPiece = (piece) => {
    if (!piece || typeof piece.id !== 'string') return false;
    const special = piece.special ?? null;
    if (special !== null && !specialTypes.has(special)) return false;
    if (special === 'rainbow') return piece.type === 'rainbow';
    return normalTypes.has(piece.type);
  };
  const validIce = (layers) => Number.isInteger(layers) && layers >= 0 && layers <= 2;
  const progress = run.progress;
  return validMatrix(run.board, validPiece)
    && validMatrix(run.ice, validIce)
    && !createsAnyMatch(run.board)
    && hasLegalMove(run.board)
    && progress
    && Number.isFinite(progress.score)
    && Number.isInteger(progress.movesLeft)
    && Number.isFinite(progress.iceCleared)
    && progress.collected
    && typeof progress.collected === 'object';
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return freshDefault();
    const parsed = JSON.parse(raw);
    if (!validSave(parsed) || !validCurrentRun(parsed.currentRun ?? null)) {
      storage?.removeItem(SAVE_KEY);
      return freshDefault();
    }
    return {
      ...freshDefault(),
      ...parsed,
      perks: [...parsed.perks],
      settings: { ...DEFAULT_SAVE.settings, ...parsed.settings },
    };
  } catch {
    try { storage?.removeItem(SAVE_KEY); } catch {}
    return freshDefault();
  }
}

export function writeSave(storage = globalThis.localStorage, state) {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify({ ...state, version: 1 }));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress(storage = globalThis.localStorage) {
  const previous = loadSave(storage);
  const next = freshDefault();
  next.settings = { ...previous.settings };
  next.tutorialSeen = previous.tutorialSeen;
  writeSave(storage, next);
  return next;
}
