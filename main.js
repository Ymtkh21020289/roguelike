// ── main.js ───────────────────────────────────────────────────────────────
// Entry point - game orchestration

import { evaluateHand, HAND_STRENGTH } from './cards.js';
import {
  createInitialState, initGame, startBattle,
  drawToTen, processTurn, computeReward, BATTLES, TOTAL_BATTLES
} from './gameState.js';
import {
  renderHand, renderPlayedCards, renderHUD, renderArtifacts,
  showTurnResult, showDamageFloat, showPhaseBanner, shakeElement,
  showScreen, createCardEl
} from './ui.js';
import { openShop } from './shop.js';

// ── DOM SETUP ─────────────────────────────────────────────────────────────

const app = document.getElementById('app');

function buildInitialDOM() {
  app.innerHTML = `
    <!-- TITLE SCREEN -->
    <div id="title-screen" class="screen">
      <div class="title-logo">
        <span class="line1">ROGUELIKE</span>
        <span class="line2">POKER</span>
        <span class="line3">DUNGEON</span>
      </div>
      <div class="title-cards">♠ ♥ ♦ ♣</div>
      <button class="btn" id="start-btn">ゲームスタート</button>
      <div style="font-size:8px;color:var(--text-dim);letter-spacing:2px;margin-top:8px">
        ${TOTAL_BATTLES}戦を勝ち抜け!
      </div>
    </div>

    <!-- BATTLE SCREEN -->
    <div id="battle-screen" class="screen hidden">
      <!-- HUD -->
      <div id="hud"></div>
      <div id="battle-counter"></div>
      <div id="turn-indicator">TURN 1</div>

      <!-- Enemy -->
      <div id="enemy-area">
        <span class="enemy-sprite" id="enemy-sprite">👺</span>
        <div class="enemy-name" id="enemy-name">???</div>
      </div>

      <!-- Battle area (center) -->
      <div id="battle-area">
        <div class="battle-label">ENEMY</div>
        <div class="played-cards-row" id="enemy-played"></div>
        <div class="hand-name-display" id="enemy-hand-name"></div>
        <div class="vs-divider">VS</div>
        <div class="hand-name-display" id="player-hand-name"></div>
        <div class="played-cards-row" id="player-played"></div>
        <div class="battle-label">YOU</div>
      </div>

      <!-- Turn result -->
      <div id="turn-result" class="hidden"></div>

      <!-- Artifact panel -->
      <div id="artifact-panel">
        <div class="artifact-panel-title">ARTIFACTS</div>
        <div class="artifact-list"></div>
      </div>

      <!-- Player hand -->
      <div id="hand-area"></div>

      <!-- Action area -->
      <div id="action-area">
        <div class="selected-count" id="selected-count">0 / 5 枚選択中</div>
        <button class="btn" id="play-btn" disabled>役を出す (5枚選択)</button>
      </div>
    </div>

    <!-- RESULT OVERLAY -->
    <div id="result-overlay" class="hidden">
      <div class="result-box">
        <div class="result-title" id="result-title">BATTLE WIN!</div>
        <div class="result-detail" id="result-detail"></div>
        <button class="btn" id="result-btn">続ける</button>
      </div>
    </div>

    <!-- GAMEOVER SCREEN (reuses overlay via JS) -->
  `;
}

// ── GAME STATE ─────────────────────────────────────────────────────────────

let G = createInitialState();
let battlePhase = 'selecting'; // selecting | resolving

// ── INIT ──────────────────────────────────────────────────────────────────

buildInitialDOM();
bindTitleScreen();
showScreen('title-screen');

function bindTitleScreen() {
  document.getElementById('start-btn').addEventListener('click', startGame);
}

// ── GAME FLOW ─────────────────────────────────────────────────────────────

function startGame() {
  G = initGame(G);
  showScreen('battle-screen');
  setupBattleScreen();
  showPhaseBanner('BATTLE START!');
}

function setupBattleScreen() {
  battlePhase = 'selecting';
  const battle = BATTLES[G.battleIndex];

  document.getElementById('enemy-sprite').textContent = G.enemy.sprite;
  document.getElementById('enemy-name').textContent = G.enemy.name;
  document.getElementById('battle-counter').innerHTML =
    `BATTLE<br>${G.battleIndex + 1} / ${TOTAL_BATTLES}`;
  document.getElementById('turn-indicator').textContent = `TURN ${G.turn + 1}`;

  // Clear battle area
  document.getElementById('player-played').innerHTML = '';
  document.getElementById('enemy-played').innerHTML = '';
  document.getElementById('player-hand-name').textContent = '';
  document.getElementById('enemy-hand-name').textContent = '';

  renderHUD(G);
  renderArtifacts(G.artifacts);
  renderHandUI();
  bindPlayButton();
}

function renderHandUI() {
  const handArea = document.getElementById('hand-area');
  renderHand(handArea, G.hand, G.selectedIndices, toggleCard);
  updateSelectedCount();
}

function toggleCard(idx) {
  if (battlePhase !== 'selecting') return;
  const pos = G.selectedIndices.indexOf(idx);
  if (pos >= 0) {
    G.selectedIndices.splice(pos, 1);
  } else {
    if (G.selectedIndices.length >= 5) return;
    G.selectedIndices.push(idx);
  }
  renderHandUI();
}

function updateSelectedCount() {
  const cnt = G.selectedIndices.length;
  document.getElementById('selected-count').textContent = `${cnt} / 5 枚選択中`;
  document.getElementById('play-btn').disabled = cnt !== 5;

  // Live hand preview
  if (cnt === 5) {
    const sel = G.selectedIndices.map(i => G.hand[i]);
    const ev = evaluateHand(sel);
    document.getElementById('player-hand-name').textContent = `${ev.name} (${ev.strength})`;
  } else {
    document.getElementById('player-hand-name').textContent = '';
  }
}

function bindPlayButton() {
  const btn = document.getElementById('play-btn');
  btn.replaceWith(btn.cloneNode(true)); // remove old listeners
  document.getElementById('play-btn').addEventListener('click', playTurn);
}

async function playTurn() {
  if (battlePhase !== 'selecting') return;
  if (G.selectedIndices.length !== 5) return;

  battlePhase = 'resolving';
  document.getElementById('play-btn').disabled = true;

  // Animate played cards
  const playerCards = G.selectedIndices.map(i => G.hand[i]);
  renderPlayedCards(document.getElementById('player-played'), playerCards);

  await delay(400);

  // Process turn
  const log = processTurn(G);

  // Show enemy cards
  renderPlayedCards(document.getElementById('enemy-played'), log.enemyCards);
  document.getElementById('enemy-hand-name').textContent = `${log.enemyHandName} (${log.enemyStrength})`;
  document.getElementById('player-hand-name').textContent = `${log.playerHandName} (${log.playerStrength})`;

  await delay(600);

  // Show damage floats
  const enemyEl = document.getElementById('enemy-area');
  const hudEl = document.getElementById('hud');

  showDamageFloat(enemyEl, log.playerDamage, false);
  await delay(300);
  shakeElement(enemyEl);

  showDamageFloat(hudEl, log.enemyDamage, false);
  await delay(300);

  if (log.lifesteal && log.lifestealAmount > 0) {
    showDamageFloat(hudEl, log.lifestealAmount, true);
  }

  renderHUD(G);

  // Show turn result
  const turnResult = document.getElementById('turn-result');
  showTurnResult(log, turnResult);
  await delay(2000);
  turnResult.classList.add('hidden');

  // Check dice animation
  if (log.diceResult !== null && log.diceResult !== undefined) {
    await showDiceAnimation(log.diceResult);
  }

  // Check battle end
  if (G.enemy.hp <= 0) {
    await delay(300);
    battleWon();
    return;
  }

  if (G.player.hp <= 0) {
    await delay(300);
    gameOver();
    return;
  }

  // Next turn
  drawToTen(G);
  G.selectedIndices = [];
  G.turn++;
  document.getElementById('turn-indicator').textContent = `TURN ${G.turn + 1}`;
  battlePhase = 'selecting';
  renderHandUI();
  bindPlayButton();
}

function battleWon() {
  const reward = computeReward(G);
  showPhaseBanner('VICTORY!');

  setTimeout(() => {
    const overlay = document.getElementById('result-overlay');
    const title = document.getElementById('result-title');
    const detail = document.getElementById('result-detail');
    const btn = document.getElementById('result-btn');

    title.textContent = '⭐ BATTLE WIN!';
    title.className = 'result-title';
    detail.innerHTML = `
      ${G.enemy.name} を倒した！<br>
      獲得通貨: 💰 ${reward}<br>
      所持通貨: 💰 ${G.player.currency}
    `;

    overlay.classList.remove('hidden');
    btn.textContent = G.battleIndex + 1 >= TOTAL_BATTLES ? 'GAME CLEAR!' : 'デッキ強化へ';

    btn.onclick = () => {
      overlay.classList.add('hidden');
      if (G.battleIndex + 1 >= TOTAL_BATTLES) {
        gameClear();
      } else {
        // Open shop
        showScreen('shop-screen-placeholder');
        openShopScreen();
      }
    };
  }, 800);
}

function openShopScreen() {
  // Remove existing shop screen
  const old = document.getElementById('shop-screen');
  if (old) old.remove();

  openShop(G, (updatedState) => {
    G = updatedState;
    if (G.battleIndex >= TOTAL_BATTLES) {
      gameClear();
      return;
    }
    startBattle(G);
    showScreen('battle-screen');
    setupBattleScreen();
    showPhaseBanner(`BATTLE ${G.battleIndex + 1}`);
  });

  // Show the shop screen that was just created
  setTimeout(() => {
    const shopEl = document.getElementById('shop-screen');
    if (shopEl) {
      document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
      shopEl.classList.remove('hidden');
    }
  }, 50);
}

function gameOver() {
  showPhaseBanner('GAME OVER');
  setTimeout(() => {
    const overlay = document.getElementById('result-overlay');
    const title = document.getElementById('result-title');
    const detail = document.getElementById('result-detail');
    const btn = document.getElementById('result-btn');

    title.textContent = '💀 GAME OVER';
    title.className = 'result-title lose';
    detail.innerHTML = `
      ${G.enemy.name} に倒された...<br>
      到達戦闘: ${G.battleIndex + 1} / ${TOTAL_BATTLES}
    `;

    overlay.classList.remove('hidden');
    btn.textContent = 'タイトルへ';
    btn.onclick = () => {
      overlay.classList.add('hidden');
      G = createInitialState();
      showScreen('title-screen');
    };
  }, 800);
}

function gameClear() {
  const overlay = document.getElementById('result-overlay');
  const title = document.getElementById('result-title');
  const detail = document.getElementById('result-detail');
  const btn = document.getElementById('result-btn');

  title.textContent = '🎉 GAME CLEAR!';
  title.className = 'result-title';
  detail.innerHTML = `
    全ての敵を倒した！<br>
    所持通貨: 💰 ${G.player.currency}<br>
    残りHP: ❤️ ${G.player.hp}
  `;

  overlay.classList.remove('hidden');
  btn.textContent = 'タイトルへ';
  btn.onclick = () => {
    overlay.classList.add('hidden');
    G = createInitialState();
    showScreen('title-screen');
  };
}

// ── DICE ANIMATION ────────────────────────────────────────────────────────

function showDiceAnimation(roll) {
  return new Promise(resolve => {
    const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const overlay = document.createElement('div');
    overlay.className = 'dice-overlay';

    const app = document.getElementById('app');
    app.appendChild(overlay);

    let frame = 0;
    const faceEl = document.createElement('div');
    faceEl.className = 'dice-emoji';
    const resultEl = document.createElement('div');
    resultEl.className = 'dice-result';
    resultEl.textContent = '🎲 幸運のダイスを振る...';

    overlay.appendChild(faceEl);
    overlay.appendChild(resultEl);

    // Spin animation
    const spin = setInterval(() => {
      faceEl.textContent = DICE[Math.floor(Math.random() * 6)];
      frame++;
      if (frame >= 10) {
        clearInterval(spin);
        faceEl.textContent = DICE[roll - 1];
        faceEl.className = 'dice-emoji';
        void faceEl.offsetWidth;
        faceEl.className = 'dice-emoji';
        resultEl.textContent = roll >= 5
          ? `出目: ${roll} → 生き残り！ HP=1`
          : `出目: ${roll} → 失敗... 倒れた`;
        setTimeout(() => {
          overlay.remove();
          resolve();
        }, 1800);
      }
    }, 100);
  });
}

// ── UTILS ─────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}
