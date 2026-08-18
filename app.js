const CONFIG = {
  roundsPerMode: 4,
  feedbackHoldMs: 2400,
  reactionHoldMs: 1700,
  feedTexts: ['喵～', '好吃', '再来', '谢谢'],
  statusTexts: [
    'Claude Code：正在读取上下文并持续编辑文件，猫咪会给出专注陪跑状态。',
    'Codex：正在执行任务并检查结果，猫咪会同步当前工作进程。',
    'Kiro：正在整理需求、结构和说明，猫咪会显示整理中的提示。',
    'WorkBuddy：正在同步提醒与任务进展，猫咪会进入收尾状态。',
  ],
  prompts: {
    feed: '提示：把虾拖到猫咪身上，完成这一轮喂食。',
    status: '提示：点击猫咪，观察它显示当前接入的 AI / 工具正在做什么。',
  },
  chooserNote: '请选择一种进行体验。完成后会出现结束提示，请再选择另外一种体验。你可以重复体验，但请确保两种都体验到。',
  repeatNote: '这一种已完成。请选择另外一种体验；你可以重复体验，但请确保两种都体验到。',
};

const SPRITE = {
  idle: { row: 0, frames: 6, fps: 5 },
  react: { row: 3, frames: 4, fps: 8 },
};

const refs = {
  sprite: document.getElementById('sprite'),
  petShell: document.getElementById('petShell'),
  petZone: document.getElementById('petZone'),
  petButton: document.getElementById('petButton'),
  petHit: document.getElementById('petHit'),
  bubble: document.getElementById('bubble'),
  food: document.getElementById('food'),
  chooser: document.getElementById('chooser'),
  chooserNote: document.getElementById('chooserNote'),
  feedChoice: document.getElementById('feedChoice'),
  statusChoice: document.getElementById('statusChoice'),
  hud: document.getElementById('hud'),
  counter: document.getElementById('counter'),
  prompt: document.getElementById('prompt'),
  scene: document.getElementById('scene'),
};

const state = {
  mode: null,
  roundIndex: 0,
  dragging: false,
  locked: false,
  dragId: null,
  dragOffset: { x: 0, y: 0 },
  frameTimer: null,
  returnTimer: null,
  idleTimer: null,
  feedbackTimer: null,
};

function setSprite(row, frame) {
  refs.sprite.style.backgroundPosition = `${-frame * 192}px ${-row * 208}px`;
}

function playIdle() {
  clearInterval(state.frameTimer);
  let frame = 0;
  setSprite(SPRITE.idle.row, 0);
  state.frameTimer = setInterval(() => {
    frame = (frame + 1) % SPRITE.idle.frames;
    setSprite(SPRITE.idle.row, frame);
  }, 1000 / SPRITE.idle.fps);
}

function playReaction(duration = CONFIG.reactionHoldMs) {
  clearInterval(state.frameTimer);
  clearTimeout(state.returnTimer);
  let frame = 0;
  setSprite(SPRITE.react.row, 0);
  const startedAt = Date.now();
  state.frameTimer = setInterval(() => {
    frame = (frame + 1) % SPRITE.react.frames;
    setSprite(SPRITE.react.row, frame);
    if (Date.now() - startedAt >= duration) {
      clearInterval(state.frameTimer);
      state.returnTimer = setTimeout(playIdle, 140);
    }
  }, 1000 / SPRITE.react.fps);
}

function showBubble(text) {
  refs.bubble.textContent = text;
  refs.bubble.classList.remove('show');
  void refs.bubble.offsetWidth;
  refs.bubble.classList.add('show');
}

function spawnSparks() {
  const count = 4;
  for (let index = 0; index < count; index += 1) {
    const spark = document.createElement('span');
    spark.className = 'spark';
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const radius = 26 + index * 5;
    spark.style.setProperty('--dx', `${Math.cos(angle) * radius}px`);
    spark.style.setProperty('--dy', `${Math.sin(angle) * radius - 18}px`);
    spark.style.animation = 'sparkFloat 820ms ease forwards';
    refs.scene.appendChild(spark);
    setTimeout(() => spark.remove(), 860);
  }
}

function pulsePet() {
  refs.petShell.classList.remove('react');
  void refs.petShell.offsetWidth;
  refs.petShell.classList.add('react');
  clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => refs.petShell.classList.remove('react'), CONFIG.reactionHoldMs);
}

function pointInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function setFoodOrigin() {
  const x = Math.max(28, Math.min(window.innerWidth * 0.23, window.innerWidth / 2 - 260));
  const y = Math.max(104, window.innerHeight - 220);
  refs.food.style.left = `${Math.round(x)}px`;
  refs.food.style.top = `${Math.round(y)}px`;
  refs.food.style.bottom = 'auto';
  refs.food.style.transform = 'rotate(-8deg)';
}

function showFood(visible) {
  refs.food.style.display = visible ? 'block' : 'none';
  if (visible) setFoodOrigin();
}

function updateHud() {
  refs.counter.textContent = `第 ${Math.min(state.roundIndex + 1, CONFIG.roundsPerMode)} / ${CONFIG.roundsPerMode} 轮互动`;
  refs.prompt.textContent = CONFIG.prompts[state.mode];
}

function showChooser(note = CONFIG.chooserNote) {
  clearTimeout(state.feedbackTimer);
  refs.chooserNote.textContent = note;
  refs.chooser.classList.remove('hidden');
  refs.hud.classList.remove('show');
  showFood(false);
  state.mode = null;
  state.roundIndex = 0;
  state.dragging = false;
  state.locked = false;
  playIdle();
}

function beginMode(nextMode) {
  clearTimeout(state.feedbackTimer);
  state.mode = nextMode;
  state.roundIndex = 0;
  state.locked = false;
  refs.chooser.classList.add('hidden');
  refs.hud.classList.add('show');
  updateHud();
  showFood(nextMode === 'feed');
  playIdle();
}

function finishRound(text) {
  if (state.locked) return;
  state.locked = true;
  clearTimeout(state.feedbackTimer);
  pulsePet();
  playReaction();
  showBubble(text);
  spawnSparks();
  state.feedbackTimer = setTimeout(() => {
    state.roundIndex += 1;
    state.locked = false;
    if (state.roundIndex >= CONFIG.roundsPerMode) {
      showChooser(CONFIG.repeatNote);
      return;
    }
    updateHud();
    if (state.mode === 'feed') showFood(true);
  }, CONFIG.feedbackHoldMs);
}

refs.feedChoice.addEventListener('click', () => beginMode('feed'));
refs.statusChoice.addEventListener('click', () => beginMode('status'));

refs.food.addEventListener('pointerdown', (event) => {
  if (state.mode !== 'feed' || state.locked) return;
  state.dragging = true;
  state.dragId = event.pointerId;
  refs.food.setPointerCapture(event.pointerId);
  const rect = refs.food.getBoundingClientRect();
  state.dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  refs.food.classList.add('dragging');
  event.preventDefault();
});

refs.food.addEventListener('pointermove', (event) => {
  if (!state.dragging || event.pointerId !== state.dragId) return;
  const sceneRect = refs.scene.getBoundingClientRect();
  const x = event.clientX - sceneRect.left - state.dragOffset.x;
  const y = event.clientY - sceneRect.top - state.dragOffset.y;
  refs.food.style.left = `${x}px`;
  refs.food.style.top = `${y}px`;
  refs.food.style.bottom = 'auto';
});

function endDrag(event) {
  if (!state.dragging) return;
  state.dragging = false;
  refs.food.classList.remove('dragging');
  const petRect = refs.petHit.getBoundingClientRect();
  if (pointInRect(event.clientX, event.clientY, petRect)) {
    refs.food.style.display = 'none';
    finishRound(CONFIG.feedTexts[state.roundIndex] || '喵～');
  } else {
    setFoodOrigin();
  }
}

refs.food.addEventListener('pointerup', endDrag);
refs.food.addEventListener('pointercancel', endDrag);

refs.petButton.addEventListener('click', () => {
  if (state.mode !== 'status' || state.locked) return;
  finishRound(CONFIG.statusTexts[state.roundIndex] || '工作中');
});

window.addEventListener('resize', () => {
  if (state.mode === 'feed' && !state.dragging) setFoodOrigin();
});

window.MaidCatDemo = { CONFIG, state, beginMode, showChooser, setFoodOrigin };
showChooser();
playIdle();
