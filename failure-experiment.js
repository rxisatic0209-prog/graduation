const EXPERIMENT_CONFIG = {
  rounds: 8,
  failureDelayMs: 5000,
  successHoldMs: 2400,
  failureTransitionMs: 600,
  reactionHoldMs: 1700,
  failureRounds: {
    low: [2],
    high: [2, 4, 5, 7],
  },
  successText: {
    status: '已经完成代码修改，正在进行代码审阅，我继续盯一下。',
    feed: '好开心！谢谢你喂我～',
  },
  prompt: {
    status: '点击猫咪，获取Claude Code工作状态。',
    feed: '喂猫咪吃虾。',
  },
};

const SPRITE_CONFIG = {
  idle: { row: 0, frames: 6, fps: 5 },
  react: { row: 3, frames: 4, fps: 8 },
};

const refs = {
  body: document.body,
  scene: document.getElementById('scene'),
  sprite: document.getElementById('sprite'),
  petShell: document.getElementById('petShell'),
  petButton: document.getElementById('petButton'),
  petHit: document.querySelector('.pet-hit'),
  bubble: document.getElementById('bubble'),
  food: document.getElementById('food'),
  counter: document.getElementById('counter'),
  prompt: document.getElementById('prompt'),
  roundDialog: document.getElementById('roundDialog'),
  roundDialogTitle: document.getElementById('roundDialogTitle'),
  roundDialogNote: document.getElementById('roundDialogNote'),
  roundDialogButton: document.getElementById('roundDialogButton'),
};

const state = {
  mode: refs.body.dataset.mode === 'feed' ? 'feed' : 'status',
  failureLevel: refs.body.dataset.failure === 'high' ? 'high' : 'low',
  round: 1,
  waiting: false,
  finished: false,
  pendingRound: null,
  dragging: false,
  dragId: null,
  dragOffset: { x: 0, y: 0 },
  frameTimer: null,
  returnTimer: null,
  idleTimer: null,
  responseTimer: null,
  nextRoundTimer: null,
  log: [],
};

function setSprite(row, frame) {
  refs.sprite.style.backgroundPosition = `${-frame * 192}px ${-row * 208}px`;
}

function playIdle() {
  clearInterval(state.frameTimer);
  let frame = 0;
  setSprite(SPRITE_CONFIG.idle.row, 0);
  state.frameTimer = setInterval(() => {
    frame = (frame + 1) % SPRITE_CONFIG.idle.frames;
    setSprite(SPRITE_CONFIG.idle.row, frame);
  }, 1000 / SPRITE_CONFIG.idle.fps);
}

function playReaction() {
  clearInterval(state.frameTimer);
  clearTimeout(state.returnTimer);
  let frame = 0;
  const startedAt = Date.now();
  setSprite(SPRITE_CONFIG.react.row, 0);
  state.frameTimer = setInterval(() => {
    frame = (frame + 1) % SPRITE_CONFIG.react.frames;
    setSprite(SPRITE_CONFIG.react.row, frame);
    if (Date.now() - startedAt >= EXPERIMENT_CONFIG.reactionHoldMs) {
      clearInterval(state.frameTimer);
      state.returnTimer = setTimeout(playIdle, 140);
    }
  }, 1000 / SPRITE_CONFIG.react.fps);
}

function pulsePet() {
  refs.petShell.classList.remove('react');
  void refs.petShell.offsetWidth;
  refs.petShell.classList.add('react');
  clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(
    () => refs.petShell.classList.remove('react'),
    EXPERIMENT_CONFIG.reactionHoldMs,
  );
}

function showBubble(text) {
  refs.bubble.textContent = text;
  refs.bubble.classList.remove('show');
  void refs.bubble.offsetWidth;
  refs.bubble.classList.add('show');
}

function hideBubble() {
  refs.bubble.classList.remove('show');
  refs.bubble.textContent = '';
}

function spawnSparks() {
  for (let index = 0; index < 4; index += 1) {
    const spark = document.createElement('span');
    const angle = (Math.PI * 2 * index) / 4 - Math.PI / 2;
    const radius = 26 + index * 5;
    spark.className = 'spark';
    spark.style.setProperty('--dx', `${Math.cos(angle) * radius}px`);
    spark.style.setProperty('--dy', `${Math.sin(angle) * radius - 18}px`);
    spark.style.animation = 'sparkFloat 820ms ease forwards';
    refs.scene.appendChild(spark);
    setTimeout(() => spark.remove(), 860);
  }
}

function isFailureRound() {
  return EXPERIMENT_CONFIG.failureRounds[state.failureLevel].includes(state.round);
}

function updateHud() {
  refs.counter.textContent = `第 ${state.round} / ${EXPERIMENT_CONFIG.rounds} 轮互动`;
  refs.prompt.textContent = EXPERIMENT_CONFIG.prompt[state.mode];
}

function setActionEnabled(enabled) {
  refs.petButton.disabled = !enabled || state.mode !== 'status';
  refs.food.disabled = !enabled || state.mode !== 'feed';
}

function setRoundDialogButtonVisible(visible) {
  refs.roundDialogButton.hidden = !visible;
}

function resetActionPosition() {
  if (state.mode !== 'feed') return;
  refs.food.classList.remove('hidden');
  setFoodOrigin();
}

function setFoodOrigin() {
  const x = Math.max(28, Math.min(window.innerWidth * 0.23, window.innerWidth / 2 - 260));
  const y = Math.max(104, window.innerHeight - 220);
  refs.food.style.left = `${Math.round(x)}px`;
  refs.food.style.top = `${Math.round(y)}px`;
  refs.food.style.bottom = 'auto';
  refs.food.style.transform = 'rotate(-8deg)';
}

function finishExperiment() {
  state.finished = true;
  state.waiting = false;
  state.dragging = false;
  state.pendingRound = null;
  clearTimeout(state.responseTimer);
  clearTimeout(state.nextRoundTimer);
  setActionEnabled(false);
  refs.counter.textContent = '第 8 / 8 轮互动';
  refs.prompt.textContent = '全部互动已结束！';
  refs.roundDialogTitle.textContent = '全部互动已结束！';
  refs.roundDialogNote.textContent = '感谢你的体验。';
  setRoundDialogButtonVisible(false);
  refs.roundDialog.classList.add('show');
}

function showNextRoundDialog() {
  if (state.round >= EXPERIMENT_CONFIG.rounds) {
    finishExperiment();
    return;
  }
  state.pendingRound = state.round + 1;
  state.waiting = false;
  setActionEnabled(false);
  refs.roundDialogTitle.textContent = '进入下一轮互动';
  refs.roundDialogNote.textContent = `上一轮互动已完成。请点击进入第 ${state.pendingRound} / ${EXPERIMENT_CONFIG.rounds} 轮互动。`;
  refs.roundDialogButton.textContent = '进入下一轮';
  refs.roundDialogButton.disabled = false;
  setRoundDialogButtonVisible(true);
  refs.roundDialog.classList.add('show');
  refs.roundDialogButton.focus();
}

function enterNextRound() {
  if (state.finished) return;
  if (!state.pendingRound || state.finished) return;
  state.round = state.pendingRound;
  state.pendingRound = null;
  refs.roundDialog.classList.remove('show');
  updateHud();
  resetActionPosition();
  setActionEnabled(true);
}

function advanceRound() {
  state.waiting = false;
  if (state.round >= EXPERIMENT_CONFIG.rounds) {
    finishExperiment();
    return;
  }
  showNextRoundDialog();
}

function respond(failed) {
  refs.scene.classList.remove('waiting');
  if (!failed) {
    pulsePet();
    playReaction();
    showBubble(EXPERIMENT_CONFIG.successText[state.mode]);
    spawnSparks();
  } else {
    hideBubble();
    playIdle();
  }

  state.log.push({
    round: state.round,
    mode: state.mode,
    failureLevel: state.failureLevel,
    failed,
    respondedAt: new Date().toISOString(),
  });

  const transitionDelay = failed
    ? EXPERIMENT_CONFIG.failureTransitionMs
    : EXPERIMENT_CONFIG.successHoldMs;
  state.nextRoundTimer = setTimeout(advanceRound, transitionDelay);
}

function startInteraction() {
  if (state.waiting || state.finished) return;
  state.waiting = true;
  setActionEnabled(false);
  hideBubble();
  clearTimeout(state.responseTimer);
  clearTimeout(state.nextRoundTimer);
  if (isFailureRound()) {
    refs.scene.classList.add('waiting');
    state.responseTimer = setTimeout(
      () => respond(true),
      EXPERIMENT_CONFIG.failureDelayMs,
    );
    return;
  }
  respond(false);
}

refs.petButton.addEventListener('click', startInteraction);
refs.roundDialogButton.addEventListener('click', enterNextRound);

refs.food.addEventListener('pointerdown', (event) => {
  if (state.mode !== 'feed' || state.waiting || state.finished) return;
  state.dragging = true;
  state.dragId = event.pointerId;
  refs.food.setPointerCapture(event.pointerId);
  const rect = refs.food.getBoundingClientRect();
  state.dragOffset = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
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

function endFoodDrag(event) {
  if (!state.dragging || event.pointerId !== state.dragId) return;
  state.dragging = false;
  refs.food.classList.remove('dragging');
  const petRect = refs.petHit.getBoundingClientRect();
  if (event.type === 'pointerup'
    && event.clientX >= petRect.left
    && event.clientX <= petRect.right
    && event.clientY >= petRect.top
    && event.clientY <= petRect.bottom) {
    refs.food.classList.add('hidden');
    startInteraction();
    return;
  }
  setFoodOrigin();
}

refs.food.addEventListener('pointerup', endFoodDrag);
refs.food.addEventListener('pointercancel', endFoodDrag);

updateHud();
setActionEnabled(true);
if (state.mode === 'feed') setFoodOrigin();
playIdle();

window.FailureExperiment = {
  CONFIG: EXPERIMENT_CONFIG,
  state,
  startInteraction,
};
