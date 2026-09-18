const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

export function noteFrequency(note) {
  const match = /^([A-G]#?)(-?\d)$/.exec(note);
  if (!match) throw new Error(`无效音名：${note}`);
  const midi = (Number(match[2]) + 1) * 12 + NOTE_INDEX[match[1]];
  return 440 * (2 ** ((midi - 69) / 12));
}

export function getMusicPattern() {
  const progression = ['D3', 'A2', 'B2', 'F#2', 'G2', 'D3', 'G2', 'A2'];
  const chords = [
    ['D4', 'F#4', 'A4'],
    ['A3', 'C#4', 'E4'],
    ['B3', 'D4', 'F#4'],
    ['F#3', 'A3', 'C#4'],
    ['G3', 'B3', 'D4'],
    ['D4', 'F#4', 'A4'],
    ['G3', 'B3', 'D4'],
    ['A3', 'C#4', 'E4'],
  ];
  const melody = [
    'F#5', 'E5', 'D5', 'C#5', 'B4', 'A4', 'B4', 'C#5',
    'D5', 'C#5', 'B4', 'A4', 'G4', 'F#4', 'G4', 'E4',
    'D4', 'F#4', 'A4', 'G4', 'F#4', 'D4', 'F#4', 'E4',
    'D4', 'B3', 'D4', 'A4', 'G4', 'B4', 'A4', 'C#5',
  ];
  const notes = melody.map((note, index) => ({
    note,
    time: index * 0.5,
    duration: 0.42,
    voice: 'melody',
  }));
  progression.forEach((note, bar) => notes.push({
    note,
    time: bar * 2,
    duration: 1.85,
    voice: 'bass',
  }));
  chords.forEach((chord, bar) => [0, 1, 2, 1].forEach((index, beat) => notes.push({
    note: chord[index],
    time: bar * 2 + beat * 0.5,
    duration: 0.44,
    voice: 'arp',
  })));
  return { duration: 16, progression, notes };
}

export class AudioSystem {
  constructor(settings = {}) {
    this.settings = { music: true, sound: true, vibration: true, ...settings };
    this.context = null;
    this.master = null;
    this.musicTimer = null;
    this.musicPlaying = false;
    this.musicSources = new Set();
  }

  async unlock() {
    if (typeof window === 'undefined') return false;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    if (!this.context) {
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return true;
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    if (!this.settings.music) this.stopMusic();
    else if (this.context) this.startMusic();
  }

  tone(frequency, start, duration, options = {}) {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    if (options.slide) oscillator.frequency.exponentialRampToValueAtTime(options.slide, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.1, start + Math.min(.025, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    if (options.music) {
      this.musicSources.add(oscillator);
      oscillator.addEventListener?.('ended', () => this.musicSources.delete(oscillator), { once: true });
    }
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }

  play(name, strength = 1) {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const effects = {
      click: [[520, .05, 'sine']],
      swap: [[420, .07, 'sine'], [610, .08, 'sine']],
      invalid: [[210, .1, 'triangle'], [170, .12, 'triangle']],
      clear: [[650, .08, 'sine'], [830, .11, 'sine']],
      combo: [[780, .08, 'sine'], [990, .11, 'sine'], [1180, .14, 'sine']],
      special: [[330, .12, 'sawtooth'], [880, .22, 'sine']],
      shuffle: [[300, .12, 'triangle'], [430, .12, 'triangle'], [580, .16, 'triangle']],
      win: [[523, .16, 'sine'], [659, .16, 'sine'], [784, .28, 'sine']],
      lose: [[330, .16, 'triangle'], [262, .24, 'triangle']],
    };
    (effects[name] ?? effects.click).forEach(([frequency, duration, type], index) => {
      this.tone(frequency * Math.min(1.2, .92 + strength * .04), now + index * .07, duration, { type, volume: .08 });
    });
  }

  scheduleMusicLoop() {
    if (!this.musicPlaying || !this.context || !this.settings.music) return;
    const pattern = getMusicPattern();
    const start = this.context.currentTime + .06;
    const voiceOptions = {
      bass: { type: 'sine', volume: .018 },
      arp: { type: 'triangle', volume: .018 },
      melody: { type: 'sine', volume: .032 },
    };
    for (const item of pattern.notes) {
      const options = voiceOptions[item.voice] ?? voiceOptions.melody;
      this.tone(noteFrequency(item.note), start + item.time, item.duration, {
        ...options,
        music: true,
      });
    }
    this.musicTimer = setTimeout(() => this.scheduleMusicLoop(), pattern.duration * 1000 - 100);
  }

  async startMusic() {
    if (!this.settings.music || this.musicPlaying) return;
    if (!(await this.unlock())) return;
    this.musicPlaying = true;
    this.scheduleMusicLoop();
  }

  stopMusic() {
    this.musicPlaying = false;
    clearTimeout(this.musicTimer);
    this.musicTimer = null;
    for (const source of this.musicSources) {
      try { source.stop(); } catch {}
    }
    this.musicSources.clear();
  }

  vibrate(duration) {
    if (this.settings.vibration && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(duration);
  }
}
