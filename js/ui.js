import { PERKS } from './level.js';
import { PIECE_BY_TYPE } from './config.js';

export function comboLabel(combo) {
  if (combo >= 6) return `Super Combo! ×${combo}`;
  if (combo >= 5) return `Amazing! ×${combo}`;
  if (combo >= 4) return `Great! ×${combo}`;
  return `Combo ×${combo}`;
}

export function swapVector(from, to) {
  return { row: to.row - from.row, col: to.col - from.col };
}

export function formatGoal(level, state) {
  const parts = [];
  if (level.goals.score) parts.push(`分数 ${Math.min(state.score, level.goals.score)}/${level.goals.score}`);
  for (const [type, amount] of Object.entries(level.goals.collect ?? {})) {
    parts.push(`${PIECE_BY_TYPE[type]?.symbol ?? ''} ${Math.min(state.collected[type] ?? 0, amount)}/${amount}`);
  }
  if (level.goals.ice) parts.push(`冰块 ${Math.min(state.iceCleared, level.goals.ice)}/${level.goals.ice}`);
  return parts.join(' · ');
}

function specialSymbol(special) {
  if (special === 'rocket-row') return '↔';
  if (special === 'rocket-col') return '↕';
  if (special === 'bomb') return '✹';
  if (special === 'rainbow') return '✦';
  return '';
}

function pieceLabel(piece) {
  if (!piece) return '空格';
  const base = PIECE_BY_TYPE[piece.type]?.name ?? '彩虹星';
  const suffix = {
    'rocket-row': '横向火箭',
    'rocket-col': '纵向火箭',
    bomb: '范围炸弹',
    rainbow: '彩虹星',
  }[piece.special];
  return suffix ? `${base}，${suffix}` : base;
}

export function createUI(root = document) {
  const elements = {
    home: root.getElementById('home-screen'),
    game: root.getElementById('game-screen'),
    board: root.getElementById('board'),
    modal: root.getElementById('modal-root'),
    toast: root.getElementById('toast'),
    easter: root.getElementById('easter-message'),
    particles: root.getElementById('particle-layer'),
    combo: root.getElementById('combo-banner'),
    level: root.getElementById('level-value'),
    goal: root.getElementById('goal-text'),
    score: root.getElementById('score-value'),
    moves: root.getElementById('moves-value'),
    bestCombo: root.getElementById('best-combo-value'),
    perks: root.getElementById('perk-strip'),
    record: root.getElementById('home-record'),
    continueButton: root.getElementById('continue-button'),
  };

  let toastTimer;
  let easterTimer;

  function showScreen(name) {
    elements.home.classList.toggle('is-active', name === 'home');
    elements.game.classList.toggle('is-active', name === 'game');
  }

  function renderBoard(board, ice, options = {}) {
    const fragment = root.createDocumentFragment();
    board.forEach((row, rowIndex) => row.forEach((piece, colIndex) => {
      const tile = root.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.dataset.row = rowIndex;
      tile.dataset.col = colIndex;
      tile.setAttribute('role', 'gridcell');
      tile.setAttribute('aria-label', pieceLabel(piece));
      if (piece) tile.dataset.type = piece.type;
      if (piece?.special) tile.dataset.special = piece.special;
      if (options.selected?.row === rowIndex && options.selected?.col === colIndex) tile.classList.add('is-selected');
      if (options.hints?.some((hint) => hint.row === rowIndex && hint.col === colIndex)) tile.classList.add('is-hint');
      if (options.clearing?.has(`${rowIndex},${colIndex}`)) tile.classList.add('is-clearing');
      if (options.swap) {
        const vector = swapVector(options.swap.from, options.swap.to);
        const isSource = options.swap.from.row === rowIndex && options.swap.from.col === colIndex;
        const isTarget = options.swap.to.row === rowIndex && options.swap.to.col === colIndex;
        if (isSource || isTarget) {
          const direction = isSource ? 1 : -1;
          tile.classList.add(isSource ? 'is-swap-source' : 'is-swap-target');
          if (options.swap.returning) tile.classList.add('is-swap-returning');
          tile.style.setProperty('--swap-row', String(vector.row * direction));
          tile.style.setProperty('--swap-col', String(vector.col * direction));
        }
      }
      tile.disabled = Boolean(options.disabled);

      const face = root.createElement('span');
      face.className = 'piece-face';
      face.textContent = piece?.special === 'rainbow' ? '🌈' : PIECE_BY_TYPE[piece?.type]?.symbol ?? '';
      tile.append(face);
      if (piece?.special && piece.special !== 'rainbow') {
        const badge = root.createElement('span');
        badge.className = 'special-mark';
        badge.textContent = specialSymbol(piece.special);
        tile.append(badge);
      }
      const layers = ice?.[rowIndex]?.[colIndex] ?? 0;
      if (layers) {
        const frost = root.createElement('span');
        frost.className = `ice-layer ice-${layers}`;
        frost.setAttribute('aria-hidden', 'true');
        tile.append(frost);
      }
      fragment.append(tile);
    }));
    elements.board.replaceChildren(fragment);
    elements.board.classList.toggle('is-locked', Boolean(options.disabled));
  }

  function renderHud(level, state) {
    elements.level.textContent = level.number;
    elements.goal.textContent = formatGoal(level, state);
    elements.score.textContent = state.score.toLocaleString('zh-CN');
    elements.moves.textContent = state.movesLeft;
    elements.moves.parentElement.classList.toggle('is-low', state.movesLeft <= 5);
    elements.bestCombo.textContent = `×${state.bestCombo}`;
  }

  function renderPerks(owned) {
    elements.perks.replaceChildren();
    for (const id of owned) {
      const perk = PERKS.find((item) => item.id === id);
      if (!perk) continue;
      const item = root.createElement('span');
      item.className = 'perk-pill';
      item.title = `${perk.name}：${perk.description}`;
      item.textContent = `${perk.icon} ${perk.name}`;
      elements.perks.append(item);
    }
  }

  function showToast(message, duration = 1800) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), duration);
  }

  function showCombo(combo) {
    elements.combo.textContent = comboLabel(combo);
    elements.combo.classList.remove('is-showing');
    void elements.combo.offsetWidth;
    elements.combo.classList.add('is-showing');
  }

  function showEaster(message, withHeart = false) {
    clearTimeout(easterTimer);
    elements.easter.textContent = message;
    elements.easter.classList.toggle('with-heart', withHeart);
    elements.easter.classList.add('is-visible');
    if (withHeart) burst(14, true);
    easterTimer = setTimeout(() => elements.easter.classList.remove('is-visible'), 2200);
  }

  function burst(count = 18, heart = false) {
    for (let index = 0; index < count; index += 1) {
      const particle = root.createElement('span');
      particle.className = 'particle';
      particle.textContent = heart && index === count - 1 ? '♥' : index % 3 === 0 ? '✦' : '·';
      particle.style.setProperty('--angle', `${(360 / count) * index}deg`);
      particle.style.setProperty('--distance', `${55 + (index % 4) * 16}px`);
      elements.particles.append(particle);
      setTimeout(() => particle.remove(), 1000);
    }
  }

  function showModal({ eyebrow = '', title, message = '', content = null, actions = [], closable = false, onClose = null }) {
    const backdrop = root.createElement('div');
    backdrop.className = 'modal-backdrop is-visible';
    const card = root.createElement('section');
    card.className = 'modal-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    if (eyebrow) {
      const small = root.createElement('p');
      small.className = 'modal-eyebrow';
      small.textContent = eyebrow;
      card.append(small);
    }
    const heading = root.createElement('h2');
    heading.textContent = title;
    card.append(heading);
    if (message) {
      const copy = root.createElement('p');
      copy.className = 'modal-copy';
      copy.textContent = message;
      card.append(copy);
    }
    if (content) card.append(content);
    const actionRow = root.createElement('div');
    actionRow.className = 'modal-actions';
    actions.forEach((action, index) => {
      const button = root.createElement('button');
      button.type = 'button';
      button.className = `button ${action.kind === 'ghost' ? 'button-ghost' : index === 0 ? 'button-primary' : 'button-secondary'}`;
      button.textContent = action.label;
      button.addEventListener('click', () => action.onClick?.());
      actionRow.append(button);
    });
    card.append(actionRow);
    backdrop.append(card);
    elements.modal.replaceChildren(backdrop);
    if (closable) backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        closeModal();
        onClose?.();
      }
    });
    setTimeout(() => actionRow.querySelector('button')?.focus(), 0);
    return { backdrop, card, actionRow };
  }

  function closeModal() {
    elements.modal.replaceChildren();
  }

  function setHomeRecord(save) {
    elements.record.textContent = `最高记录 · 第 ${save.highestLevel} 关 · ${save.highScore.toLocaleString('zh-CN')} 分`;
    elements.continueButton.hidden = !(save.currentRun || save.level > 1 || save.pendingPerk);
  }

  return {
    elements,
    showScreen,
    renderBoard,
    renderHud,
    renderPerks,
    showToast,
    showCombo,
    showEaster,
    burst,
    showModal,
    closeModal,
    setHomeRecord,
  };
}
