const form = document.getElementById('timer-form');
const nameInput = document.getElementById('timer-name');
const minutesInput = document.getElementById('timer-minutes');
const secondsInput = document.getElementById('timer-seconds');
const soundInput = document.getElementById('timer-sound');
const timersContainer = document.getElementById('timers');
const emptyState = document.getElementById('empty-state');
const BELL_SAMPLE_URL = resolveAssetUrl('assets/sounds/kitchen-timer.mp3');
const BELL_SAMPLE_SLICE_SECONDS = 1.35;
const PING_SAMPLE_URL = resolveAssetUrl('assets/sounds/oven-timer.mp3');
const PING_SAMPLE_SLICE_SECONDS = 1.2;
const PING_SAMPLE_START_SECONDS = 1.2;

const SOUND_PROFILES = {
  bell: {
    type: 'sample',
  },
  ping: {
    type: 'sample',
  },
};

let timers = [];
let nextId = 1;
const samplePlayers = {};
let soundPrimed = false;

window.addEventListener('pointerdown', primeSoundPlayback, { once: true });
window.addEventListener('keydown', primeSoundPlayback, { once: true });

soundInput.addEventListener('change', () => {
  playSoundTheme(soundInput.value);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const minutes = Number(minutesInput.value);
  const seconds = Number(secondsInput.value);
  const sound = soundInput.value;
  const totalSeconds = minutes * 60 + seconds;

  if (!name) {
    nameInput.focus();
    return;
  }

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    alert('Vul een geldige tijd in (minimaal 1 seconde).');
    return;
  }

  timers.push({
    id: nextId++,
    name,
    initialSeconds: totalSeconds,
    remainingSeconds: totalSeconds,
    running: false,
    done: false,
    intervalId: null,
    sound,
  });

  form.reset();
  minutesInput.value = '0';
  secondsInput.value = '30';
  soundInput.value = 'bell';
  nameInput.focus();
  render();
});

function render() {
  timersContainer.innerHTML = '';
  emptyState.hidden = timers.length > 0;

  for (const timer of timers) {
    const card = document.createElement('article');
    card.className = `timer-card${timer.done ? ' done' : ''}`;

    const title = document.createElement('h3');
    title.className = 'timer-title';
    title.textContent = timer.name;

    const meta = document.createElement('p');
    meta.className = 'timer-meta';
    meta.textContent = `Geluid: ${soundLabel(timer.sound)}`;

    const clock = document.createElement('p');
    clock.className = 'timer-clock';
    clock.textContent = formatTime(timer.remainingSeconds);

    const actions = document.createElement('div');
    actions.className = 'timer-actions';

    const startPauseBtn = document.createElement('button');
    startPauseBtn.className = 'primary';
    startPauseBtn.type = 'button';
    startPauseBtn.textContent = timer.running ? 'Pauzeer' : 'Start';
    startPauseBtn.addEventListener('click', () => toggleTimer(timer.id));

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => resetTimer(timer.id));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Verwijder';
    removeBtn.addEventListener('click', () => removeTimer(timer.id));

    actions.append(startPauseBtn, resetBtn, removeBtn);
    card.append(title, meta, clock, actions);
    timersContainer.append(card);
  }
}

function toggleTimer(id) {
  const timer = timers.find((item) => item.id === id);
  if (!timer || timer.done) return;

  if (timer.running) {
    stopInterval(timer);
    timer.running = false;
  } else {
    timer.running = true;
    timer.intervalId = setInterval(() => {
      timer.remainingSeconds -= 1;

      if (timer.remainingSeconds <= 0) {
        timer.remainingSeconds = 0;
        timer.done = true;
        timer.running = false;
        stopInterval(timer);
        notifyDone(timer.name, timer.sound);
      }

      render();
    }, 1000);
  }

  render();
}

function resetTimer(id) {
  const timer = timers.find((item) => item.id === id);
  if (!timer) return;

  stopInterval(timer);
  timer.running = false;
  timer.done = false;
  timer.remainingSeconds = timer.initialSeconds;
  render();
}

function removeTimer(id) {
  const timer = timers.find((item) => item.id === id);
  if (timer) {
    stopInterval(timer);
  }

  timers = timers.filter((item) => item.id !== id);
  render();
}

function stopInterval(timer) {
  if (timer.intervalId) {
    clearInterval(timer.intervalId);
    timer.intervalId = null;
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function notifyDone(name, sound) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`Timer klaar: ${name}`);
  }

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  playSoundTheme(sound);
}

function playSoundTheme(sound) {
  const profile = SOUND_PROFILES[sound] || SOUND_PROFILES.bell;
  if (profile.type === 'sample') {
    if (sound === 'ping') {
      playPingSample();
    } else {
      playBellSample();
    }
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();

  profile.frequencies.forEach((frequency, index) => {
    playNote(context, {
      frequency,
      start: context.currentTime + index * profile.noteLength,
      noteLength: profile.noteLength,
      wave: profile.wave,
      volume: profile.volume,
      sustainRatio: profile.sustainRatio,
    });
  });
}

function resolveAssetUrl(path) {
  return new URL(path, document.baseURI).toString();
}

function primeSoundPlayback() {
  if (soundPrimed) return;
  soundPrimed = true;
  primeSamplePlayer('bell', BELL_SAMPLE_URL);
  primeSamplePlayer('ping', PING_SAMPLE_URL);
}

function primeSamplePlayer(key, url) {
  if (samplePlayers[key]) return;
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.muted = true;
  samplePlayers[key] = { audio, stopTimeoutId: null };

  audio.play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    })
    .catch(() => {
      audio.muted = false;
    });
}

function playNote(context, options) {
  const { frequency, start, noteLength, wave, volume, sustainRatio = 0.85 } = options;
  const end = start + noteLength * sustainRatio;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end);
}

function playBellSample() {
  playSampleSlice('bell', BELL_SAMPLE_URL, BELL_SAMPLE_SLICE_SECONDS, playSynthBellFallback);
}

function playSynthBellFallback() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const fallback = {
    frequencies: [659.25, 783.99, 987.77],
    wave: 'triangle',
    noteLength: 0.16,
    volume: 0.09,
  };

  fallback.frequencies.forEach((frequency, index) => {
    playNote(context, {
      frequency,
      start: context.currentTime + index * fallback.noteLength,
      noteLength: fallback.noteLength,
      wave: fallback.wave,
      volume: fallback.volume,
    });
  });
}

function playPingSample() {
  playSampleSliceFromStart(
    'ping',
    PING_SAMPLE_URL,
    PING_SAMPLE_SLICE_SECONDS,
    PING_SAMPLE_START_SECONDS,
    playSynthPingFallback
  );
}

function playSynthPingFallback() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const fallback = {
    frequencies: [1046.5, 1318.51],
    wave: 'square',
    noteLength: 0.16,
    volume: 0.05,
    sustainRatio: 1,
  };

  fallback.frequencies.forEach((frequency, index) => {
    playNote(context, {
      frequency,
      start: context.currentTime + index * fallback.noteLength,
      noteLength: fallback.noteLength,
      wave: fallback.wave,
      volume: fallback.volume,
      sustainRatio: fallback.sustainRatio,
    });
  });
}

function playSampleSlice(key, url, sliceSeconds, onFallback) {
  if (!samplePlayers[key]) {
    const audio = new Audio(url);
    audio.preload = 'auto';
    samplePlayers[key] = { audio, stopTimeoutId: null };
  }

  const player = samplePlayers[key];
  const { audio } = player;

  const playSlice = () => {
    const start = Math.max((audio.duration || 0) - sliceSeconds, 0);
    audio.currentTime = start;
    audio.play().catch(() => {
      onFallback();
    });

    if (player.stopTimeoutId) {
      clearTimeout(player.stopTimeoutId);
    }
    player.stopTimeoutId = setTimeout(() => {
      audio.pause();
    }, sliceSeconds * 1000);
  };

  if (audio.readyState >= 1) {
    playSlice();
  } else {
    audio.addEventListener('loadedmetadata', playSlice, { once: true });
    audio.load();
  }
}

function playSampleSliceFromStart(key, url, sliceSeconds, startSeconds, onFallback) {
  if (!samplePlayers[key]) {
    const audio = new Audio(url);
    audio.preload = 'auto';
    samplePlayers[key] = { audio, stopTimeoutId: null };
  }

  const player = samplePlayers[key];
  const { audio } = player;

  const playSlice = () => {
    audio.currentTime = startSeconds;
    audio.play().catch(() => {
      onFallback();
    });

    if (player.stopTimeoutId) {
      clearTimeout(player.stopTimeoutId);
    }
    player.stopTimeoutId = setTimeout(() => {
      audio.pause();
    }, sliceSeconds * 1000);
  };

  if (audio.readyState >= 1) {
    playSlice();
  } else {
    audio.addEventListener('loadedmetadata', playSlice, { once: true });
    audio.load();
  }
}

function soundLabel(sound) {
  const labels = {
    bell: 'Bel',
    ping: 'Ping',
  };
  return labels[sound] || 'Bel';
}

render();
