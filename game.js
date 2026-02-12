const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const shieldStatusEl = document.getElementById('shield-status');
const slowStatusEl = document.getElementById('slow-status');
const finalScoreEl = document.getElementById('final-score');

const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const playBtn = document.getElementById('play-btn');
const playAgainBtn = document.getElementById('play-again-btn');

const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');

const STORAGE_KEY = 'neon-dodge-best-score';
let bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
bestScoreEl.textContent = bestScore;

const state = {
  mode: 'start',
  score: 0,
  survivalScore: 0,
  pickupScore: 0,
  lastTime: 0,
  obstacleTimer: 0,
  powerUpTimer: 0,
  difficulty: 1,
  shield: false,
  slowTimeEnd: 0,
  shake: 0,
  stars: [],
  obstacles: [],
  powerUps: [],
  particles: [],
};

const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  touchX: 0,
  touchY: 0,
  touchActive: false,
  joyX: 0,
  joyY: 0,
};

const player = {
  x: 0,
  y: 0,
  size: 16,
  speed: 340,
};

const baseWorld = {
  obstacleSpeed: 190,
  minObstacleInterval: 0.28,
  maxObstacleInterval: 1.2,
  powerUpInterval: 6,
};

let audioCtx;

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(bounds.width * ratio));
  canvas.height = Math.max(400, Math.floor(bounds.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  if (state.stars.length === 0) {
    for (let i = 0; i < 90; i += 1) {
      state.stars.push({
        x: Math.random() * bounds.width,
        y: Math.random() * bounds.height,
        speed: 20 + Math.random() * 60,
        size: Math.random() * 2 + 0.6,
      });
    }
  }

  player.x = clamp(player.x, player.size, bounds.width - player.size);
  player.y = clamp(player.y, player.size, bounds.height - player.size);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function startGame() {
  state.mode = 'playing';
  state.score = 0;
  state.survivalScore = 0;
  state.pickupScore = 0;
  state.obstacleTimer = 0;
  state.powerUpTimer = 2;
  state.difficulty = 1;
  state.shield = false;
  state.slowTimeEnd = 0;
  state.shake = 0;
  state.obstacles = [];
  state.powerUps = [];
  state.particles = [];

  const bounds = canvas.getBoundingClientRect();
  player.x = bounds.width / 2;
  player.y = bounds.height * 0.85;

  updateHud();
  showScreen(null);
  tryUnlockAudio();
}

function showScreen(target) {
  startScreen.classList.toggle('active', target === 'start');
  pauseScreen.classList.toggle('active', target === 'pause');
  gameOverScreen.classList.toggle('active', target === 'gameover');
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    showScreen('pause');
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    state.lastTime = performance.now();
    showScreen(null);
  }
}

function gameOver() {
  state.mode = 'gameover';
  finalScoreEl.textContent = Math.floor(state.score);
  if (state.score > bestScore) {
    bestScore = Math.floor(state.score);
    localStorage.setItem(STORAGE_KEY, String(bestScore));
    bestScoreEl.textContent = bestScore;
  }
  showScreen('gameover');
  playTone(120, 0.12, 'sawtooth', 0.04);
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score);
  shieldStatusEl.textContent = state.shield ? 'Active' : 'No';

  const now = performance.now();
  const remaining = Math.max(0, state.slowTimeEnd - now);
  slowStatusEl.textContent = remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : 'Ready';
}

function spawnObstacle() {
  const bounds = canvas.getBoundingClientRect();
  const size = randomRange(14, 30);
  state.obstacles.push({
    x: randomRange(size, bounds.width - size),
    y: -size,
    size,
    speed: baseWorld.obstacleSpeed + randomRange(20, 120) * state.difficulty,
    hue: Math.random() < 0.5 ? 325 : 190,
  });
}

function spawnPowerUp() {
  const bounds = canvas.getBoundingClientRect();
  const type = Math.random() < 0.55 ? 'shield' : 'slow';
  state.powerUps.push({
    x: randomRange(18, bounds.width - 18),
    y: -20,
    size: 13,
    speed: 130 + randomRange(0, 35),
    type,
    pulse: Math.random() * Math.PI * 2,
  });
}

function burstParticles(x, y, color, amount = 14) {
  for (let i = 0; i < amount; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = randomRange(30, 240);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: randomRange(0.2, 0.7),
      color,
      size: randomRange(1.5, 3.5),
    });
  }
}

function getSlowFactor() {
  return performance.now() < state.slowTimeEnd ? 0.55 : 1;
}

function applyPlayerInput(dt) {
  const bounds = canvas.getBoundingClientRect();
  let dx = 0;
  let dy = 0;

  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;

  if (input.touchActive) {
    player.x += (input.touchX - player.x) * clamp(dt * 10, 0, 1);
    player.y += (input.touchY - player.y) * clamp(dt * 10, 0, 1);
  }

  dx += input.joyX;
  dy += input.joyY;

  const mag = Math.hypot(dx, dy) || 1;
  player.x += (dx / mag) * player.speed * dt;
  player.y += (dy / mag) * player.speed * dt;

  player.x = clamp(player.x, player.size, bounds.width - player.size);
  player.y = clamp(player.y, player.size, bounds.height - player.size);
}

function updatePlaying(dt) {
  state.difficulty += dt * 0.03;
  const slow = getSlowFactor();

  state.survivalScore += dt * 10;
  state.score = state.survivalScore + state.pickupScore;

  applyPlayerInput(dt);

  const obstacleInterval = clamp(
    baseWorld.maxObstacleInterval - state.difficulty * 0.09,
    baseWorld.minObstacleInterval,
    baseWorld.maxObstacleInterval
  );

  state.obstacleTimer -= dt;
  if (state.obstacleTimer <= 0) {
    state.obstacleTimer = obstacleInterval * randomRange(0.8, 1.15);
    spawnObstacle();
  }

  state.powerUpTimer -= dt;
  if (state.powerUpTimer <= 0) {
    state.powerUpTimer = baseWorld.powerUpInterval * randomRange(0.8, 1.25);
    spawnPowerUp();
  }

  const bounds = canvas.getBoundingClientRect();
  const playerHitRadius = player.size * 0.78;

  state.obstacles.forEach((obs) => {
    obs.y += obs.speed * dt * slow;
  });
  state.obstacles = state.obstacles.filter((obs) => obs.y < bounds.height + obs.size + 8);

  for (const obs of state.obstacles) {
    const dist = Math.hypot(obs.x - player.x, obs.y - player.y);
    if (dist < obs.size + playerHitRadius) {
      if (state.shield) {
        state.shield = false;
        state.shake = 0.18;
        burstParticles(player.x, player.y, '#66ffe0', 24);
        playTone(500, 0.06, 'triangle', 0.04);
        state.obstacles = state.obstacles.filter((item) => item !== obs);
      } else {
        state.shake = 0.35;
        burstParticles(player.x, player.y, '#ff5f9f', 34);
        gameOver();
      }
      break;
    }
  }

  state.powerUps.forEach((pu) => {
    pu.y += pu.speed * dt * slow;
    pu.pulse += dt * 7;
  });
  state.powerUps = state.powerUps.filter((pu) => pu.y < bounds.height + 20);

  state.powerUps = state.powerUps.filter((pu) => {
    const dist = Math.hypot(pu.x - player.x, pu.y - player.y);
    if (dist < pu.size + playerHitRadius) {
      if (pu.type === 'shield') {
        state.shield = true;
        burstParticles(pu.x, pu.y, '#65ff92', 18);
      } else {
        state.slowTimeEnd = performance.now() + 5000;
        burstParticles(pu.x, pu.y, '#63d7ff', 18);
      }
      state.pickupScore += 120;
      playTone(740, 0.07, 'sine', 0.03);
      return false;
    }
    return true;
  });

  state.particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= dt;
  });
  state.particles = state.particles.filter((p) => p.life > 0);

  state.stars.forEach((star) => {
    star.y += star.speed * dt * slow * 0.5;
    if (star.y > bounds.height) {
      star.y = -4;
      star.x = Math.random() * bounds.width;
    }
  });

  state.shake = Math.max(0, state.shake - dt);
  updateHud();
}

function drawBackground(bounds) {
  ctx.fillStyle = '#050816';
  ctx.fillRect(0, 0, bounds.width, bounds.height);

  ctx.strokeStyle = 'rgba(24, 241, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < bounds.width; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, bounds.height);
    ctx.stroke();
  }
  for (let y = 0; y < bounds.height; y += 36) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(bounds.width, y);
    ctx.stroke();
  }

  for (const star of state.stars) {
    ctx.fillStyle = 'rgba(120, 246, 255, 0.75)';
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = '#72f4ff';
  ctx.shadowColor = '#40edff';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(0, -player.size);
  ctx.lineTo(player.size * 0.85, player.size);
  ctx.lineTo(0, player.size * 0.45);
  ctx.lineTo(-player.size * 0.85, player.size);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ff2fd6';
  ctx.beginPath();
  ctx.arc(0, player.size * 0.55, player.size * 0.22, 0, Math.PI * 2);
  ctx.fill();

  if (state.shield) {
    ctx.strokeStyle = 'rgba(101, 255, 146, 0.9)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, player.size * 1.45, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawObjects() {
  for (const obs of state.obstacles) {
    ctx.fillStyle = `hsla(${obs.hue}, 92%, 58%, 0.95)`;
    ctx.shadowColor = `hsla(${obs.hue}, 100%, 66%, 0.75)`;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(obs.x, obs.y, obs.size, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const pu of state.powerUps) {
    const sizePulse = Math.sin(pu.pulse) * 1.8;
    const color = pu.type === 'shield' ? '#65ff92' : '#63d7ff';

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(pu.x, pu.y, pu.size + sizePulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#07203a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.type === 'shield' ? 'S' : 'T', pu.x, pu.y + 0.5);
  }

  for (const p of state.particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = clamp(p.life * 1.4, 0, 1);
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

function render() {
  const bounds = canvas.getBoundingClientRect();
  ctx.save();

  if (state.shake > 0) {
    const power = state.shake * 8;
    ctx.translate((Math.random() - 0.5) * power, (Math.random() - 0.5) * power);
  }

  drawBackground(bounds);
  drawObjects();
  drawPlayer();

  ctx.restore();
}

function gameLoop(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.04);
  state.lastTime = timestamp;

  if (state.mode === 'playing') {
    updatePlaying(dt);
  }

  render();
  requestAnimationFrame(gameLoop);
}

function setInputKey(code, isDown) {
  if (code === 'ArrowLeft' || code === 'KeyA') input.left = isDown;
  if (code === 'ArrowRight' || code === 'KeyD') input.right = isDown;
  if (code === 'ArrowUp' || code === 'KeyW') input.up = isDown;
  if (code === 'ArrowDown' || code === 'KeyS') input.down = isDown;
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyP' || event.code === 'Escape') {
    if (state.mode === 'playing' || state.mode === 'paused') {
      togglePause();
      event.preventDefault();
    }
    return;
  }

  setInputKey(event.code, true);
});

window.addEventListener('keyup', (event) => {
  setInputKey(event.code, false);
});

canvas.addEventListener('touchstart', (event) => {
  if (state.mode !== 'playing') return;
  const touch = event.touches[0];
  if (!touch) return;
  const rect = canvas.getBoundingClientRect();
  input.touchActive = true;
  input.touchX = touch.clientX - rect.left;
  input.touchY = touch.clientY - rect.top;
}, { passive: true });

canvas.addEventListener('touchmove', (event) => {
  if (state.mode !== 'playing') return;
  const touch = event.touches[0];
  if (!touch) return;
  const rect = canvas.getBoundingClientRect();
  input.touchX = touch.clientX - rect.left;
  input.touchY = touch.clientY - rect.top;
}, { passive: true });

canvas.addEventListener('touchend', () => {
  input.touchActive = false;
});

let joystickPointerId = null;

joystickBase.addEventListener('pointerdown', (event) => {
  joystickPointerId = event.pointerId;
  joystickBase.setPointerCapture(event.pointerId);
  updateJoystick(event);
});

joystickBase.addEventListener('pointermove', (event) => {
  if (event.pointerId !== joystickPointerId) return;
  updateJoystick(event);
});

joystickBase.addEventListener('pointerup', (event) => {
  if (event.pointerId !== joystickPointerId) return;
  joystickPointerId = null;
  input.joyX = 0;
  input.joyY = 0;
  joystickKnob.style.transform = 'translate(-50%, -50%)';
});

function updateJoystick(event) {
  const rect = joystickBase.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const maxDist = rect.width * 0.33;
  const dist = Math.hypot(dx, dy);
  const ratio = dist > maxDist ? maxDist / dist : 1;

  const x = dx * ratio;
  const y = dy * ratio;

  input.joyX = x / maxDist;
  input.joyY = y / maxDist;

  joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}

playBtn.addEventListener('click', startGame);
playAgainBtn.addEventListener('click', startGame);
window.addEventListener('resize', resizeCanvas);

function tryUnlockAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq, duration, type = 'sine', gain = 0.03) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.value = gain;

  osc.connect(amp);
  amp.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.start(now);
  osc.stop(now + duration);
}

resizeCanvas();
showScreen('start');
requestAnimationFrame(gameLoop);
