/**
 * ============================================================================
 * AITT Plus Ludo — Cyberpunk Edition (Game Engine)
 * المحرك البرمجي الرئيسي للعبة لودو: القواعد، الذكاء الاصطناعي، الرسوم، والأصوات
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. إدارة البيانات وحفظ التقدم (LocalStorage & State)
// ----------------------------------------------------------------------------
const STORAGE_KEY = 'AITT_LUDO_DATA_V2';

const defaultUserData = {
  name: 'Player 1',
  level: 1,
  coins: 1000,
  avatar: '🦊',
  sfx: true,
  music: true,
  vibration: true,
  difficulty: 'medium', // easy | medium | hard
  lang: 'ar'
};

function loadUserData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultUserData, ...JSON.parse(saved) } : { ...defaultUserData };
  } catch (e) {
    return { ...defaultUserData };
  }
}

function saveUserData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('فشل في حفظ البيانات:', e);
  }
}

let userState = loadUserData();

// ----------------------------------------------------------------------------
// 2. نظام المؤثرات الصوتية (Web Audio API بدون أي ملفات خارجية)
// ----------------------------------------------------------------------------
class SoundSystem {
  constructor() {
    this.ctx = null;
    this.initAudioContext();
  }

  initAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext && !this.ctx) {
      this.ctx = new AudioContext();
    }
  }

  ensureReady() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // صوت رمي النرد
  playDiceRoll() {
    if (!userState.sfx) return;
    this.initAudioContext();
    this.ensureReady();
    if (!this.ctx) return;

    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220 + Math.random() * 280, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
      }, i * 60);
    }
  }

  // صوت تحريك القطعة
  playMove() {
    if (!userState.sfx) return;
    this.initAudioContext();
    this.ensureReady();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  // صوت أكل قطعة خصم
  playCapture() {
    if (!userState.sfx) return;
    this.initAudioContext();
    this.ensureReady();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(587.33, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  // نغمة الفوز
  playVictory() {
    if (!userState.sfx) return;
    this.initAudioContext();
    this.ensureReady();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, High C
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
      }, idx * 160);
    });
  }

  // اهتزاز الهاتف
  vibrate(pattern = [40]) {
    if (userState.vibration && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }
}

const sounds = new SoundSystem();

// ----------------------------------------------------------------------------
// 3. مسار وخريطة اللودو الكلاسيكية (15x15 Grid System)
// ----------------------------------------------------------------------------
// إحداثيات المسار المشترك الرئيسي المكون من 52 خانة (X, Y على شبكة 15×15)
const MAIN_PATH_COORDS = [
  // مسار الذراع الأيسر باتجاه الأعلى
  {x:6,y:13},{x:6,y:12},{x:6,y:11},{x:6,y:10},{x:6,y:9},
  // التفاف نحو اليسار
  {x:5,y:8},{x:4,y:8},{x:3,y:8},{x:2,y:8},{x:1,y:8},{x:0,y:8},
  {x:0,y:7},{x:0,y:6},
  // الذراع الأيسر عودة لليمين
  {x:1,y:6},{x:2,y:6},{x:3,y:6},{x:4,y:6},{x:5,y:6},
  // للأعلى
  {x:6,y:5},{x:6,y:4},{x:6,y:3},{x:6,y:2},{x:6,y:1},{x:6,y:0},
  {x:7,y:0},{x:8,y:0},
  // للأسفل على اليمين
  {x:8,y:1},{x:8,y:2},{x:8,y:3},{x:8,y:4},{x:8,y:5},
  // لليمين
  {x:9,y:6},{x:10,y:6},{x:11,y:6},{x:12,y:6},{x:13,y:6},{x:14,y:6},
  {x:14,y:7},{x:14,y:8},
  // لليسار
  {x:13,y:8},{x:12,y:8},{x:11,y:8},{x:10,y:8},{x:9,y:8},
  // للأسفل نحو البداية
  {x:8,y:9},{x:8,y:10},{x:8,y:11},{x:8,y:12},{x:8,y:13},{x:8,y:14},
  {x:7,y:14},{x:6,y:14}
];

// نقاط البداية في المسار المشترك لكل لون من اللاعبين الأربعة
const PLAYER_CONFIG = [
  { id: 0, color: 'red', name: 'أنت', hex: '#ff3355', startIndex: 0, homeEntry: 50,
    homeCoords: [{x:2,y:11},{x:3,y:11},{x:2,y:12},{x:3,y:12}],
    winPath: [{x:7,y:13},{x:7,y:12},{x:7,y:11},{x:7,y:10},{x:7,y:9},{x:7,y:8}] },
  { id: 1, color: 'green', name: 'Cyborg-1', hex: '#33cc66', startIndex: 13, homeEntry: 11,
    homeCoords: [{x:2,y:2},{x:3,y:2},{x:2,y:3},{x:3,y:3}],
    winPath: [{x:1,y:7},{x:2,y:7},{x:3,y:7},{x:4,y:7},{x:5,y:7},{x:6,y:7}] },
  { id: 2, color: 'yellow', name: 'Nova-AI', hex: '#ffcc00', startIndex: 26, homeEntry: 24,
    homeCoords: [{x:11,y:2},{x:12,y:2},{x:11,y:3},{x:12,y:3}],
    winPath: [{x:7,y:1},{x:7,y:2},{x:7,y:3},{x:7,y:4},{x:7,y:5},{x:7,y:6}] },
  { id: 3, color: 'blue', name: 'Viper', hex: '#3399ff', startIndex: 39, homeEntry: 37,
    homeCoords: [{x:11,y:11},{x:12,y:11},{x:11,y:12},{x:12,y:12}],
    winPath: [{x:13,y:7},{x:12,y:7},{x:11,y:7},{x:10,y:7},{x:9,y:7},{x:8,y:7}] }
];

// الخانات الآمنة المشهورة (النجوم) التي لا يمكن أكل القطعة فيها
const SAFE_STEPS = [0, 8, 13, 21, 26, 34, 39, 47];

// ----------------------------------------------------------------------------
// 4. حالة اللعبة الجارية (Game State)
// ----------------------------------------------------------------------------
let gameState = {
  activeScreen: 'splash',
  currentTurn: 0, // 0: Player, 1: AI Green, 2: AI Yellow, 3: AI Blue
  diceValue: 6,
  isRolling: false,
  mustRoll: true,
  consecutiveSixes: 0,
  players: [],
  winner: null,
  ranks: []
};

function initNewMatch() {
  gameState.currentTurn = 0;
  gameState.diceValue = 6;
  gameState.isRolling = false;
  gameState.mustRoll = true;
  gameState.consecutiveSixes = 0;
  gameState.winner = null;
  gameState.ranks = [];

  gameState.players = PLAYER_CONFIG.map((cfg) => ({
    id: cfg.id,
    name: cfg.id === 0 ? userState.name : cfg.name,
    avatar: cfg.id === 0 ? userState.avatar : (['🤖', '🦁', '🐺'][cfg.id - 1] || '👾'),
    color: cfg.color,
    hex: cfg.hex,
    isHuman: cfg.id === 0,
    // كل لاعب يمتلك 4 قطع:
    // step = -1 يعني داخل البيت (Base)
    // 0 إلى 50 في المسار المشترك
    // 51 إلى 56 في مسار الفوز الداخلي
    // 57 وصلت المركز النهائي (Finished)
    tokens: [
      { id: 0, step: -1 },
      { id: 1, step: -1 },
      { id: 2, step: -1 },
      { id: 3, step: -1 }
    ]
  }));
}

// ----------------------------------------------------------------------------
// 5. محرك وقواعد اللودو (Move Logic & Rules)
// ----------------------------------------------------------------------------
function canTokenMove(player, token, dice) {
  if (token.step === 57) return false; // وصلت للبيت النهائي

  if (token.step === -1) {
    return dice === 6; // تخرج من البيت عند الحصول على 6 فقط
  }

  // الحد الأقصى للمسار هو 57 (المركز)
  return (token.step + dice) <= 57;
}

function getMovableTokens(player, dice) {
  return player.tokens.filter(t => canTokenMove(player, t, dice));
}

// حساب موقع القطعة الحقيقي (X, Y) للرسم واكتشاف النقرات
function getTokenCoord(playerIndex, token) {
  const pConf = PLAYER_CONFIG[playerIndex];
  if (token.step === -1) {
    return pConf.homeCoords[token.id];
  }
  if (token.step >= 51 && token.step <= 56) {
    return pConf.winPath[token.step - 51];
  }
  if (token.step === 57) {
    return { x: 7, y: 7 }; // المركز المشترك
  }
  // في المسار العام (0 - 50)
  const globalIndex = (pConf.startIndex + token.step) % 52;
  return MAIN_PATH_COORDS[globalIndex];
}

// فحص أكل قطع الخصوم
function checkCaptures(activePlayerIndex, movedToken) {
  if (movedToken.step < 0 || movedToken.step >= 51) return false;

  const targetCoord = getTokenCoord(activePlayerIndex, movedToken);
  const activeConf = PLAYER_CONFIG[activePlayerIndex];
  const globalStep = (activeConf.startIndex + movedToken.step) % 52;

  // الخانات الآمنة محصنة
  if (SAFE_STEPS.includes(globalStep)) return false;

  let captured = false;
  gameState.players.forEach((otherPlayer, pIdx) => {
    if (pIdx === activePlayerIndex) return;
    otherPlayer.tokens.forEach(tok => {
      if (tok.step >= 0 && tok.step < 51) {
        const otherCoord = getTokenCoord(pIdx, tok);
        if (otherCoord.x === targetCoord.x && otherCoord.y === targetCoord.y) {
          // تم الالتهام: إعادة القطعة لبيتها
          tok.step = -1;
          captured = true;
          sounds.playCapture();
          sounds.vibrate([80, 50, 80]);
          showToast(`⚡ قام ${gameState.players[activePlayerIndex].name} بأكل قطعة ${otherPlayer.name}!`);

          // إضافة نقاط مكافأة للاعب البشري عند الأكل
          if (activePlayerIndex === 0) {
            userState.coins += 5;
            saveUserData(userState);
            updateHeaderUI();
          }
        }
      }
    });
  });

  return captured;
}

// فحص فوز اللاعب
function checkPlayerVictory(player) {
  const allHome = player.tokens.every(t => t.step === 57);
  if (allHome && !gameState.ranks.includes(player.id)) {
    gameState.ranks.push(player.id);
    if (!gameState.winner) {
      gameState.winner = player;
    }
    return true;
  }
  return false;
}

// تنفيذ الحركة لقطعة معينة
function executeMove(token) {
  const activePlayer = gameState.players[gameState.currentTurn];
  const dice = gameState.diceValue;

  if (token.step === -1 && dice === 6) {
    token.step = 0; // خروج للمسار
  } else {
    token.step += dice;
  }

  sounds.playMove();
  sounds.vibrate([40]);
  renderBoard();
  updateHUD();

  // فحص الأكل
  const capturedSomeone = checkCaptures(gameState.currentTurn, token);

  // فحص الفوز
  if (checkPlayerVictory(activePlayer)) {
    if (activePlayer.id === 0) {
      // فوز اللاعب البشري
      userState.coins += 50;
      userState.level += 1;
      saveUserData(userState);
      updateHeaderUI();
      sounds.playVictory();
      showVictoryModal(true);
      return;
    } else if (gameState.ranks.length === 1) {
      // فاز روبوت بالمركز الأول
      showVictoryModal(false);
      return;
    }
  }

  // تحديد من يلعب التالي:
  // إذا حصل على 6 أو أكل قطعة، يحصل على رمية إضافية، وإلا ينتقل الدور للتالي
  if ((dice === 6 || capturedSomeone) && token.step !== 57) {
    gameState.mustRoll = true;
    showToast(`دور إضافي لـ ${activePlayer.name}! 🎲`);
    renderBoard();
    updateHUD();

    if (!activePlayer.isHuman) {
      setTimeout(handleAITurn, 900);
    }
  } else {
    passTurnToNext();
  }
}

function passTurnToNext() {
  gameState.consecutiveSixes = 0;
  gameState.mustRoll = true;

  // الانتقال للاعب التالي الذي لم ينتهِ بعد
  let next = (gameState.currentTurn + 1) % 4;
  while (gameState.ranks.includes(next) && gameState.ranks.length < 4) {
    next = (next + 1) % 4;
  }

  gameState.currentTurn = next;
  renderBoard();
  updateHUD();

  const nextPlayer = gameState.players[gameState.currentTurn];
  if (!nextPlayer.isHuman) {
    setTimeout(handleAITurn, 800);
  }
}

// ----------------------------------------------------------------------------
// 6. رمي النرد (Dice Rolling)
// ----------------------------------------------------------------------------
function rollDice() {
  if (gameState.isRolling || !gameState.mustRoll) return;

  const activePlayer = gameState.players[gameState.currentTurn];
  gameState.isRolling = true;
  sounds.playDiceRoll();

  const diceEl = document.getElementById('main-dice');
  const diceValEl = document.getElementById('dice-face-value');
  const diceWave = document.getElementById('dice-wave');

  diceEl.classList.add('rolling');
  if (diceWave) diceWave.classList.add('active');

  // تأثير اهتزاز وتغيير أرقام سريع أثناء الدوران
  let counter = 0;
  const interval = setInterval(() => {
    diceValEl.innerText = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][Math.floor(Math.random() * 6)];
    counter++;
    if (counter > 8) clearInterval(interval);
  }, 70);

  setTimeout(() => {
    diceEl.classList.remove('rolling');
    if (diceWave) diceWave.classList.remove('active');
    gameState.isRolling = false;

    // الرقم الفعلي للرمية
    const roll = Math.floor(Math.random() * 6) + 1;
    gameState.diceValue = roll;
    gameState.mustRoll = false;

    const diceChars = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    diceValEl.innerText = diceChars[roll - 1];

    if (roll === 6) {
      gameState.consecutiveSixes++;
      if (gameState.consecutiveSixes >= 3) {
        showToast('3 ستات متتالية! يُلغى الدور ⚠️');
        passTurnToNext();
        return;
      }
    } else {
      gameState.consecutiveSixes = 0;
    }

    const movable = getMovableTokens(activePlayer, roll);

    if (movable.length === 0) {
      showToast(`لا توجد حركات متاحة لـ ${activePlayer.name}`);
      setTimeout(passTurnToNext, 1000);
    } else if (movable.length === 1 && !activePlayer.isHuman) {
      // الذكاء الاصطناعي يتحرك تلقائياً
      setTimeout(() => executeMove(movable[0]), 600);
    } else if (movable.length === 1 && activePlayer.isHuman) {
      // حركة إجبارية واحدة للاعب البشري لتسريع اللعب
      setTimeout(() => executeMove(movable[0]), 400);
    } else if (activePlayer.isHuman) {
      showToast('اختر القطعة التي تريد تحريكها بالنقر عليها');
      renderBoard(); // وميض القطع القابلة للحركة
    } else {
      // ذكاء اصطناعي يختار من بين أكثر من قطعة
      setTimeout(() => makeAIDecision(activePlayer, movable, roll), 600);
    }
  }, 750);
}

// ----------------------------------------------------------------------------
// 7. خوارزميات الذكاء الاصطناعي (AI Strategies)
// ----------------------------------------------------------------------------
function handleAITurn() {
  if (gameState.players[gameState.currentTurn].isHuman) return;
  rollDice();
}

function makeAIDecision(aiPlayer, movableTokens, dice) {
  const diff = userState.difficulty;

  // 1. المستوى السهل: اختيار عشوائي تماماً
  if (diff === 'easy') {
    const pick = movableTokens[Math.floor(Math.random() * movableTokens.length)];
    executeMove(pick);
    return;
  }

  // 2. المستوى المتوسط: تفضيل أكل الخصوم ثم إخراج قطع جديدة ثم التقدم
  if (diff === 'medium') {
    // هل توجد حركة تمكّن من أكل قطعة؟
    for (const tok of movableTokens) {
      const nextStep = tok.step === -1 ? 0 : tok.step + dice;
      if (willCapture(aiPlayer.id, tok, nextStep)) {
        executeMove(tok);
        return;
      }
    }
    // إخراج قطعة جديدة إن أمكن
    const baseToken = movableTokens.find(t => t.step === -1);
    if (baseToken && dice === 6) {
      executeMove(baseToken);
      return;
    }
    // تحريك القطعة الأكثر تقدماً
    movableTokens.sort((a, b) => b.step - a.step);
    executeMove(movableTokens[0]);
    return;
  }

  // 3. المستوى الخبير (Hard): حساب احتمالات، حماية القطع، والوصول للهدف
  let bestToken = movableTokens[0];
  let highestScore = -999;

  movableTokens.forEach(tok => {
    let score = 0;
    const nextStep = tok.step === -1 ? 0 : tok.step + dice;

    // أولوية قصوى: إدخال قطعة للمركز النهائي
    if (nextStep === 57) score += 100;

    // أولوية كبرى: أكل قطعة خصم
    if (willCapture(aiPlayer.id, tok, nextStep)) score += 60;

    // تفضيل إخراج قطع البيت
    if (tok.step === -1 && dice === 6) score += 35;

    // الدخول للمسار الآمن الفائز
    if (nextStep >= 51) score += 25;

    // تفضيل التحرك إذا كان موقع القطعة الحالي مهدداً
    if (isUnderThreat(aiPlayer.id, tok)) score += 30;

    score += (nextStep * 0.5); // تفضيل التقدم

    if (score > highestScore) {
      highestScore = score;
      bestToken = tok;
    }
  });

  executeMove(bestToken);
}

function willCapture(pIdx, token, nextStep) {
  const pConf = PLAYER_CONFIG[pIdx];
  if (nextStep < 0 || nextStep >= 51) return false;
  const globalNext = (pConf.startIndex + nextStep) % 52;
  if (SAFE_STEPS.includes(globalNext)) return false;
  const targetCoord = MAIN_PATH_COORDS[globalNext];

  return gameState.players.some((other, idx) => {
    if (idx === pIdx) return false;
    return other.tokens.some(t => {
      if (t.step >= 0 && t.step < 51) {
        const c = getTokenCoord(idx, t);
        return c.x === targetCoord.x && c.y === targetCoord.y;
      }
      return false;
    });
  });
}

function isUnderThreat(pIdx, token) {
  if (token.step < 0 || token.step >= 51) return false;
  const currentCoord = getTokenCoord(pIdx, token);
  const pConf = PLAYER_CONFIG[pIdx];
  const globalStep = (pConf.startIndex + token.step) % 52;
  if (SAFE_STEPS.includes(globalStep)) return false;

  // فحص إن كان هناك خصم خلفه بمسافة 1-6 خانات
  return gameState.players.some((other, idx) => {
    if (idx === pIdx) return false;
    return other.tokens.some(t => {
      if (t.step >= 0 && t.step < 51) {
        const otherGlobal = (PLAYER_CONFIG[idx].startIndex + t.step) % 52;
        const dist = (globalStep - otherGlobal + 52) % 52;
        return dist >= 1 && dist <= 6;
      }
      return false;
    });
  });
}

// ----------------------------------------------------------------------------
// 8. رسم رقعة اللودو بالـ Canvas بنمط السايبربانك (Canvas Rendering)
// ----------------------------------------------------------------------------
let canvas, ctx;

function setupBoardCanvas() {
  canvas = document.getElementById('ludo-board');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  canvas.addEventListener('click', onCanvasClick);
  window.addEventListener('resize', () => renderBoard());
  renderBoard();
}

function renderBoard() {
  if (!ctx || !canvas) return;

  const size = canvas.width;
  const cellSize = size / 15;
  ctx.clearRect(0, 0, size, size);

  // 1. رسم شبكة الخلفية المظلمة
  ctx.fillStyle = '#080d24';
  ctx.fillRect(0, 0, size, size);

  // 2. رسم بيوت الزوايا الأربع (Homes)
  drawHomeZone(0, 9, PLAYER_CONFIG[0].hex, '🔴'); // أحمر (أسفل يسار)
  drawHomeZone(0, 0, PLAYER_CONFIG[1].hex, '🟢'); // أخضر (أعلى يسار)
  drawHomeZone(9, 0, PLAYER_CONFIG[2].hex, '🟡'); // أصفر (أعلى يمين)
  drawHomeZone(9, 9, PLAYER_CONFIG[3].hex, '🔵'); // أزرق (أسفل يمين)

  // 3. رسم الخانات والمسارات
  for (let x = 0; x < 15; x++) {
    for (let y = 0; y < 15; y++) {
      // تجاوز مربعات البيوت
      if ((x < 6 && y < 6) || (x > 8 && y < 6) || (x < 6 && y > 8) || (x > 8 && y > 8)) continue;
      // تجاوز مربع المركز
      if (x >= 6 && x <= 8 && y >= 6 && y <= 8) continue;

      drawCell(x, y, cellSize);
    }
  }

  // 4. تلوين المسارات الآمنة ومسارات الفوز الخاصة بكل لاعب
  paintSpecialPath(PLAYER_CONFIG[0].winPath, PLAYER_CONFIG[0].hex, cellSize);
  paintSpecialPath(PLAYER_CONFIG[1].winPath, PLAYER_CONFIG[1].hex, cellSize);
  paintSpecialPath(PLAYER_CONFIG[2].winPath, PLAYER_CONFIG[2].hex, cellSize);
  paintSpecialPath(PLAYER_CONFIG[3].winPath, PLAYER_CONFIG[3].hex, cellSize);

  // 5. رسم مركز اللوحة بشعار AITT
  drawCenterArea(size / 2, size / 2, cellSize * 1.5);

  // 6. رسم القطع الخاصة بجميع اللاعبين
  drawAllTokens(cellSize);
}

function drawHomeZone(gridX, gridY, colorHex, icon) {
  const cellSize = canvas.width / 15;
  const x = gridX * cellSize;
  const y = gridY * cellSize;
  const w = 6 * cellSize;

  ctx.fillStyle = 'rgba(13, 22, 45, 0.9)';
  ctx.fillRect(x, y, w, w);

  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 4, y + 4, w - 8, w - 8);

  // قاعدة دائرية داخل البيت
  ctx.beginPath();
  ctx.arc(x + w / 2, y + w / 2, w / 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCell(gx, gy, cellSize) {
  const px = gx * cellSize;
  const py = gy * cellSize;

  ctx.strokeStyle = 'rgba(0, 212, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, cellSize, cellSize);

  // فحص الخانات ذات النجوم الآمنة
  const isSafe = MAIN_PATH_COORDS.some((coord, idx) => coord.x === gx && coord.y === gy && SAFE_STEPS.includes(idx));
  if (isSafe) {
    ctx.fillStyle = 'rgba(0, 212, 255, 0.12)';
    ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
    ctx.fillStyle = '#00d4ff';
    ctx.font = `${cellSize * 0.45}px Cairo`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', px + cellSize / 2, py + cellSize / 2);
  }
}

function paintSpecialPath(path, colorHex, cellSize) {
  path.forEach((c) => {
    ctx.fillStyle = colorHex + '40'; // شفافية 25%
    ctx.fillRect(c.x * cellSize + 2, c.y * cellSize + 2, cellSize - 4, cellSize - 4);
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(c.x * cellSize + 2, c.y * cellSize + 2, cellSize - 4, cellSize - 4);
  });
}

function drawCenterArea(cx, cy, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#050816';
  ctx.fill();
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // مثلثات اللاعبين داخل المركز
  const colors = [PLAYER_CONFIG[0].hex, PLAYER_CONFIG[1].hex, PLAYER_CONFIG[2].hex, PLAYER_CONFIG[3].hex];
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const startAngle = (i * Math.PI) / 2 - Math.PI / 4;
    const endAngle = startAngle + Math.PI / 2;
    ctx.arc(cx, cy, radius - 4, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i] + '55';
    ctx.fill();
  }

  // نص الشعار المركزي AITT+
  ctx.font = `bold ${radius * 0.42}px Orbitron`;
  ctx.fillStyle = '#00d4ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AITT+', cx, cy);
  ctx.restore();
}

function drawAllTokens(cellSize) {
  const activePlayer = gameState.players[gameState.currentTurn];
  const movable = (!gameState.mustRoll && activePlayer.isHuman) ? getMovableTokens(activePlayer, gameState.diceValue) : [];

  gameState.players.forEach((player, pIdx) => {
    player.tokens.forEach(tok => {
      const coord = getTokenCoord(pIdx, tok);
      const px = coord.x * cellSize + cellSize / 2;
      const py = coord.y * cellSize + cellSize / 2;
      const tokenRadius = cellSize * 0.38;

      // وهج نابض إذا كانت القطعة قابلة للحركة للاعب البشري
      const isMovable = movable.includes(tok);
      if (isMovable) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, tokenRadius * 1.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 212, 255, 0.45)';
        ctx.fill();
        ctx.restore();
      }

      // جسم القطعة النيون
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, tokenRadius, 0, Math.PI * 2);
      ctx.fillStyle = player.hex;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // حلقة داخلية ونقطة ثلاثية الأبعاد
      ctx.beginPath();
      ctx.arc(px, py, tokenRadius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#050816';
      ctx.fill();

      // رقم القطعة
      ctx.font = `bold ${cellSize * 0.28}px Orbitron`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tok.id + 1, px, py);
      ctx.restore();
    });
  });
}

// معالجة النقر على الرقعة لاختيار القطعة يدوياً
function onCanvasClick(e) {
  const activePlayer = gameState.players[gameState.currentTurn];
  if (!activePlayer || !activePlayer.isHuman || gameState.mustRoll || gameState.isRolling) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;
  const cellSize = canvas.width / 15;

  const movable = getMovableTokens(activePlayer, gameState.diceValue);

  // مطابقة النقر مع القطع القابلة للحركة
  for (const tok of movable) {
    const c = getTokenCoord(activePlayer.id, tok);
    const px = c.x * cellSize + cellSize / 2;
    const py = c.y * cellSize + cellSize / 2;
    const dist = Math.hypot(clickX - px, clickY - py);

    if (dist <= cellSize * 0.55) {
      executeMove(tok);
      break;
    }
  }
}

// ----------------------------------------------------------------------------
// 9. تأثيرات جزيئات الخلفية (Background Particles Animation)
// ----------------------------------------------------------------------------
function setupBackgroundParticles() {
  const pCanvas = document.getElementById('bg-particles');
  if (!pCanvas) return;
  const pCtx = pCanvas.getContext('2d');

  function resize() {
    pCanvas.width = window.innerWidth;
    pCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const particles = Array.from({ length: 45 }, () => ({
    x: Math.random() * pCanvas.width,
    y: Math.random() * pCanvas.height,
    r: Math.random() * 2 + 1,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    color: Math.random() > 0.5 ? '#00d4ff' : '#a855f7'
  }));

  function animate() {
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = pCanvas.width;
      if (p.x > pCanvas.width) p.x = 0;
      if (p.y < 0) p.y = pCanvas.height;
      if (p.y > pCanvas.height) p.y = 0;

      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      pCtx.fillStyle = p.color;
      pCtx.shadowBlur = 10;
      pCtx.shadowColor = p.color;
      pCtx.fill();
    });
    requestAnimationFrame(animate);
  }
  animate();
}

// ----------------------------------------------------------------------------
// 10. ربط الواجهة والأزرار (UI Navigation & Handlers)
// ----------------------------------------------------------------------------
function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screenId}`);
  if (target) {
    target.classList.add('active');
    gameState.activeScreen = screenId;
  }
  if (screenId === 'game') {
    setTimeout(renderBoard, 80);
  }
}

function updateHeaderUI() {
  const elAvatar = document.getElementById('header-avatar');
  const elName = document.getElementById('header-username');
  const elCoins = document.getElementById('header-coins');
  const elLevel = document.getElementById('header-level');

  if (elAvatar) elAvatar.innerText = userState.avatar;
  if (elName) elName.innerText = userState.name;
  if (elCoins) elCoins.innerText = userState.coins.toLocaleString();
  if (elLevel) elLevel.innerText = userState.level;
}

function updateHUD() {
  const activeP = gameState.players[gameState.currentTurn];
  const nameEl = document.getElementById('current-player-name');
  if (nameEl && activeP) {
    nameEl.innerText = activeP.name;
    nameEl.style.color = activeP.hex;
  }

  // تحديث تمييز كروت اللاعبين
  gameState.players.forEach((p, idx) => {
    const card = document.getElementById(`hud-p${idx}`);
    if (card) {
      if (idx === gameState.currentTurn) {
        card.classList.add('active-turn');
      } else {
        card.classList.remove('active-turn');
      }
      const tokensLeft = p.tokens.filter(t => t.step !== 57).length;
      const countEl = card.querySelector('.p-tokens-left');
      if (countEl) countEl.innerText = `${tokensLeft} متبقية`;
    }
  });

  const hintEl = document.getElementById('dice-hint');
  if (hintEl) {
    if (activeP && activeP.isHuman) {
      hintEl.innerText = gameState.mustRoll ? 'اضغط لرمي النرد' : 'اختر قطعة للتحريك';
    } else {
      hintEl.innerText = `يفكر ${activeP ? activeP.name : 'الخصم'}...`;
    }
  }
}

function showToast(message) {
  const toast = document.getElementById('toast-bubble');
  if (!toast) return;
  toast.innerText = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function showVictoryModal(isHumanWinner) {
  const modal = document.getElementById('modal-victory');
  const textEl = document.getElementById('winner-celebration-text');
  const rewardEl = document.getElementById('victory-reward-amount');
  const ranksEl = document.getElementById('final-ranks-container');

  if (textEl) {
    textEl.innerText = isHumanWinner ? 'تهانينا! حققت المركز الأول في الساحة ⚡' : 'انتهت المعركة! حظ أوفر في المرة القادمة';
  }
  if (rewardEl) {
    rewardEl.innerText = isHumanWinner ? '+50 AITTP' : '+10 AITTP';
  }

  if (ranksEl) {
    ranksEl.innerHTML = gameState.ranks.map((pId, idx) => {
      const p = gameState.players[pId];
      return `
        <div class="rank-item ${idx === 0 ? 'winner' : ''}">
          <span>#${idx + 1} ${p.avatar} ${p.name}</span>
          <b style="color:${p.hex}">${idx === 0 ? 'البطل 👑' : 'مكتمل'}</b>
        </div>
      `;
    }).join('');
  }

  if (modal) modal.classList.add('active');
}

// بناء شبكة الأفاتار
const AVATAR_LIST = [
  { emoji: '🦊', name: 'ثعلب النيون', type: 'cyber', vip: false },
  { emoji: '🦁', name: 'أسد الساحة', type: 'cyber', vip: false },
  { emoji: '🐺', name: 'ذئب السايبر', type: 'boys', vip: false },
  { emoji: '🐯', name: 'نمر الظل', type: 'boys', vip: false },
  { emoji: '🧕', name: 'عائشة VIP', type: 'girls', vip: true },
  { emoji: '👩‍🦰', name: 'سارة VIP', type: 'girls', vip: true },
  { emoji: '🥷', name: 'نينجا المستقبل', type: 'boys', vip: false },
  { emoji: '🦄', name: 'المتوهج VIP', type: 'vip', vip: true },
  { emoji: '🐲', name: 'التنين الذهبي', type: 'vip', vip: true }
];

function populateAvatars(category = 'all') {
  const container = document.getElementById('avatars-container');
  if (!container) return;

  const filtered = category === 'all' ? AVATAR_LIST : AVATAR_LIST.filter(a => a.type === category || (category === 'vip' && a.vip));
  container.innerHTML = filtered.map(a => `
    <div class="avatar-card ${a.vip ? 'is-vip' : ''} ${userState.avatar === a.emoji ? 'selected' : ''}" data-emoji="${a.emoji}">
      ${a.vip ? '<span class="vip-badge-tag">👑</span>' : ''}
      <span class="avatar-emoji-large">${a.emoji}</span>
      <span class="avatar-name-label">${a.name}</span>
    </div>
  `).join('');

  container.querySelectorAll('.avatar-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      userState.avatar = card.getAttribute('data-emoji');
    });
  });
}

// ----------------------------------------------------------------------------
// 11. تشغيل اللعبة وربط الأحداث عند تحميل المستند (Bootstrapping)
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupBackgroundParticles();
  setupBoardCanvas();
  updateHeaderUI();
  populateAvatars();

  // 1. زر بدء اللعب من شاشة السبلاش
  const btnSplash = document.getElementById('btn-splash-play');
  if (btnSplash) {
    btnSplash.addEventListener('click', () => {
      sounds.initAudioContext();
      sounds.playMove();
      switchScreen('menu');
    });
  }

  // 2. بطاقات القائمة الرئيسية
  const cardAi = document.getElementById('card-vs-ai');
  const cardQuick = document.getElementById('card-quick-match');
  const cardPass = document.getElementById('card-pass-play');

  [cardAi, cardQuick, cardPass].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        sounds.playMove();
        initNewMatch();
        switchScreen('game');
        updateHUD();
      });
    }
  });

  // 3. النقر على النرد
  const diceBtn = document.getElementById('main-dice');
  if (diceBtn) {
    diceBtn.addEventListener('click', () => {
      if (gameState.players[gameState.currentTurn].isHuman && gameState.mustRoll) {
        rollDice();
      }
    });
  }

  // 4. أزرار التحكم داخل المباراة
  const btnHome = document.getElementById('btn-game-home');
  if (btnHome) {
    btnHome.addEventListener('click', () => {
      if (confirm('هل تريد العودة للقائمة الرئيسية؟ ستخسر المباراة الحالية.')) {
        switchScreen('menu');
      }
    });
  }

  const btnSound = document.getElementById('btn-game-sound');
  if (btnSound) {
    btnSound.addEventListener('click', () => {
      userState.sfx = !userState.sfx;
      saveUserData(userState);
      btnSound.innerText = userState.sfx ? '🔊' : '🔇';
      showToast(userState.sfx ? 'تم تفعيل المؤثرات الصوتية' : 'تم كتم الصوت');
    });
  }

  // 5. متجر الأفاتار والشخصيات
  const btnChars = document.getElementById('btn-menu-characters');
  const profileBadge = document.getElementById('btn-open-char-select');
  const btnCloseChars = document.getElementById('btn-close-chars');
  const btnConfirmAvatar = document.getElementById('btn-confirm-avatar');

  [btnChars, profileBadge].forEach(el => {
    if (el) el.addEventListener('click', () => switchScreen('characters'));
  });

  if (btnCloseChars) {
    btnCloseChars.addEventListener('click', () => switchScreen('menu'));
  }

  if (btnConfirmAvatar) {
    btnConfirmAvatar.addEventListener('click', () => {
      saveUserData(userState);
      updateHeaderUI();
      sounds.playMove();
      showToast('تم اعتماد الأفاتار بنجاح!');
      switchScreen('menu');
    });
  }

  document.querySelectorAll('.char-tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.char-tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      populateAvatars(tab.getAttribute('data-tab'));
    });
  });

  // 6. نافذة الإعدادات
  const settingsModal = document.getElementById('modal-settings');
  const openSettingsBtn = document.getElementById('btn-open-settings');
  const menuSettingsBtn = document.getElementById('btn-menu-settings');
  const closeSettingsBtn = document.getElementById('btn-close-settings');

  [openSettingsBtn, menuSettingsBtn].forEach(el => {
    if (el) el.addEventListener('click', () => settingsModal.classList.add('active'));
  });

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
  }

  const toggleSfx = document.getElementById('toggle-sfx');
  const toggleVibe = document.getElementById('toggle-vibration');
  const selectDiff = document.getElementById('select-ai-difficulty');

  if (toggleSfx) {
    toggleSfx.checked = userState.sfx;
    toggleSfx.addEventListener('change', (e) => {
      userState.sfx = e.target.checked;
      saveUserData(userState);
    });
  }

  if (toggleVibe) {
    toggleVibe.checked = userState.vibration;
    toggleVibe.addEventListener('change', (e) => {
      userState.vibration = e.target.checked;
      saveUserData(userState);
    });
  }

  if (selectDiff) {
    selectDiff.value = userState.difficulty;
    selectDiff.addEventListener('change', (e) => {
      userState.difficulty = e.target.value;
      saveUserData(userState);
      showToast(`تم تعيين مستوى الخصوم: ${e.target.value}`);
    });
  }

  const btnReset = document.getElementById('btn-reset-data');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('هل أنت متأكد من تصفير النقاط والعودة للإعدادات الأولية؟')) {
        localStorage.removeItem(STORAGE_KEY);
        userState = { ...defaultUserData };
        updateHeaderUI();
        settingsModal.classList.remove('active');
        showToast('تمت إعادة التعيين');
      }
    });
  }

  // 7. شات العبارات السريعة
  const chatModal = document.getElementById('modal-quick-chat');
  const openChatBtn = document.getElementById('btn-game-chat');
  const closeChatBtn = document.getElementById('btn-close-chat');

  if (openChatBtn) {
    openChatBtn.addEventListener('click', () => chatModal.classList.add('active'));
  }
  if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => chatModal.classList.remove('active'));
  }

  document.querySelectorAll('.phrase-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      showToast(`${userState.name}: ${pill.innerText}`);
      chatModal.classList.remove('active');
    });
  });

  // 8. أزرار شاشة النصر
  const victoryModal = document.getElementById('modal-victory');
  const btnAgain = document.getElementById('btn-victory-again');
  const btnVictoryMenu = document.getElementById('btn-victory-menu');

  if (btnAgain) {
    btnAgain.addEventListener('click', () => {
      victoryModal.classList.remove('active');
      initNewMatch();
      switchScreen('game');
      updateHUD();
    });
  }

  if (btnVictoryMenu) {
    btnVictoryMenu.addEventListener('click', () => {
      victoryModal.classList.remove('active');
      switchScreen('menu');
    });
  }
});
