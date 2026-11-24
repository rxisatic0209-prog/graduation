const MESSAGES = {
  G0: '',
  G1: '抱歉，刚才是我的失误。',
  G2: '抱歉，刚才是我的失误。我把旁边角色的框误认成了你的目标框。',
  G3: '抱歉，刚才是我的失误。你希望怎样处理这次失误？',
  G4: '抱歉，刚才是我的失误。我把旁边角色的框误认成了你的目标框。你希望怎样处理这次失误？'
};

const BOBO_SVG = `
  <svg class="bobo" viewBox="0 0 210 270" role="img" aria-label="一只金色的 AI 宠物狗 Bobo">
    <ellipse class="dog-shadow" cx="105" cy="241" rx="61" ry="13" fill="rgba(0,0,0,.30)" />
    <g class="dog-body">
      <path d="M52 160 C42 184 44 232 60 245 L82 245 L87 187 Z" fill="#d98e21" />
      <path d="M158 160 C168 184 166 232 150 245 L128 245 L123 187 Z" fill="#d98e21" />
      <ellipse cx="105" cy="166" rx="57" ry="73" fill="#db942b" />
      <ellipse cx="105" cy="178" rx="33" ry="61" fill="#f8d88e" />
      <ellipse cx="74" cy="236" rx="19" ry="11" fill="#f6d489" />
      <ellipse cx="136" cy="236" rx="19" ry="11" fill="#f6d489" />
      <path d="M49 78 L55 24 Q60 9 76 31 L88 74 Z" fill="#c57916" />
      <path d="M161 78 L155 24 Q150 9 134 31 L122 74 Z" fill="#c57916" />
      <path d="M59 66 L62 35 Q65 26 76 44 L81 67 Z" fill="#e9948d" />
      <path d="M151 66 L148 35 Q145 26 134 44 L129 67 Z" fill="#e9948d" />
      <ellipse cx="105" cy="97" rx="59" ry="56" fill="#d98d22" />
      <ellipse cx="105" cy="120" rx="47" ry="43" fill="#f5cf82" />
      <path d="M87 61 Q105 47 123 61 L119 93 Q105 101 91 93 Z" fill="#ffe9b1" />
      <g class="dog-eyes">
        <ellipse cx="84" cy="99" rx="9" ry="11" fill="#4a2f20" />
        <ellipse cx="126" cy="99" rx="9" ry="11" fill="#4a2f20" />
        <circle cx="87" cy="95" r="3" fill="#fff" />
        <circle cx="129" cy="95" r="3" fill="#fff" />
      </g>
      <ellipse cx="105" cy="123" rx="13" ry="9" fill="#35251f" />
      <path d="M105 130 L105 139" stroke="#5c3822" stroke-width="3" stroke-linecap="round" />
      <path d="M105 139 Q91 137 87 147 Q101 163 105 148 Q109 163 123 147 Q119 137 105 139" fill="#e97872" />
      <path class="dog-paw-left" d="M52 169 Q27 187 50 199" fill="none" stroke="#d98e21" stroke-width="17" stroke-linecap="round" />
      <path class="dog-paw-right" d="M158 169 Q183 187 160 199" fill="none" stroke="#d98e21" stroke-width="17" stroke-linecap="round" />
    </g>
  </svg>`;

const SUCCESS = '本轮结果：球进入目标框（你）；传球成功。';
const BREACH = '本轮结果：球进入其他框（旁边角色）；未进入目标框（你）。';
const MIN_REPAIR_MS = 8000;
const app = document.querySelector('#app');
const params = new URLSearchParams(location.search);
const PAGE = document.body.dataset.page === 'formal' || location.pathname.endsWith('/formal.html') ? 'formal' : 'interaction';
const randomInt = max => Math.floor(Math.random() * max);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

let priorInteraction = null;
try {
  priorInteraction = JSON.parse(localStorage.getItem('study2-last-interaction') || 'null');
} catch {}

const pageGroup = document.body.dataset.group?.toUpperCase();
const queryGroup = params.get('group')?.toUpperCase();
const forcedGroup = Object.hasOwn(MESSAGES, pageGroup) ? pageGroup : queryGroup;
const data = {
  schema: 'study2-prototype-v3',
  page: PAGE,
  sessionId: params.get('session') || (PAGE === 'formal' && priorInteraction?.sessionId) || crypto.randomUUID(),
  startedAt: new Date().toISOString(),
  group: Object.hasOwn(MESSAGES, forcedGroup) ? forcedGroup : `G${randomInt(5)}`,
  groupSource: Object.hasOwn(MESSAGES, pageGroup) ? 'page' : Object.hasOwn(MESSAGES, queryGroup) ? 'query' : 'random',
  targetSide: 'left',
  testOverride: Boolean(queryGroup),
  rounds: [],
  repair: {},
  events: []
};

let round = 0;
let busy = false;
let repairTimer = null;

function log(event, extra = {}) {
  data.events.push({ event, at: new Date().toISOString(), ...extra });
}

function persist() {
  try {
    localStorage.setItem(`study2-last-${PAGE}`, JSON.stringify(data));
  } catch {}
}

function notifyParent(type, payload) {
  let origin = '*';
  try {
    if (document.referrer) origin = new URL(document.referrer).origin;
  } catch {}
  window.parent.postMessage({ type, sessionId: data.sessionId, ...payload }, origin);
}

function setStep(label) {
  data.currentStep = label;
}

function resetScroll() {
  window.scrollTo(0, 0);
}

function button(label, onClick, kind = 'primary') {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `btn ${kind}`;
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function renderIntro() {
  setStep(PAGE === 'formal' ? '正式任务准备' : '互动准备');
  if (PAGE === 'formal') {
    app.innerHTML = `
      <section class="intro-card">
        <p class="eyebrow">正式互动</p>
        <h1>继续和 Bobo 完成传球</h1>
        <p class="lead">请按照刚才的规则，把球传给 Bobo。它接住后应把球传入你面前的目标框。请观察每轮发生了什么。</p>
        <div class="actions" id="introActions"></div>
      </section>`;
    app.querySelector('#introActions').append(button('开始正式互动', () => {
      round = 1;
      renderGame('normal');
    }));
    return;
  }

  app.innerHTML = `
    <section class="intro-card">
      <p class="eyebrow">认识 Bobo</p>
      <h1>一只会和你互动的 AI 宠物狗</h1>
      <p class="lead">接下来，请先了解传球规则，再和 Bobo 练习一次传球。</p>
      <div class="actions" id="introActions"></div>
    </section>`;
  app.querySelector('#introActions').append(button('开始互动体验', renderInstructions));
}

function renderInstructions() {
  setStep('任务说明');
  log('instructions_opened');
  persist();
  app.innerHTML = `
    <section class="intro-card">
      <p class="eyebrow">互动规则</p>
      <h1>请记住你的目标框</h1>
      <p class="lead">你把球传给 Bobo；它接住后应把球传入你面前的目标框。</p>
      <p class="instruction-note">画面两侧有两个大小相同的框。绿色框标为“目标框（你）”，橙色框标为“其他框（旁边角色）”。请先练习一次。</p>
      <div class="actions" id="instructionActions"></div>
    </section>`;
  app.querySelector('#instructionActions').append(button('进入练习', () => renderGame('practice')));
  resetScroll();
}

function stageMarkup() {
  const target = data.targetSide;
  const other = target === 'left' ? 'right' : 'left';
  return `
    <section class="game-stage" id="stage" aria-label="Bobo 传球场景">
      <div class="basket goal ${target} green target" id="targetGoal" aria-label="目标框（你）"></div>
      <div class="basket goal ${other} orange other" id="otherGoal" aria-label="其他框（旁边角色）"></div>
      <span class="goal-label ${target} target">目标框（你）</span>
      <span class="goal-label ${other} other">其他框（旁边角色）</span>
      <div class="person ${target} user" id="thrower" aria-label="你"></div>
      <div class="person ${other} bystander" aria-label="旁边角色"></div>
      <span class="person-label ${target}">你</span>
      <span class="person-label ${other}">旁边角色</span>
      <div class="dog-wrap pet" id="pet">${BOBO_SVG}</div>
      <div class="ball" id="ball" aria-label="球" style="opacity:0"></div>
      <div class="game-actions" id="gameActions"></div>
    </section>`;
}

function gameTitle(mode) {
  if (mode === 'practice') return '练习传球';
  if (mode === 'breach') return '接下来的一轮传球';
  return `第 ${round} / 3 轮互动`;
}

function renderGame(mode) {
  busy = false;
  const title = gameTitle(mode);
  setStep(title);
  app.innerHTML = `
    <div class="experience">
      <header class="game-header">
        <span class="round-label">${title}</span>
        <span class="phase-label">${mode === 'practice' ? '练习阶段' : '传球合作阶段'}</span>
      </header>
      ${stageMarkup()}
      <p class="game-hint">点击“传球给 Bobo”，观察球最终进入哪个框。</p>
    </div>
    <dialog class="round-dialog" id="roundDialog" aria-labelledby="roundDialogTitle"></dialog>`;
  app.querySelector('#gameActions').append(button('传球给 Bobo', () => playRound(mode), 'pass-button'));
  app.querySelector('#roundDialog').addEventListener('cancel', event => event.preventDefault());
  placeBallAt(app.querySelector('#thrower'), true);
  resetScroll();
}

function pointAt(el, xFactor = .5, yFactor = .5) {
  const stage = app.querySelector('#stage');
  const ball = app.querySelector('#ball');
  const scene = stage.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left - scene.left + rect.width * xFactor - ball.offsetWidth / 2,
    y: rect.top - scene.top + rect.height * yFactor - ball.offsetHeight / 2
  };
}

function placeBallAt(el, fromPerson = false) {
  if (!el) return;
  const side = data.targetSide;
  const point = fromPerson
    ? pointAt(el, side === 'left' ? .95 : .05, .35)
    : pointAt(el);
  const ball = app.querySelector('#ball');
  ball.style.left = `${point.x}px`;
  ball.style.top = `${point.y}px`;
  ball.style.opacity = '1';
}

async function moveBallTo(el, duration = 850) {
  const ball = app.querySelector('#ball');
  const start = { x: parseFloat(ball.style.left), y: parseFloat(ball.style.top) };
  const end = pointAt(el, .5, el.id === 'pet' ? .54 : .5);
  const arc = Math.min(85, Math.max(42, Math.abs(end.x - start.x) * .19));
  const frames = [
    { left: `${start.x}px`, top: `${start.y}px`, transform: 'scale(1)', offset: 0 },
    { left: `${(start.x + end.x) / 2}px`, top: `${Math.min(start.y, end.y) - arc}px`, transform: 'scale(1.15)', offset: .5 },
    { left: `${end.x}px`, top: `${end.y}px`, transform: 'scale(1)', offset: 1 }
  ];
  if (ball.animate) {
    const animation = ball.animate(frames, { duration, easing: 'cubic-bezier(.25,.7,.2,1)' });
    await animation.finished;
    ball.style.left = `${end.x}px`;
    ball.style.top = `${end.y}px`;
    animation.cancel();
  } else {
    ball.style.left = `${end.x}px`;
    ball.style.top = `${end.y}px`;
    await wait(duration);
  }
}

const PET_MOTIONS = ['ready', 'catching', 'throw-left', 'throw-right', 'happy', 'sad'];
function setPetMotion(pet, motion) {
  pet.classList.remove(...PET_MOTIONS);
  void pet.offsetWidth;
  pet.classList.add(motion);
}

async function playRound(mode) {
  if (busy) return;
  busy = true;
  const actions = app.querySelector('#gameActions');
  actions.querySelector('button').disabled = true;
  const pet = app.querySelector('#pet');
  app.querySelector('#thrower').classList.add('throwing');
  setPetMotion(pet, 'ready');
  await moveBallTo(pet);
  setPetMotion(pet, 'catching');
  await wait(540);
  const breach = mode === 'breach';
  const goal = app.querySelector(breach ? '#otherGoal' : '#targetGoal');
  setPetMotion(pet, goal.classList.contains('left') ? 'throw-left' : 'throw-right');
  await moveBallTo(goal, 920);
  goal.classList.add('received');
  setPetMotion(pet, breach ? 'sad' : 'happy');
  await wait(650);

  log('round_complete', { mode, outcome: breach ? 'breach' : 'success' });
  data.rounds.push({ mode, outcome: breach ? 'other' : 'target', at: new Date().toISOString() });
  persist();
  const dialog = app.querySelector('#roundDialog');
  if (breach) {
    showRepairModal(dialog);
    return;
  }

  dialog.innerHTML = `
    <p class="eyebrow">传球反馈</p>
    <h2 id="roundDialogTitle" tabindex="-1">本轮传球结果</h2>
    <p class="result-message">${SUCCESS}</p>
    <div class="actions modal-actions" id="resultActions"></div>`;
  dialog.classList.add('result-only');
  const nextLabel = mode === 'practice' ? '完成练习' : round === 3 ? '继续传球' : '下一轮';
  dialog.querySelector('#resultActions').append(button(nextLabel, () => {
    dialog.close();
    if (mode === 'practice') {
      renderHandoff();
    } else if (round === 3) {
      round = 4;
      renderGame('breach');
    } else {
      round += 1;
      renderGame('normal');
    }
  }));
  dialog.showModal();
  dialog.querySelector('h2').focus();
}

function showRepairModal(dialog) {
  setStep('Bobo 回应');
  const hasChoice = data.group === 'G3' || data.group === 'G4';
  dialog.innerHTML = `
    <p class="eyebrow">${data.group === 'G0' ? '传球反馈' : '互动回应'}</p>
    <h2 id="roundDialogTitle" tabindex="-1">刚才的传球</h2>
    <p class="result-message">${BREACH}</p>
    ${data.group === 'G0' ? '' : `<div class="repair-message"><strong>Bobo 的回应</strong><p>${MESSAGES[data.group]}</p></div>`}
    <div id="repairChoices"></div>
    <p class="repair-wait" id="repairWait">请先阅读页面内容。</p>
    <div class="actions modal-actions" id="repairActions"></div>`;
  dialog.showModal();
  dialog.querySelector('h2').focus();
  data.repair.shownAt = new Date().toISOString();
  log('repair_shown');
  persist();

  const start = performance.now();
  const choices = dialog.querySelector('#repairChoices');
  const actions = dialog.querySelector('#repairActions');
  let chosen = null;
  let continueButton;

  if (hasChoice) {
    const options = [
      ['A', '取回刚才的球，重新传入我的目标框'],
      ['B', '先和我多互动几轮，熟悉我是谁、哪个是我的目标框']
    ];
    for (const [code, label] of options) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'choice';
      el.setAttribute('aria-pressed', 'false');
      el.innerHTML = `<b>${code}</b><span>${label}</span>`;
      el.addEventListener('click', () => {
        chosen = code;
        data.repair.choice = code;
        data.repair.choiceAt = new Date().toISOString();
        choices.querySelectorAll('.choice').forEach(choice => {
          choice.classList.toggle('selected', choice === el);
          choice.setAttribute('aria-pressed', String(choice === el));
        });
        persist();
        refreshWait();
      });
      choices.append(el);
    }
  }

  continueButton = button(hasChoice ? '确认选择并继续' : '继续', finishRepair);
  continueButton.disabled = true;
  actions.append(continueButton);
  refreshWait();
  repairTimer = setInterval(refreshWait, 200);

  function refreshWait() {
    const seconds = Math.max(0, Math.ceil((MIN_REPAIR_MS - (performance.now() - start)) / 1000));
    dialog.querySelector('#repairWait').textContent = seconds
      ? `请阅读页面内容，${seconds} 秒后可继续。`
      : '现在可以继续。';
    continueButton.disabled = Boolean(seconds || (hasChoice && !chosen));
    if (!seconds) clearInterval(repairTimer);
  }

  function finishRepair() {
    if (hasChoice && !chosen) return;
    clearInterval(repairTimer);
    data.repair.dwellMs = Math.round(performance.now() - start);
    data.repair.completedAt = new Date().toISOString();
    log('repair_complete', { choice: chosen, dwellMs: data.repair.dwellMs });
    persist();
    dialog.close();
    renderFormalHandoff();
  }
}

function renderHandoff() {
  setStep('互动结束');
  data.completedAt = new Date().toISOString();
  log('interaction_complete');
  persist();
  notifyParent('study2:interaction-complete', { targetSide: data.targetSide, rounds: data.rounds });
  app.innerHTML = `
    <section class="end-card">
      <p class="eyebrow">互动结束</p>
      <h1>传球练习已完成</h1>
    </section>`;
  resetScroll();
}

function renderFormalHandoff() {
  setStep('正式互动结束');
  data.completedAt = new Date().toISOString();
  log('formal_complete');
  persist();
  notifyParent('study2:formal-complete', {
    group: data.group,
    targetSide: data.targetSide,
    repair: data.repair
  });
  app.innerHTML = `
    <section class="end-card">
      <p class="eyebrow">正式互动结束</p>
      <h1>请继续填写后测问卷</h1>
    </section>`;
  resetScroll();
}

renderIntro();
