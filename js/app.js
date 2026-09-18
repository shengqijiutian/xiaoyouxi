import { AudioSystem } from './audio.js';
import { GameController } from './game.js';
import { bindBoardInput } from './input.js';
import { PERKS, pickPerks, rateLevel } from './level.js';
import { writeSave } from './storage.js';
import { createUI } from './ui.js';

const ui = createUI(document);
const audio = new AudioSystem();
const controller = new GameController({
  ui,
  audio,
  onWin: () => setTimeout(showWin, 620),
  onLose: () => setTimeout(showLose, 220),
});
audio.updateSettings(controller.save.settings);
ui.setHomeRecord(controller.save);

bindBoardInput(ui.elements.board, {
  isLocked: () => controller.phase !== 'idle',
  onTap: (position) => controller.handleTap(position),
  onSwap: (from, to) => controller.trySwap(from, to),
});

document.addEventListener('pointerdown', () => {
  audio.unlock();
  if (controller.save.settings.music) audio.startMusic();
}, { once: true });

function commitSettings() {
  controller.save.settings = { ...audio.settings };
  writeSave(controller.storage, controller.save);
}

function showHome() {
  controller.clearHint();
  controller.phase = 'home';
  ui.closeModal();
  ui.showScreen('home');
  ui.setHomeRecord(controller.save);
  audio.startMusic();
}

function resetRun() {
  controller.perks = [];
  controller.save.perks = [];
  controller.save.level = 1;
  controller.save.currentRun = null;
  controller.save.pendingPerk = false;
  controller.comboEggShown = false;
  controller.scoreEggShown = false;
  writeSave(controller.storage, controller.save);
}

function startFreshGame() {
  resetRun();
  ui.showScreen('game');
  if (!controller.save.tutorialSeen) showTutorial(0);
  else showLevelIntro(1);
}

const tutorialPages = [
  { icon: ['🌸', '⭐', '🌸'], title: '交换相邻的小图案～', copy: '手指滑动最顺手，也可以依次点两个相邻棋子。' },
  { icon: ['🫧', '🫧', '🫧'], title: '三个一样就会消除', copy: '连锁越多，分数越高，手感也会越来越爽！' },
  { icon: ['⭐', '⭐', '🌈'], title: '四个、五个有惊喜', copy: '火箭、炸弹和彩虹星，会帮你一下清掉好多棋子。' },
];

function tutorialArt(symbols) {
  const art = document.createElement('div');
  art.className = 'tutorial-art';
  symbols.forEach((symbol) => {
    const item = document.createElement('span');
    item.textContent = symbol;
    art.append(item);
  });
  return art;
}

function showTutorial(index) {
  const page = tutorialPages[index];
  ui.showModal({
    eyebrow: `小小教程 · ${index + 1}/3`,
    title: page.title,
    message: page.copy,
    content: tutorialArt(page.icon),
    actions: [{
      label: index === tutorialPages.length - 1 ? '开始游戏 ✨' : '下一步',
      onClick: () => {
        if (index < tutorialPages.length - 1) showTutorial(index + 1);
        else {
          controller.save.tutorialSeen = true;
          writeSave(controller.storage, controller.save);
          showLevelIntro(1);
        }
      },
    }],
  });
}

function levelDescription(level) {
  const parts = [];
  if (level.goals.score) parts.push(`获得 ${level.goals.score} 分`);
  for (const [type, amount] of Object.entries(level.goals.collect ?? {})) {
    const icons = { flower: '🌸', star: '⭐', bubble: '🫧', clover: '🍀', heart: '💜' };
    parts.push(`消除 ${icons[type]} × ${amount}`);
  }
  if (level.goals.ice) parts.push(`清除 ${level.goals.ice} 个冰块`);
  return parts.join('\n');
}

function showLevelIntro(number) {
  controller.save.pendingPerk = false;
  controller.startLevel(number);
  const level = controller.level;
  controller.phase = 'intro';
  controller.render();
  ui.showModal({
    eyebrow: 'NEW CHAPTER',
    title: `第 ${number} 关`,
    message: `${levelDescription(level)}\n步数：${level.moves}`,
    actions: [{
      label: '出发吧',
      onClick: () => {
        ui.closeModal();
        controller.phase = 'idle';
        controller.render();
        controller.resetHintTimer();
        audio.startMusic();
      },
    }],
  });
}

function continueGame() {
  ui.showScreen('game');
  if (controller.save.pendingPerk) {
    showPerkChoice(controller.save.level);
    return;
  }
  if (controller.resumeSavedRun()) {
    ui.closeModal();
    audio.startMusic();
  } else {
    showLevelIntro(controller.save.level || 1);
  }
}

function resultContent(stars) {
  const wrapper = document.createElement('div');
  const rating = document.createElement('div');
  rating.className = 'star-rating';
  rating.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  wrapper.append(rating);
  const grid = document.createElement('div');
  grid.className = 'result-grid';
  [
    ['得分', controller.progress.score.toLocaleString('zh-CN')],
    ['最高Combo', `×${controller.progress.bestCombo}`],
    ['剩余步数', controller.progress.movesLeft],
  ].forEach(([label, value]) => {
    const item = document.createElement('div');
    const small = document.createElement('span');
    const strong = document.createElement('strong');
    small.textContent = label;
    strong.textContent = value;
    item.append(small, strong);
    grid.append(item);
  });
  wrapper.append(grid);
  return wrapper;
}

function advanceAfterWin() {
  const completed = controller.level.number;
  if (completed % 3 === 0 && controller.perks.length < PERKS.length) showPerkChoice(completed + 1);
  else showLevelIntro(completed + 1);
}

function showWin() {
  const stars = rateLevel(controller.progress, controller.level);
  ui.showModal({
    eyebrow: 'LEVEL CLEAR',
    title: '完成啦 ✨',
    message: '星星已经帮你把这一关好好收起来了。',
    content: resultContent(stars),
    actions: [
      { label: '下一关', onClick: advanceAfterWin },
      { label: '返回首页', kind: 'ghost', onClick: showHome },
    ],
  });
}

function showLose() {
  ui.showModal({
    eyebrow: 'SO CLOSE',
    title: '差一点点～',
    message: '再试一次吧，这次一定可以。',
    actions: [
      { label: '重新挑战', onClick: () => showLevelIntro(controller.level.number) },
      { label: '返回首页', kind: 'ghost', onClick: showHome },
    ],
  });
}

function showPerkChoice(nextLevel) {
  const choices = pickPerks(controller.perks, controller.random);
  if (!choices.length) {
    showLevelIntro(nextLevel);
    return;
  }
  const container = document.createElement('div');
  container.className = 'perk-choices';
  choices.forEach((id) => {
    const perk = PERKS.find((item) => item.id === id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'perk-card';
    const icon = document.createElement('span');
    icon.className = 'perk-icon';
    icon.textContent = perk.icon;
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    const description = document.createElement('small');
    name.textContent = perk.name;
    description.textContent = perk.description;
    copy.append(name, description);
    card.append(icon, copy);
    card.addEventListener('click', () => {
      audio.play('special');
      controller.perks.push(id);
      controller.save.perks = [...controller.perks];
      controller.save.pendingPerk = false;
      writeSave(controller.storage, controller.save);
      showLevelIntro(nextLevel);
    });
    container.append(card);
  });
  ui.showModal({
    eyebrow: 'A LITTLE GIFT',
    title: '选一个小小祝福',
    message: '它会陪你走完这一轮旅程。',
    content: container,
  });
}

function createSwitch(label, key) {
  const row = document.createElement('div');
  row.className = 'setting-row';
  const text = document.createElement('span');
  text.textContent = label;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'switch';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(audio.settings[key]));
  toggle.setAttribute('aria-label', label);
  toggle.addEventListener('click', () => {
    const next = !audio.settings[key];
    audio.updateSettings({ [key]: next });
    toggle.setAttribute('aria-checked', String(next));
    commitSettings();
    if (key === 'sound' && next) audio.play('click');
  });
  row.append(text, toggle);
  return row;
}

function showSettings(returnToPause = false) {
  const list = document.createElement('div');
  list.className = 'settings-list';
  list.append(
    createSwitch('背景音乐', 'music'),
    createSwitch('游戏音效', 'sound'),
    createSwitch('轻微震动', 'vibration'),
  );
  ui.showModal({
    eyebrow: 'SETTINGS',
    title: '游戏设置',
    message: '调成你觉得最舒服的样子。',
    content: list,
    closable: true,
    onClose: returnToPause ? showPause : null,
    actions: [{
      label: '完成',
      onClick: () => {
        ui.closeModal();
        if (returnToPause) showPause();
      },
    }],
  });
}

function showPause() {
  if (!['idle', 'paused'].includes(controller.phase)) return;
  controller.phase = 'paused';
  controller.clearHint();
  controller.render();
  audio.stopMusic();
  ui.showModal({
    eyebrow: 'TAKE A BREATH',
    title: '暂停一下',
    message: '小星星会在这里等你。',
    actions: [
      { label: '继续游戏', onClick: () => {
        ui.closeModal();
        controller.phase = 'idle';
        controller.render();
        controller.resetHintTimer();
        audio.startMusic();
      } },
      { label: '重新开始', onClick: () => showLevelIntro(controller.level.number) },
      { label: '声音设置', onClick: () => showSettings(true) },
      { label: '返回首页', kind: 'ghost', onClick: showHome },
    ],
  });
}

function showSecret() {
  ui.showModal({
    title: '被你发现啦。',
    message: '这个小游戏有一点点，\n是专门为姐姐做的。\n\n♡',
    closable: true,
    actions: [{ label: '收下小心心', onClick: () => ui.closeModal() }],
  });
}

let secretClicks = 0;
let secretTimer;
document.getElementById('secret-star').addEventListener('click', () => {
  secretClicks += 1;
  clearTimeout(secretTimer);
  secretTimer = setTimeout(() => { secretClicks = 0; }, 1800);
  if (secretClicks >= 5) {
    secretClicks = 0;
    showSecret();
  }
});

document.getElementById('start-button').addEventListener('click', startFreshGame);
document.getElementById('continue-button').addEventListener('click', continueGame);
document.getElementById('settings-button').addEventListener('click', () => showSettings(false));
document.getElementById('pause-button').addEventListener('click', showPause);
let pauseWhenSettled = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.stopMusic();
    if (controller.phase === 'idle') showPause();
    else if (controller.phase === 'swapping' || controller.phase === 'resolving') pauseWhenSettled = true;
    return;
  }
  if (pauseWhenSettled) {
    const pauseAfterResolution = () => {
      if (controller.phase === 'idle') {
        pauseWhenSettled = false;
        showPause();
      } else if (controller.phase === 'swapping' || controller.phase === 'resolving') {
        setTimeout(pauseAfterResolution, 80);
      } else {
        pauseWhenSettled = false;
      }
    };
    pauseAfterResolution();
  } else if (controller.phase !== 'paused' && controller.save.settings.music) {
    audio.startMusic();
  }
});

window.starMatchGame = controller;
