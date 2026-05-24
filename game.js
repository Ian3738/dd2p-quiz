'use strict';

// ===== 全域狀態 =====
const state = {
  quizzes: [],          // 所有題庫
  currentQuiz: null,    // 目前選的題庫
  currentSetup: {
    count: 20,
    order: 'shuffle',
    mode: 'solo',       // 'solo' 單人 / 'battle' 二人對戰
  },
  session: null,        // 進行中的作答 session（單人）
  battle: null,         // 進行中的對戰 session
};

// ===== 公用 =====
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${id}`));
  window.scrollTo(0, 0);
}

// 點擊 [data-go="xxx"] 切畫面（綁定一次）
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go]');
  if (t) showScreen(t.dataset.go);
});

// ===== 注音格式渲染 =====
// 原版格式: [字ㄅㄆㄇ]、[ㄅㄆㄇ]（只有注音）
// 用 <ruby>...<rt>...</rt></ruby>
const BOPOMOFO_RE = /\[([^\]]+)\]/g;
const BOPOMOFO_CHAR_RE = /[ㄅ-ㄩ˙ˊˇˋ]/;
// 注音符號範圍：ㄅㄆㄇ...; 聲調符號: ˙ˊˇˋ

function renderBopomofo(text) {
  if (!text) return '';
  // 若沒有方括號就直接 escape
  if (!text.includes('[')) return escapeHtml(text);
  return text.replace(BOPOMOFO_RE, (match, inner) => {
    // 分離「漢字」與「注音」
    let han = '';
    let bopo = '';
    for (const ch of inner) {
      if (BOPOMOFO_CHAR_RE.test(ch)) bopo += ch;
      else han += ch;
    }
    if (han && bopo) {
      return `<ruby>${escapeHtml(han)}<rt>${escapeHtml(bopo)}</rt></ruby>`;
    }
    if (bopo) {
      // 純注音
      return `<ruby><rb>　</rb><rt>${escapeHtml(bopo)}</rt></ruby>`;
    }
    return escapeHtml(han || inner);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== 載入題庫 =====
async function loadQuizzes() {
  const res = await fetch('quizzes.json');
  if (!res.ok) throw new Error('找不到 quizzes.json');
  const data = await res.json();
  state.quizzes = data.quizzes || [];
}

// ===== 題庫列表 =====
function renderCategoryList(filter = '') {
  const ul = $('#category-list');
  ul.innerHTML = '';
  const kw = filter.trim().toLowerCase();
  const items = state.quizzes.filter(q =>
    !kw || q.name.toLowerCase().includes(kw) || q.id.toLowerCase().includes(kw)
  );
  if (items.length === 0) {
    const li = document.createElement('li');
    li.className = 'category-item';
    li.innerHTML = `<div class="ci-name" style="color:var(--text-muted)">找不到符合的題庫</div>`;
    ul.appendChild(li);
    return;
  }
  for (const q of items) {
    const li = document.createElement('li');
    li.className = 'category-item';
    const hasImg = q.questions.some(x => x.q_image || x.option_images);
    const isBopo = q.txt_flag === 3;
    const tag = isBopo ? '注音' : (hasImg ? '圖文' : '');
    li.innerHTML = `
      <div class="ci-name">${escapeHtml(q.name)}</div>
      ${tag ? `<span class="ci-tag">${tag}</span>` : ''}
      <span class="ci-count">${q.total} 題</span>
    `;
    li.addEventListener('click', () => openSetup(q));
    ul.appendChild(li);
  }
}

// ===== 開啟設定畫面 =====
function openSetup(quiz) {
  state.currentQuiz = quiz;
  $('#setup-title').textContent = quiz.name;
  $('#setup-meta').innerHTML =
    `共 <b>${quiz.total}</b> 題` +
    (quiz.txt_flag === 3 ? '·含注音' : '') +
    (quiz.questions.some(x => x.q_image || x.option_images) ? '·含圖片題' : '');

  // 題數選項
  const seg = $('#setup-count');
  seg.innerHTML = '';
  const candidates = [10, 20, 30, 50, quiz.total].filter((v, i, a) =>
    v > 0 && v <= quiz.total && a.indexOf(v) === i
  );
  const defaultCount = Math.min(20, quiz.total);
  state.currentSetup.count = defaultCount;
  for (const n of candidates) {
    const b = document.createElement('button');
    b.dataset.val = n;
    b.textContent = n === quiz.total ? `全部 (${n})` : n;
    if (n === defaultCount) b.classList.add('active');
    b.addEventListener('click', () => {
      $$('button', seg).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.currentSetup.count = n;
    });
    seg.appendChild(b);
  }

  // 預設順序
  const orderSeg = $('#setup-order');
  $$('button', orderSeg).forEach(b => {
    b.classList.toggle('active', b.dataset.val === state.currentSetup.order);
  });
  // 預設模式
  const modeSeg = $('#setup-mode');
  $$('button', modeSeg).forEach(b => {
    b.classList.toggle('active', b.dataset.val === state.currentSetup.mode);
  });
  updateBattleHint();
  showScreen('setup');
}

function updateBattleHint() {
  $('#setup-battle-hint').hidden = state.currentSetup.mode !== 'battle';
}

// 順序切換
$('#setup-order').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  $$('button', e.currentTarget).forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  state.currentSetup.order = b.dataset.val;
});

// 模式切換
$('#setup-mode').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  $$('button', e.currentTarget).forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  state.currentSetup.mode = b.dataset.val;
  updateBattleHint();
});

$('#setup-start').addEventListener('click', () => {
  if (!state.currentQuiz) return;
  if (state.currentSetup.mode === 'battle') {
    startBattle(state.currentQuiz, state.currentSetup);
  } else {
    startSession(state.currentQuiz, state.currentSetup);
  }
});

// ===== 答題流程 =====
function startSession(quiz, setup, questionsOverride = null) {
  let qs = questionsOverride || quiz.questions.slice();
  if (setup.order === 'shuffle') {
    shuffleInPlace(qs);
  }
  if (!questionsOverride) {
    qs = qs.slice(0, setup.count);
  }
  state.session = {
    quiz,
    questions: qs,
    idx: 0,
    correct: 0,
    wrong: 0,
    wrongList: [],
    locked: false,
  };
  renderQuestion();
  showScreen('quiz');
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function renderQuestion() {
  const s = state.session;
  const q = s.questions[s.idx];
  s.locked = false;

  $('#q-index').textContent = String(s.idx + 1);
  $('#q-total').textContent = String(s.questions.length);
  $('#q-bar-fill').style.width = `${((s.idx) / s.questions.length) * 100}%`;
  $('#score-correct').textContent = String(s.correct);
  $('#score-wrong').textContent = String(s.wrong);
  $('#q-feedback').textContent = '';
  $('#q-feedback').className = 'feedback';
  $('#q-next').hidden = true;

  // 題幹
  $('#q-text').innerHTML = renderBopomofo(q.q);

  // 題幹圖
  const imgWrap = $('#q-image-wrap');
  const img = $('#q-image');
  if (q.q_image) {
    img.src = q.q_image;
    img.onerror = () => { imgWrap.hidden = true; };
    imgWrap.hidden = false;
  } else {
    imgWrap.hidden = true;
    img.removeAttribute('src');
  }

  // 選項
  const opts = $('#q-options');
  opts.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'opt';
    btn.type = 'button';
    btn.dataset.idx = i + 1;
    const letter = String.fromCharCode('A'.charCodeAt(0) + i);
    const optImg = q.option_images && q.option_images[i];
    btn.innerHTML = `
      <span class="opt-letter">${letter}</span>
      <span class="opt-body">
        ${opt ? `<span>${renderBopomofo(opt)}</span>` : ''}
        ${optImg ? `<img alt="選項${letter}" src="${escapeHtml(optImg)}" />` : ''}
      </span>
    `;
    btn.addEventListener('click', () => onAnswer(i + 1, btn));
    opts.appendChild(btn);
  });
}

function onAnswer(picked, btn) {
  const s = state.session;
  if (s.locked) return;
  s.locked = true;
  const q = s.questions[s.idx];

  // 標示所有選項
  const allBtns = $$('#q-options .opt');
  allBtns.forEach((b) => b.classList.add('disabled'));
  const correctBtn = allBtns[q.answer - 1];

  if (picked === q.answer) {
    s.correct++;
    btn.classList.add('correct');
    $('#q-feedback').textContent = '答對了！';
    $('#q-feedback').className = 'feedback right';
  } else {
    s.wrong++;
    btn.classList.add('wrong');
    if (correctBtn) correctBtn.classList.add('correct');
    s.wrongList.push(q);
    $('#q-feedback').textContent = `答錯了。正解：${String.fromCharCode(64 + q.answer)}`;
    $('#q-feedback').className = 'feedback wrong-text';
  }

  $('#score-correct').textContent = String(s.correct);
  $('#score-wrong').textContent = String(s.wrong);
  $('#q-next').hidden = false;
  $('#q-next').textContent = (s.idx + 1 >= s.questions.length) ? '看結算' : '下一題';
}

$('#q-next').addEventListener('click', () => {
  const s = state.session;
  if (!s) return;
  s.idx++;
  if (s.idx >= s.questions.length) {
    showResult();
  } else {
    renderQuestion();
  }
});

$('#quiz-quit').addEventListener('click', () => {
  if (!state.session) return showScreen('home');
  if (confirm('確定要結束本次作答？')) {
    state.session = null;
    showScreen('categories');
  }
});

// ===== 結算 =====
function showResult() {
  const s = state.session;
  if (!s) return;
  const total = s.questions.length;
  const rate = total ? Math.round((s.correct / total) * 100) : 0;

  // 從對戰樣式還原
  $('#screen-result').classList.remove('is-battle');
  $('#result-retry').textContent = '再玩一次';
  $$('#screen-result .result-actions [data-go="categories"]').forEach(b => {
    b.textContent = '換一個題庫';
  });
  $$('#screen-result .result-actions [data-go="home"]').forEach(b => {
    b.textContent = '回主選單';
  });
  // stat 標籤還原
  const stats = document.querySelectorAll('#screen-result .stat-label');
  if (stats[0]) stats[0].textContent = '答對';
  if (stats[1]) stats[1].textContent = '答錯';
  if (stats[2]) stats[2].textContent = '正確率';

  $('#result-correct').textContent = s.correct;
  $('#result-wrong').textContent = s.wrong;
  $('#result-rate').textContent = `${rate}%`;
  $('#result-name').textContent = s.quiz.name;

  let medal = '🎉';
  let title = '完成！';
  if (rate === 100) { medal = '🏆'; title = '滿分通關！'; }
  else if (rate >= 80) { medal = '🥇'; title = '表現很棒！'; }
  else if (rate >= 60) { medal = '🥈'; title = '不錯哦~'; }
  else if (rate >= 40) { medal = '🥉'; title = '繼續加油！'; }
  else { medal = '💪'; title = '再來一次！'; }
  $('#result-medal').textContent = medal;
  $('#result-title').textContent = title;

  $('#result-wrongs').hidden = s.wrongList.length === 0;
  showScreen('result');
}

$('#result-retry').addEventListener('click', () => {
  if (!state.currentQuiz) return showScreen('categories');
  if (state.currentSetup.mode === 'battle') {
    startBattle(state.currentQuiz, state.currentSetup);
  } else {
    startSession(state.currentQuiz, state.currentSetup);
  }
});

$('#result-wrongs').addEventListener('click', () => {
  const s = state.session;
  if (!s || !s.wrongList.length) return;
  startSession(s.quiz, state.currentSetup, s.wrongList.slice());
});

// ===== ⚔️ 二人對戰模式 =====
// 鍵盤映射（一個位置 → 答案 idx 1~4）
const P1_KEYS = {
  '1': 1, '2': 2, '3': 3, '4': 4,
  'a': 1, 's': 2, 'd': 3, 'f': 4,
  'A': 1, 'S': 2, 'D': 3, 'F': 4,
};
const P2_KEYS = {
  '0': 1, '-': 2, '=': 3, '\\': 4,
  'j': 1, 'k': 2, 'l': 3, ';': 4,
  'J': 1, 'K': 2, 'L': 3, ':': 4,  // shift+; 是 :
};

const BATTLE_CONFIG = {
  MAX_HP: 100,
  RIGHT_DAMAGE: 25,   // 答對讓對方扣的 HP
  WRONG_DAMAGE: 10,   // 答錯自己扣的 HP
};

function startBattle(quiz, setup) {
  let qs = quiz.questions.slice();
  if (setup.order === 'shuffle') shuffleInPlace(qs);
  qs = qs.slice(0, setup.count);

  state.battle = {
    quiz,
    questions: qs,
    idx: 0,
    p1: { hp: BATTLE_CONFIG.MAX_HP, pick: null, correct: 0, wrong: 0 },
    p2: { hp: BATTLE_CONFIG.MAX_HP, pick: null, correct: 0, wrong: 0 },
    revealed: false,
    over: false,
  };
  $('#b-total').textContent = String(qs.length);
  renderBattleRound();
  showScreen('battle');
}

function renderBattleRound() {
  const b = state.battle;
  if (!b) return;
  const q = b.questions[b.idx];

  // 重置回合狀態
  b.p1.pick = null;
  b.p2.pick = null;
  b.revealed = false;

  $('#b-round').textContent = String(b.idx + 1);
  updateBattleHpUI();
  $('#b-banner').textContent = '';
  $('#b-banner').className = 'bbanner';
  $('#b-next').hidden = true;

  // 題目
  $('#b-q-text').innerHTML = renderBopomofo(q.q);

  // 題幹圖
  const imgWrap = $('#b-q-image-wrap');
  const img = $('#b-q-image');
  if (q.q_image) {
    img.src = q.q_image;
    img.onerror = () => { imgWrap.hidden = true; };
    imgWrap.hidden = false;
  } else {
    imgWrap.hidden = true;
    img.removeAttribute('src');
  }

  // 選項（中央共用）
  const opts = $('#b-options');
  opts.innerHTML = '';
  q.options.forEach((opt, i) => {
    const idx = i + 1;
    const num = String.fromCharCode(64 + idx); // A B C D
    // P1/P2 對應的鍵
    const p1k = ['1', '2', '3', '4'][i] || '';
    const p2k = ['0', '-', '=', '\\'][i] || '';
    const div = document.createElement('div');
    div.className = 'bopt';
    div.dataset.idx = idx;
    div.innerHTML = `
      <span class="bopt-num">${num}</span>
      <span class="bopt-body">${renderBopomofo(opt) || ''}</span>
      <span class="bopt-keys">
        <span class="k-p1"><b>P1</b> ${p1k}</span>
        <span class="k-p2"><b>P2</b> ${p2k}</span>
      </span>
    `;
    opts.appendChild(div);
  });

  // 狀態
  setBStatus('p1', '等候作答…', '');
  setBStatus('p2', '等候作答…', '');

  // 角色回到「待機」狀態 + 隱藏對白框/特效
  resetFighters();
}

function resetFighters() {
  for (const id of ['p1-fighter', 'p2-fighter']) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hurt', 'victory', 'ko');
  }
  for (const id of ['b-bubble-p1', 'b-bubble-p2', 'b-hit-p1', 'b-hit-p2']) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
}

function setBStatus(player, text, cls) {
  const el = $(`#b-${player}-status`);
  el.textContent = text;
  el.className = `bstatus ${player} ${cls || ''}`.trim();
}

function updateBattleHpUI() {
  const b = state.battle;
  const p1pct = Math.max(0, b.p1.hp);
  const p2pct = Math.max(0, b.p2.hp);
  $('#p1-hp-fill').style.width = `${p1pct}%`;
  $('#p2-hp-fill').style.width = `${p2pct}%`;
}

function battlePick(player, idx) {
  const b = state.battle;
  if (!b || b.revealed || b.over) return;
  if (b[player].pick != null) return; // 已選
  const q = b.questions[b.idx];
  if (idx < 1 || idx > q.options.length) return;
  b[player].pick = idx;
  // 在對應選項標記
  const opt = $(`.bopt[data-idx="${idx}"]`);
  if (opt) {
    if (!opt.querySelector(`.lock-${player}`)) {
      const tag = document.createElement('span');
      tag.className = `lock-${player}`;
      tag.textContent = player.toUpperCase();
      opt.appendChild(tag);
    }
  }
  setBStatus(player, '已鎖定 ✓', 'locked');

  // 雙方都選了 → 揭曉
  if (b.p1.pick != null && b.p2.pick != null) {
    setTimeout(revealBattleRound, 350);
  }
}

function revealBattleRound() {
  const b = state.battle;
  if (!b || b.revealed) return;
  b.revealed = true;
  const q = b.questions[b.idx];
  const correct = q.answer;

  // 標示對錯
  $$('.bopt').forEach((el) => {
    const idx = parseInt(el.dataset.idx, 10);
    if (idx === correct) el.classList.add('reveal-correct');
    if ((idx === b.p1.pick || idx === b.p2.pick) && idx !== correct) {
      el.classList.add('reveal-wrong');
    }
  });

  const p1Right = b.p1.pick === correct;
  const p2Right = b.p2.pick === correct;

  // 計分 / 扣 HP
  let p1Lose = 0, p2Lose = 0;
  if (p1Right) { b.p1.correct++; p2Lose += BATTLE_CONFIG.RIGHT_DAMAGE; }
  else         { b.p1.wrong++;   p1Lose += BATTLE_CONFIG.WRONG_DAMAGE; }
  if (p2Right) { b.p2.correct++; p1Lose += BATTLE_CONFIG.RIGHT_DAMAGE; }
  else         { b.p2.wrong++;   p2Lose += BATTLE_CONFIG.WRONG_DAMAGE; }

  // 顯示狀態
  setBStatus('p1', p1Right ? '答對！' : '答錯…', p1Right ? 'right' : 'wrong');
  setBStatus('p2', p2Right ? '答對！' : '答錯…', p2Right ? 'right' : 'wrong');

  // banner + 場景動畫
  const banner = $('#b-banner');
  if (p1Right && !p2Right) {
    banner.textContent = 'P1 PERFECT! ⚡';
    banner.className = 'bbanner p1-win';
    fighterCheer('p1');
    fighterHurt('p2');
    showHit('p2', 'POW!');
  } else if (p2Right && !p1Right) {
    banner.textContent = 'P2 PERFECT! ⚡';
    banner.className = 'bbanner p2-win';
    fighterCheer('p2');
    fighterHurt('p1');
    showHit('p1', 'BAM!');
  } else if (p1Right && p2Right) {
    banner.textContent = 'DOUBLE HIT! 🔥';
    banner.className = 'bbanner tie';
    fighterCheer('p1');
    fighterCheer('p2');
    showHit('p1', 'POW!');
    showHit('p2', 'BAM!');
  } else {
    banner.textContent = 'BOTH MISS… 💢';
    banner.className = 'bbanner both-wrong';
    fighterHurt('p1');
    fighterHurt('p2');
  }

  // 套用 HP
  setTimeout(() => {
    b.p1.hp = Math.max(0, b.p1.hp - p1Lose);
    b.p2.hp = Math.max(0, b.p2.hp - p2Lose);
    updateBattleHpUI();

    // 檢查 KO
    if (b.p1.hp <= 0 || b.p2.hp <= 0) {
      b.over = true;
      setTimeout(showKO, 650);
    } else if (b.idx + 1 >= b.questions.length) {
      // 題目用完 → 結算
      b.over = true;
      setTimeout(showBattleResult, 800);
    } else {
      $('#b-next').hidden = false;
    }
  }, 380);
}

// 攻擊命中：在 target 旁邊跳出 POW / BAM 文字
function showHit(target, text) {
  const id = target === 'p1' ? '#b-hit-p1' : '#b-hit-p2';
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  // 重啟動畫
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  setTimeout(() => { el.hidden = true; }, 700);
}

// 角色受傷：搖動 + HP 條也搖
function fighterHurt(player) {
  const f = $(`#${player}-fighter`);
  const hp = $(`.${player}-hp`);
  for (const el of [f]) {
    if (!el) continue;
    el.classList.remove('hurt');
    void el.offsetWidth;
    el.classList.add('hurt');
    setTimeout(() => el.classList.remove('hurt'), 600);
  }
  if (hp) {
    hp.style.animation = 'none';
    void hp.offsetWidth;
    hp.style.animation = 'hp-shake 0.4s ease';
    setTimeout(() => hp.style.animation = '', 450);
  }
}

// 答對：彈跳
function fighterCheer(player) {
  const f = $(`#${player}-fighter`);
  if (!f) return;
  f.classList.remove('victory');
  void f.offsetWidth;
  f.classList.add('victory');
  setTimeout(() => f.classList.remove('victory'), 600);
}

// KO 對白框台詞（隨機挑）
const KO_LINES = [
  'SOMEBODY CALL 119 PLEASE…',
  '我…我輸了…',
  '太強了吧…',
  '下次再戰！',
  '不可能…',
  '居然會輸…',
];
const WIN_LINES = [
  '勝負已定！',
  'YOU LOSE!',
  '哈哈哈！',
  '太弱了吧！',
  'GG!',
];

function showKO() {
  const b = state.battle;
  // 先讓被 KO 的角色倒下、勝者勝利姿勢、跳對白框
  const p1Down = b.p1.hp <= 0;
  const p2Down = b.p2.hp <= 0;
  const f1 = $('#p1-fighter');
  const f2 = $('#p2-fighter');
  const bub1 = $('#b-bubble-p1');
  const bub2 = $('#b-bubble-p2');
  const bub1t = $('#b-bubble-p1-text');
  const bub2t = $('#b-bubble-p2-text');

  if (p1Down) {
    f1.classList.add('ko');
    bub1t.textContent = KO_LINES[Math.floor(Math.random() * KO_LINES.length)];
    bub1.hidden = false;
  }
  if (p2Down) {
    f2.classList.add('ko');
    bub2t.textContent = KO_LINES[Math.floor(Math.random() * KO_LINES.length)];
    bub2.hidden = false;
  }
  if (p1Down && !p2Down) {
    f2.classList.add('victory');
    bub2t.textContent = WIN_LINES[Math.floor(Math.random() * WIN_LINES.length)];
    bub2.hidden = false;
  }
  if (p2Down && !p1Down) {
    f1.classList.add('victory');
    bub1t.textContent = WIN_LINES[Math.floor(Math.random() * WIN_LINES.length)];
    bub1.hidden = false;
  }

  // 0.5 秒後跳出 K.O. overlay
  setTimeout(() => {
    const overlay = $('#ko-overlay');
    const text = $('#ko-text');
    let label = 'K.O.';
    if (p1Down && p2Down) label = 'DRAW';
    text.textContent = label;
    overlay.hidden = false;
    // 1.8 秒後跳結算
    setTimeout(() => {
      overlay.hidden = true;
      showBattleResult();
    }, 1800);
  }, 500);
}

function showBattleResult() {
  const b = state.battle;
  if (!b) return;
  // 判勝負
  let winner = null;
  if (b.p1.hp > b.p2.hp) winner = 'p1';
  else if (b.p2.hp > b.p1.hp) winner = 'p2';
  else winner = 'draw';

  let medal = '⚔️';
  let title = '對戰結束';
  if (winner === 'p1') { medal = '🏆'; title = 'P1 WIN!'; }
  else if (winner === 'p2') { medal = '🏆'; title = 'P2 WIN!'; }
  else { medal = '🤝'; title = 'DRAW'; }
  $('#result-medal').textContent = medal;
  $('#result-title').textContent = title;
  $('#result-name').textContent = `${b.quiz.name} · ⚔️ 對戰模式`;

  // 結算用三欄：P1分數 / P2分數 / 回合數
  $('#result-correct').textContent = `${b.p1.correct} vs ${b.p2.correct}`;
  $('#result-wrong').textContent = `${b.p1.hp} vs ${b.p2.hp}`;
  $('#result-rate').textContent = `${b.idx + 1}/${b.questions.length}`;

  // 修改 stat 標籤
  const stats = document.querySelectorAll('#screen-result .stat-label');
  if (stats[0]) stats[0].textContent = '答對 P1 vs P2';
  if (stats[1]) stats[1].textContent = 'HP P1 vs P2';
  if (stats[2]) stats[2].textContent = '完成回合';

  // 紅白機四色按鈕：重新再玩 / 到主選單 / 換一個題庫
  $('#result-wrongs').hidden = true;
  $('#screen-result').classList.add('is-battle');
  $('#result-retry').innerHTML = '重新再玩<span class="en">RESTART</span>';
  $$('#screen-result .result-actions [data-go="categories"]').forEach(b => {
    b.innerHTML = '到前一選單<span class="en">PREV MENU</span>';
  });
  $$('#screen-result .result-actions [data-go="home"]').forEach(b => {
    b.innerHTML = '到主選單<span class="en">MAIN MENU</span>';
  });
  showScreen('result');
  state.battle = null;
}

$('#b-next').addEventListener('click', () => {
  const b = state.battle;
  if (!b) return;
  b.idx++;
  if (b.idx >= b.questions.length || b.over) {
    showBattleResult();
  } else {
    renderBattleRound();
  }
});

$('#b-quit').addEventListener('click', () => {
  if (!state.battle) return showScreen('home');
  if (confirm('確定要結束本場對戰？')) {
    state.battle = null;
    showScreen('categories');
  }
});

// ===== 搜尋 =====
$('#search-input').addEventListener('input', (e) => {
  renderCategoryList(e.target.value);
});

// ===== 鍵盤操作（Mac / 桌面） =====
// 在答題畫面：1/2/3/4 或 A/B/C/D 選答案；Enter/Space 下一題；Esc 退出
// 在結算畫面：Enter 再玩一次；Esc 回題庫
// 在主選單：Enter 開始遊戲
// 在題庫列表：Enter 選第一個；Esc 回主選單
document.addEventListener('keydown', (e) => {
  // 焦點在輸入框時不處理
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  const active = document.querySelector('.screen.active')?.id;
  const key = e.key;
  const upper = key.length === 1 ? key.toUpperCase() : key;

  if (active === 'screen-battle') {
    // P1
    if (P1_KEYS[key] !== undefined) {
      battlePick('p1', P1_KEYS[key]);
      e.preventDefault();
      return;
    }
    // P2
    if (P2_KEYS[key] !== undefined) {
      battlePick('p2', P2_KEYS[key]);
      e.preventDefault();
      return;
    }
    if (key === 'Enter' || key === ' ') {
      const n = $('#b-next');
      if (n && !n.hidden) {
        n.click();
        e.preventDefault();
      }
      return;
    }
    if (key === 'Escape') {
      $('#b-quit')?.click();
      e.preventDefault();
      return;
    }
  } else if (active === 'screen-quiz') {
    // 數字 1-4 或 字母 A-D 選答案
    let idx = -1;
    if (key >= '1' && key <= '9') idx = parseInt(key, 10);
    else if (upper >= 'A' && upper <= 'D') idx = upper.charCodeAt(0) - 64;
    if (idx > 0) {
      const btn = document.querySelector(`.opt[data-idx="${idx}"]:not(.disabled)`);
      if (btn) {
        btn.click();
        e.preventDefault();
        return;
      }
    }
    if (key === 'Enter' || key === ' ') {
      const next = document.querySelector('#q-next');
      if (next && !next.hidden) {
        next.click();
        e.preventDefault();
      }
      return;
    }
    if (key === 'Escape') {
      document.querySelector('#quiz-quit')?.click();
      e.preventDefault();
      return;
    }
  } else if (active === 'screen-result') {
    if (key === 'Enter') {
      document.querySelector('#result-retry')?.click();
      e.preventDefault();
    } else if (key === 'Escape') {
      showScreen('categories');
      e.preventDefault();
    }
  } else if (active === 'screen-home') {
    if (key === 'Enter') {
      showScreen('categories');
      e.preventDefault();
    }
  } else if (active === 'screen-categories') {
    if (key === 'Escape') {
      showScreen('home');
      e.preventDefault();
    } else if (key === '/') {
      // 快速聚焦搜尋
      document.querySelector('#search-input')?.focus();
      e.preventDefault();
    }
  } else if (active === 'screen-setup') {
    if (key === 'Enter') {
      document.querySelector('#setup-start')?.click();
      e.preventDefault();
    } else if (key === 'Escape') {
      showScreen('categories');
      e.preventDefault();
    }
  } else if (active === 'screen-about') {
    if (key === 'Escape') {
      showScreen('home');
      e.preventDefault();
    }
  }
});

// ===== 啟動 =====
(async () => {
  try {
    await loadQuizzes();
    renderCategoryList();
  } catch (e) {
    console.error(e);
    alert('載入題庫失敗：' + e.message + '\n請確認用 local server 開啟（不要用 file:// 直接打開）。');
  }
})();

// 註冊 Service Worker（PWA 離線快取）— 只在 https 或 localhost 才會跑
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
