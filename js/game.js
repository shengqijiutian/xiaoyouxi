import {
  areAdjacent,
  collapseBoard,
  createBoard,
  createPiece,
  createsMatchAt,
  findLegalMoves,
  hasLegalMove,
  inBounds,
  reshuffleBoard,
  swapCells,
} from './board.js';
import { TIMINGS } from './config.js';
import { applyIceDamage, createIce, getLevel, goalsComplete, scoreMatch, updateGoals } from './level.js';
import { findMatches, keyOf } from './match.js';
import { resolveSpecialCombination, resolveTriggeredSpecials } from './special.js';
import { DEFAULT_SAVE, loadSave, writeSave } from './storage.js';

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function shouldShowComboEgg(combo, shown, random = Math.random) {
  return !shown && combo >= 4 && random() < 0.4;
}

export function shouldShowScoreEgg(score, shown) {
  return !shown && score >= 9999;
}

function emptyProgress(moves) {
  return { score: 0, collected: {}, iceCleared: 0, movesLeft: moves, bestCombo: 0 };
}

function countRemoved(board, cells) {
  const removed = {};
  for (const key of cells) {
    const [row, col] = key.split(',').map(Number);
    const type = board[row]?.[col]?.type;
    if (type && type !== 'rainbow') removed[type] = (removed[type] ?? 0) + 1;
  }
  return removed;
}

export class GameController {
  constructor(options = {}) {
    this.ui = options.ui ?? {};
    this.audio = options.audio ?? {};
    this.random = options.random ?? Math.random;
    this.sleep = options.sleep ?? delay;
    this.storage = options.storage === undefined ? globalThis.localStorage : options.storage;
    this.save = loadSave(this.storage);
    this.perks = [...this.save.perks];
    this.level = getLevel(this.save.level, this.perks);
    this.board = [];
    this.ice = [];
    this.progress = emptyProgress(this.level.moves);
    this.phase = 'home';
    this.selected = null;
    this.hints = [];
    this.comboEggShown = false;
    this.scoreEggShown = false;
    this.hintTimer = null;
    this.onWin = options.onWin ?? (() => {});
    this.onLose = options.onLose ?? (() => {});
    this.ui.setHomeRecord?.(this.save);
  }

  startLevel(number = 1, resume = null) {
    this.perks = [...(resume?.perks ?? this.perks)];
    this.level = getLevel(number, this.perks);
    this.board = resume?.board?.length ? resume.board.map((row) => row.map((piece) => (piece ? { ...piece } : null))) : createBoard(8, 8, this.random);
    this.ice = resume?.ice?.length ? resume.ice.map((row) => [...row]) : createIce(8, 8, this.level.ice, this.random);
    this.progress = resume?.progress ? {
      ...resume.progress,
      collected: { ...(resume.progress.collected ?? {}) },
    } : emptyProgress(this.level.moves);
    this.comboEggShown = Boolean(resume?.comboEggShown);
    this.scoreEggShown = Boolean(resume?.scoreEggShown);
    this.selected = null;
    this.hints = [];
    if (!resume) this.applyOpeningPerks();
    this.phase = 'idle';
    this.ui.renderPerks?.(this.perks);
    this.render();
    this.persist();
    this.resetHintTimer();
  }

  applyOpeningPerks() {
    if (this.perks.includes('luckyStart')) {
      const picks = new Set();
      while (picks.size < 5) {
        picks.add(`${Math.floor(this.random() * 8)},${Math.floor(this.random() * 8)}`);
      }
      for (const key of picks) {
        const [row, col] = key.split(',').map(Number);
        this.board[row][col] = null;
      }
      collapseBoard(this.board, this.random);
      for (let pass = 0; pass < 30; pass += 1) {
        const openingMatches = findMatches(this.board);
        if (openingMatches.cells.size === 0) break;
        for (const key of openingMatches.cells) {
          const [row, col] = key.split(',').map(Number);
          this.board[row][col] = null;
        }
        collapseBoard(this.board, this.random);
      }
      if (!hasLegalMove(this.board)) this.board = reshuffleBoard(this.board, this.random);
    }
    if (this.perks.includes('luckyStar')) {
      const row = Math.floor(this.random() * this.board.length);
      const col = Math.floor(this.random() * this.board[0].length);
      const specials = ['rocket-row', 'rocket-col', 'bomb'];
      this.board[row][col].special = specials[Math.floor(this.random() * specials.length)];
    }
  }

  resumeSavedRun() {
    if (!this.save.currentRun) return false;
    this.startLevel(this.save.currentRun.level, this.save.currentRun);
    return true;
  }

  render(options = {}) {
    this.ui.renderHud?.(this.level, this.progress);
    this.ui.renderBoard?.(this.board, this.ice, {
      selected: this.selected,
      hints: this.hints,
      disabled: this.phase !== 'idle',
      ...options,
    });
  }

  handleTap(position) {
    if (this.phase !== 'idle') return;
    this.clearHint();
    if (!this.selected) {
      this.selected = position;
      this.audio.play?.('click');
      this.render();
      return;
    }
    if (this.selected.row === position.row && this.selected.col === position.col) {
      this.selected = null;
      this.render();
      return;
    }
    if (areAdjacent(this.selected, position)) {
      const from = this.selected;
      this.selected = null;
      this.trySwap(from, position);
      return;
    }
    this.selected = position;
    this.render();
  }

  async trySwap(a, b) {
    if (this.phase !== 'idle' || !areAdjacent(a, b) || !inBounds(this.board, a) || !inBounds(this.board, b)) return false;
    this.clearHint();
    this.phase = 'swapping';
    this.render();
    const originalA = this.board[a.row][a.col];
    const originalB = this.board[b.row][b.col];
    swapCells(this.board, a, b);
    this.render({ disabled: true, swap: { from: a, to: b, returning: false } });
    this.audio.play?.('swap');
    await this.sleep(TIMINGS.swap);

    const specialSwap = originalA?.special === 'rainbow'
      || originalB?.special === 'rainbow'
      || (originalA?.special && originalB?.special);
    const matches = findMatches(this.board, b, { random: this.random, perks: this.perks });
    const swapCreatedMatch = createsMatchAt(this.board, a.row, a.col) || createsMatchAt(this.board, b.row, b.col);
    if (!specialSwap && !swapCreatedMatch) {
      swapCells(this.board, a, b);
      this.audio.play?.('invalid');
      this.render({ disabled: true, swap: { from: a, to: b, returning: true } });
      await this.sleep(TIMINGS.invalid);
      this.phase = 'idle';
      this.render();
      this.resetHintTimer();
      return false;
    }

    this.progress.movesLeft -= 1;
    this.phase = 'resolving';
    if (specialSwap) {
      const combination = resolveSpecialCombination(this.board, a, b, { perks: this.perks });
      await this.resolveCycles({ initialCells: combination.cells, initialMatches: null });
    } else {
      await this.resolveCycles({ initialCells: null, initialMatches: matches, preferredCell: b });
    }
    return true;
  }

  async resolveCycles({ initialCells = null, initialMatches = null, preferredCell = null }) {
    let combo = 1;
    let cells = initialCells;
    let matches = initialMatches;
    while (combo <= 30 && (cells?.size || matches?.cells.size)) {
      const specialPlacements = matches
        ? matches.groups.filter((group) => group.special).map((group) => ({ ...group.special, matchSize: group.cells.length }))
        : [];
      const rawCells = new Set(cells ?? matches.cells);
      const preserved = new Set(specialPlacements
        .filter((item) => !this.board[item.position.row]?.[item.position.col]?.special)
        .map((item) => keyOf(item.position)));
      const clearSeed = new Set([...rawCells].filter((key) => !preserved.has(key)));
      const clearCells = resolveTriggeredSpecials(this.board, clearSeed, { perks: this.perks });
      const damageCells = new Set([...clearCells, ...rawCells]);
      const removed = countRemoved(this.board, clearCells);
      const iceCleared = applyIceDamage(this.ice, damageCells);
      let points = 0;
      if (matches) {
        points = matches.groups.reduce((sum, group) => sum + scoreMatch(group.cells.length, combo, this.perks), 0);
      } else {
        points = scoreMatch(Math.max(3, Math.min(5, clearCells.size)), combo, this.perks);
      }
      if (this.perks.includes('specialBonus')) points += specialPlacements.length * 100;
      updateGoals(this.progress, { score: points, removed, iceCleared });
      this.progress.bestCombo = Math.max(this.progress.bestCombo, combo);

      this.ui.showCombo?.(combo);
      this.ui.renderHud?.(this.level, this.progress);
      this.render({ clearing: clearCells, disabled: true });
      const usedSpecial = [...clearCells].some((key) => {
        const [row, col] = key.split(',').map(Number);
        return Boolean(this.board[row]?.[col]?.special);
      });
      this.audio.play?.(usedSpecial ? 'special' : combo >= 2 ? 'combo' : 'clear', combo);
      this.audio.vibrate?.(usedSpecial ? 20 : combo >= 3 ? 30 : 10);
      this.checkEasterEggs(combo);
      await this.sleep(TIMINGS.clear);

      for (const key of clearCells) {
        const [row, col] = key.split(',').map(Number);
        this.board[row][col] = null;
      }
      for (const placement of specialPlacements) {
        const pieceType = placement.kind === 'rainbow' ? 'rainbow' : placement.type;
        this.board[placement.position.row][placement.position.col] = createPiece(pieceType, placement.kind);
      }
      collapseBoard(this.board, this.random);
      this.render({ disabled: true });
      await this.sleep(TIMINGS.fall);
      combo += 1;
      preferredCell = null;
      matches = findMatches(this.board, preferredCell, { random: this.random, perks: this.perks });
      cells = null;
    }

    if (!hasLegalMove(this.board)) {
      this.ui.showToast?.('没有可以移动的啦～重新整理一下 ✨', 2200);
      this.audio.play?.('shuffle');
      await this.sleep(350);
      this.board = reshuffleBoard(this.board, this.random);
    }
    this.finishTurn();
  }

  checkEasterEggs(combo) {
    if (shouldShowComboEgg(combo, this.comboEggShown, this.random)) {
      this.comboEggShown = true;
      this.ui.showEaster?.('今天也很厉害呀，姐姐 ✨');
    }
    if (shouldShowScoreEgg(this.progress.score, this.scoreEggShown)) {
      this.scoreEggShown = true;
      this.ui.showEaster?.('偷偷给你加一颗小心心 ♡', true);
    }
  }

  finishTurn() {
    this.render();
    if (goalsComplete(this.level, this.progress)) {
      this.phase = 'won';
      this.clearHint();
      this.audio.play?.('win');
      this.audio.vibrate?.(30);
      this.ui.burst?.(24);
      this.save.highScore = Math.max(this.save.highScore, this.progress.score);
      this.save.highestLevel = Math.max(this.save.highestLevel, this.level.number + 1);
      this.save.level = this.level.number + 1;
      this.save.pendingPerk = this.level.number % 3 === 0 && this.perks.length < 7;
      this.save.currentRun = null;
      writeSave(this.storage, this.save);
      this.onWin(this);
      return;
    }
    if (this.progress.movesLeft <= 0) {
      this.phase = 'lost';
      this.clearHint();
      this.audio.play?.('lose');
      this.save.currentRun = null;
      writeSave(this.storage, this.save);
      this.onLose(this);
      return;
    }
    this.phase = 'idle';
    this.render();
    this.persist();
    this.resetHintTimer();
  }

  persist() {
    this.save.level = this.level.number;
    this.save.highestLevel = Math.max(this.save.highestLevel, this.level.number);
    this.save.highScore = Math.max(this.save.highScore, this.progress.score);
    this.save.perks = [...this.perks];
    this.save.currentRun = {
      level: this.level.number,
      board: this.board,
      ice: this.ice,
      progress: this.progress,
      perks: this.perks,
      comboEggShown: this.comboEggShown,
      scoreEggShown: this.scoreEggShown,
    };
    writeSave(this.storage, this.save);
    this.ui.setHomeRecord?.(this.save);
  }

  clearHint() {
    clearTimeout(this.hintTimer);
    this.hints = [];
  }

  resetHintTimer() {
    this.clearHint();
    if (this.phase !== 'idle') return;
    this.hintTimer = setTimeout(() => {
      const moves = findLegalMoves(this.board);
      if (this.phase === 'idle' && moves.length) {
        this.hints = moves[0];
        this.render();
      }
    }, 8000);
    this.hintTimer.unref?.();
  }
}

export { DEFAULT_SAVE };
