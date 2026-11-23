// PLAYABLE VOWEL SPACE + CHANT ANALYSIS
// Screen 2: SoundGen sample crossfading
// Screen 3: Green Tara formant trajectory

const VOWELS = {
  a: [800, 1400],
  e: [550, 1850],
  i: [300, 2500],
  o: [600, 980],
  u: [300, 740]
};

const SAMPLES = Object.keys(VOWELS).map(name => ({
  name,
  url: `audio/vowels/${name}_up_bbbb.wav`
}));

const CHANT = 'audio/22050_norm/F-Bud-Green_Tara_mantra-Drukmo_Gyal.wav';
const DATA = 'data/formants_timestamped_drukmo.csv';

const W = 650;
const H = 390;
const B = { l: 65, r: 610, t: 45, b: 345 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const px = f2 => B.l + (3200 - f2) / 2800 * (B.r - B.l);
const py = f1 => B.t + (f1 - 200) / 800 * (B.b - B.t);

let panel, canvas, g, readout;
let mode = 'vowels';
let F1 = 550, F2 = 1850;
let audioCtx = null;
let tracks = [];
let master = null;
let started = false;
let loading = false;
let dragging = false;

let chantAudio;
let frames = [];
let animationId = null;

export function initVowelExplorer() {
  panel = document.createElement('section');
  panel.id = 'vowel-explorer';

  panel.innerHTML = `
    <div class="vowel-top">
      <strong id="explorer-title">PLAYABLE VOWEL SPACE</strong>
      <span id="explorer-subtitle">F1 / F2 · SOUNDGEN</span>
    </div>

    <p class="vowel-instruction" id="explorer-instruction">
      Press Start, then drag across the map to blend five vowel sounds.
    </p>

    <canvas width="${W}" height="${H}"></canvas>

    <div class="vowel-bottom">
      <button id="sound-start">▶ Start sound</button>
      <button id="sound-stop">■ Stop</button>
      <span id="vowel-status">Ready</span>
    </div>

    <p class="vowel-note" id="explorer-note">
      F2 increases to the left; F1 increases downward.
      Sounds are blended recordings, not synthesized formants.
    </p>

    <div class="vowel-bottom">
      <button id="next-screen">EXPLORE THE CHANT →</button>
      <button id="previous-screen" style="display:none">
        ← BACK TO VOWELS
      </button>
      <button id="close-explorer">CLOSE</button>
    </div>
  `;

  document.body.appendChild(panel);

  canvas = panel.querySelector('canvas');
  g = canvas.getContext('2d');
  readout = panel.querySelector('#vowel-status');

  chantAudio = new Audio(CHANT);
  chantAudio.preload = 'auto';

  panel.querySelector('#sound-start').addEventListener('click', () => {
    if (mode === 'vowels') startVowels();
    else playChant();
  });

  panel.querySelector('#sound-stop').addEventListener('click', stopAll);

  panel.querySelector('#next-screen').addEventListener('click', () => {
    stopAll();
    mode = 'chant';
    updateMode();
  });

  panel.querySelector('#previous-screen').addEventListener('click', () => {
    stopAll();
    mode = 'vowels';
    updateMode();
  });

  panel.querySelector('#close-explorer').addEventListener('click', () => {
    setVowelExplorerVisible(false);
  });

  canvas.addEventListener('pointerdown', e => {
    if (mode !== 'vowels') return;
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    movePointer(e);
  });

  canvas.addEventListener('pointermove', e => {
    if (dragging && mode === 'vowels') movePointer(e);
  });

  canvas.addEventListener('pointerup', () => dragging = false);
  canvas.addEventListener('pointercancel', () => dragging = false);

  fetch(DATA)
    .then(r => {
      if (!r.ok) throw new Error('Chant measurements unavailable');
      return r.text();
    })
    .then(text => {
      frames = text.trim().split(/\r?\n/)
        .slice(1)
        .map(row => row.split(',').map(Number))
        .filter(row => row.length === 3 && row.every(Number.isFinite));
    })
    .catch(console.error);

  updateMode();
}

export function setVowelExplorerVisible(visible) {
  if (!panel) return;
  panel.classList.toggle('visible', visible);

  if (!visible) {
    stopAll();
    mode = 'vowels';
    updateMode();
  }
}

function updateMode() {
  const isChant = mode === 'chant';

  panel.querySelector('#explorer-title').textContent =
    isChant ? 'CHANT RESONANCE' : 'PLAYABLE VOWEL SPACE';

  panel.querySelector('#explorer-subtitle').textContent =
    isChant ? 'GREEN TARA · DRUKMO GYAL' : 'F1 / F2 · SOUNDGEN';

  panel.querySelector('#explorer-instruction').textContent =
    isChant
      ? 'Listen as the measured resonance moves through acoustic space.'
      : 'Press Start, then drag across the map to blend five vowel sounds.';

  panel.querySelector('#sound-start').textContent =
    isChant ? '▶ Play chant' : '▶ Start sound';

  panel.querySelector('#next-screen').style.display =
    isChant ? 'none' : '';

  panel.querySelector('#previous-screen').style.display =
    isChant ? '' : 'none';

  panel.querySelector('#explorer-note').textContent =
    isChant
      ? 'Each point represents an estimated F1/F2 measurement from the recording.'
      : 'F2 increases left; F1 increases downward. SoundGen recordings are crossfaded.';

  readout.textContent = isChant
    ? `${frames.length} measured frames`
    : 'Move to explore';

  draw();
}

function weights() {
  const values = Object.entries(VOWELS).map(([name, [f1, f2]]) => {
    const dx = (F2 - f2) / 1800;
    const dy = (F1 - f1) / 650;
    const d2 = dx * dx + dy * dy;

    return {
      name,
      weight: 1 / Math.pow(d2 + 0.0008, 1.5)
    };
  });

  const total = values.reduce((sum, v) => sum + v.weight, 0);

  return values.map(v => ({
    ...v,
    weight: v.weight / total
  }));
}

function updateSound() {
  const w = weights();

  if (started) {
    for (const track of tracks) {
      const value = w.find(v => v.name === track.name).weight;

      track.gain.gain.setTargetAtTime(
        Math.sqrt(value) * 0.40,
        audioCtx.currentTime,
        0.055
      );
    }
  }

  const nearest = [...w].sort((a, b) => b.weight - a.weight);

  readout.textContent =
    `F1 ${Math.round(F1)} Hz · F2 ${Math.round(F2)} Hz · ` +
    nearest.slice(0, 2).map(v =>
      `${v.name.toUpperCase()} ${Math.round(v.weight * 100)}%`
    ).join(' / ');

  draw();
}

function movePointer(e) {
  const rect = canvas.getBoundingClientRect();

  const x = clamp(
    (e.clientX - rect.left) * W / rect.width,
    B.l, B.r
  );

  const y = clamp(
    (e.clientY - rect.top) * H / rect.height,
    B.t, B.b
  );

  F2 = 3200 - (x - B.l) / (B.r - B.l) * 2800;
  F1 = 200 + (y - B.t) / (B.b - B.t) * 800;

  updateSound();
}

async function startVowels() {
  if (started || loading) return;

  loading = true;
  readout.textContent = 'Loading vowel recordings…';

  try {
    audioCtx = new AudioContext();
    await audioCtx.resume();

    master = audioCtx.createGain();
    master.gain.value = 0.85;
    master.connect(audioCtx.destination);

    for (const sample of SAMPLES) {
      const response = await fetch(sample.url);

      if (!response.ok) {
        throw new Error(`Missing ${sample.url}`);
      }

      const bytes = await response.arrayBuffer();
      const buffer = await audioCtx.decodeAudioData(bytes);

      const source = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();

      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = 0;

      source.connect(gain);
      gain.connect(master);

      tracks.push({
        name: sample.name,
        source,
        gain
      });
    }

    const startTime = audioCtx.currentTime + 0.08;

    for (const track of tracks) {
      track.source.start(startTime);
    }

    started = true;
    updateSound();

  } catch (error) {
    console.error(error);
    readout.textContent = `Audio error: ${error.message}`;
    stopVowels();
  } finally {
    loading = false;
  }
}

function stopVowels() {
  started = false;

  for (const track of tracks) {
    try { track.source.stop(); } catch {}
    track.source.disconnect();
    track.gain.disconnect();
  }

  tracks = [];

  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}

function playChant() {
  stopVowels();

  chantAudio.currentTime = 0;

  chantAudio.play()
    .then(() => {
      animateChant();
    })
    .catch(error => {
      readout.textContent = error.message;
    });
}

function animateChant() {
  cancelAnimationFrame(animationId);

  function tick() {
    draw();

    if (!chantAudio.paused && !chantAudio.ended) {
      animationId = requestAnimationFrame(tick);
    }
  }

  tick();
}

function stopAll() {
  stopVowels();

  chantAudio.pause();
  chantAudio.currentTime = 0;

  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (panel) {
    readout.textContent = 'Stopped';
    draw();
  }
}

function draw() {
  if (!g) return;

  g.clearRect(0, 0, W, H);
  g.fillStyle = '#242a2b';
  g.fillRect(0, 0, W, H);

  g.strokeStyle = '#556266';
  g.strokeRect(B.l, B.t, B.r - B.l, B.b - B.t);

  g.font = '14px monospace';
  g.fillStyle = '#e6e2d9';

  g.fillText('F2 HIGH / FRONT ←', B.l, 25);
  g.fillText('→ F2 LOW / BACK', 430, 25);
  g.fillText('F1 LOW / CLOSED', B.l, 378);
  g.fillText('F1 HIGH / OPEN', 450, 378);

  for (let f2 = 400; f2 <= 3200; f2 += 400) {
    const x = px(f2);

    g.strokeStyle = '#39474a';
    g.beginPath();
    g.moveTo(x, B.t);
    g.lineTo(x, B.b);
    g.stroke();
  }

  for (let f1 = 200; f1 <= 1000; f1 += 200) {
    const y = py(f1);

    g.strokeStyle = '#39474a';
    g.beginPath();
    g.moveTo(B.l, y);
    g.lineTo(B.r, y);
    g.stroke();

    g.fillStyle = '#aebabc';
    g.font = '12px monospace';
    g.fillText(f1, 20, y + 4);
  }

  if (mode === 'vowels') {
    for (const [name, [f1, f2]] of Object.entries(VOWELS)) {
      const x = px(f2);
      const y = py(f1);

      g.fillStyle = '#d2d6c9';
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      g.fill();

      g.font = 'bold 16px monospace';
      g.fillText(name.toUpperCase(), x + 11, y - 9);
    }

    g.strokeStyle = '#f3c078';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(px(F2), py(F1), 12, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 1;

  } else {
    // Plot the actual measured chant points.
    for (const [time, f1, f2] of frames) {
      g.fillStyle = 'rgba(142,207,216,0.28)';
      g.beginPath();
      g.arc(px(f2), py(f1), 1.8, 0, Math.PI * 2);
      g.fill();
    }

    // Highlight the measurement nearest the current playback time.
    if (!chantAudio.paused && frames.length) {
      const t = chantAudio.currentTime;

      let closest = frames[0];
      let distance = Infinity;

      for (const frame of frames) {
        const d = Math.abs(frame[0] - t);

        if (d < distance) {
          closest = frame;
          distance = d;
        }
      }

      const [time, f1, f2] = closest;

      g.fillStyle = '#f3c078';
      g.beginPath();
      g.arc(px(f2), py(f1), 8, 0, Math.PI * 2);
      g.fill();

      readout.textContent =
        `${time.toFixed(2)}s · F1 ${Math.round(f1)} Hz · F2 ${Math.round(f2)} Hz`;
    }
  }
}