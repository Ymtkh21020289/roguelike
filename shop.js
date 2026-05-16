// ── shop.js ───────────────────────────────────────────────────────────────
// Deck enhancement / shop screen logic

import { CARD_EFFECTS, ARTIFACT_POOL, sampleArtifacts } from './effects.js';
import { createDeck, shuffle, SUITS, HAND_NAMES, RANKS } from './cards.js';
import { renderHUD, renderArtifacts, showTooltip, hideTooltip, createCardEl } from './ui.js';

let state = null;
let onDone = null;

const REMOVE_COST = 15;
const ADD_CARD_COST = 20;

/** Open the shop screen */
export function openShop(gameState, callback) {
  state = gameState;
  onDone = callback;
  buildShopOfferings();
  renderShop();
  renderHUD(state);
  renderArtifacts(state.artifacts);
}

function getDiscount() {
  const disc = state.artifacts.find(a => a.shopDiscount);
  return disc ? disc.shopDiscount : 0;
}

function applyDiscount(cost) {
  return Math.max(1, Math.floor(cost * (1 - getDiscount())));
}

function buildShopOfferings() {
  // Random effect options (card + effect combos)
  const effOptions = [];
  const shuffledEffects = [...CARD_EFFECTS].sort(() => Math.random() - 0.5).slice(0, 3);
  const eligibleCards = state.deck.filter(c => !c.effect);
  const sampleCards = shuffle(eligibleCards).slice(0, 3);

  shuffledEffects.forEach((eff, i) => {
    if (sampleCards[i]) {
      effOptions.push({ card: sampleCards[i], effectDef: eff });
    }
  });

  // Artifact options
  const artOptions = sampleArtifacts(ARTIFACT_POOL, state.artifacts, 2);

  // Cards to remove
  const removeOptions = shuffle([...state.deck]).slice(0, 3);

  // Cards to buy
  const allCards = createDeck();
  const deckIds = new Set(state.deck.map(c => `${c.rank}${c.suit}`));
  const available = allCards.filter(c => !deckIds.has(`${c.rank}${c.suit}`));
  const buyOptions = shuffle(available).slice(0, 3);

  state.shopOfferings = { effects: effOptions, artifacts: artOptions, removeCards: removeOptions, addCards: buyOptions };
  state.rerollCost = 5;
}

function renderShop() {
  const app = document.getElementById('app');

  // Remove old shop content if any
  let shopEl = document.getElementById('shop-screen');
  if (!shopEl) {
    shopEl = document.createElement('div');
    shopEl.id = 'shop-screen';
    shopEl.className = 'screen shop-screen';
    app.appendChild(shopEl);
  }

  const disc = getDiscount();
  const discText = disc > 0 ? ` <span style="color:var(--hp-green);font-size:8px">(${Math.floor(disc * 100)}%割引中)</span>` : '';

  shopEl.innerHTML = `
    <div class="shop-title">⚔ デッキ強化 ⚔</div>
    <div style="font-size:8px;color:var(--text-dim)">戦闘 ${state.battleIndex} クリア!</div>
    <div class="shop-currency">💰 所持: ${state.player.currency}${discText}</div>
    <div class="shop-sections">
      <!-- Effects -->
      <div class="shop-section">
        <div class="shop-section-title">✨ 特殊効果付与</div>
        <div id="effect-items"></div>
        <div class="reroll-area">
          <button class="btn btn-sm" id="reroll-btn">リロール</button>
          <span style="font-size:8px;color:var(--text-dim)">💰 ${state.rerollCost}</span>
        </div>
      </div>

      <!-- Artifacts -->
      <div class="shop-section">
        <div class="shop-section-title">🔮 アーティファクト</div>
        <div id="artifact-items"></div>
      </div>

      <!-- Card Management -->
      <div class="shop-section">
        <div class="shop-section-title">🗑️ カード削除</div>
        <div id="remove-items"></div>
        <div class="shop-section-title" style="margin-top:12px">🛒 カード購入</div>
        <div id="add-items"></div>
      </div>
    </div>

    <!-- Deck view -->
    <div class="shop-section" style="max-width:960px;width:100%;">
      <div class="shop-section-title">📋 現在のデッキ (${state.deck.length}枚)</div>
      <div class="deck-grid" id="deck-view"></div>
    </div>

    <button class="btn" id="next-battle-btn" style="margin-top:8px">次の戦闘へ →</button>
  `;

  populateEffectItems();
  populateArtifactItems();
  populateRemoveItems();
  populateAddItems();
  renderDeckView();

  document.getElementById('next-battle-btn').addEventListener('click', () => {
    state.battleIndex++;
    onDone(state);
  });

  document.getElementById('reroll-btn').addEventListener('click', () => {
    if (state.player.currency < state.rerollCost) {
      flashMessage('💰 通貨が足りません');
      return;
    }
    state.player.currency -= state.rerollCost;
    state.rerollCost += 5;
    buildShopOfferings();
    renderShop();
  });
}

function populateEffectItems() {
  const container = document.getElementById('effect-items');
  if (!container) return;
  container.innerHTML = '';
  const offerings = state.shopOfferings.effects;

  if (offerings.length === 0) {
    container.innerHTML = '<div style="font-size:8px;color:#666;padding:8px">利用可能なカードなし</div>';
    return;
  }

  offerings.forEach(({ card, effectDef }) => {
    const cost = applyDiscount(effectDef.cost);
    const el = document.createElement('div');
    el.className = 'shop-item';

    let descText = typeof effectDef.description === 'function'
      ? effectDef.description('ワンペア', '♠', '♥')  // placeholder
      : effectDef.description;

    el.innerHTML = `
      <div style="font-size:20px;width:28px;text-align:center">${effectDef.icon}</div>
      <div class="shop-item-info">
        <div style="color:var(--effect-blue)">${effectDef.name}</div>
        <div style="color:#888">${card.rank}${card.suit} に付与</div>
        <div style="color:#666;font-size:7px">${descText}</div>
      </div>
      <div class="shop-item-cost">💰${cost}</div>
    `;

    el.addEventListener('click', () => {
      if (card.effect) { flashMessage('このカードは既に効果がついています'); return; }
      if (state.player.currency < cost) { flashMessage('💰 通貨が足りません'); return; }

      if (effectDef.paramType === 'hand') {
        promptHandChoice(effectDef, (hand) => {
          applyEffect(card, effectDef, cost, hand, null);
        });
      } else if (effectDef.paramType === 'dualSuit') {
        promptSuitChoice(effectDef, (s1, s2) => {
          applyEffect(card, effectDef, cost, s1, s2);
        });
      } else {
        applyEffect(card, effectDef, cost, null, null);
      }
    });

    container.appendChild(el);
  });
}

function applyEffect(card, effectDef, cost, param1, param2) {
  state.player.currency -= cost;
  const deckCard = state.deck.find(c => c.id === card.id);
  if (deckCard) {
    deckCard.effect = effectDef.apply(param1, param2);
  }
  flashMessage(`✨ ${effectDef.name} を付与しました!`);
  renderShop();
}

function populateArtifactItems() {
  const container = document.getElementById('artifact-items');
  if (!container) return;
  container.innerHTML = '';

  state.shopOfferings.artifacts.forEach(art => {
    const cost = applyDiscount(art.cost);
    const el = document.createElement('div');
    el.className = 'shop-item';
    el.innerHTML = `
      <div style="font-size:24px;width:32px;text-align:center">${art.icon}</div>
      <div class="shop-item-info">
        <div style="color:var(--gold)">${art.name}</div>
        <div style="color:#888;font-size:7px">${art.description}</div>
      </div>
      <div class="shop-item-cost">💰${cost}</div>
    `;
    el.addEventListener('click', () => {
      if (state.player.currency < cost) { flashMessage('💰 通貨が足りません'); return; }
      state.player.currency -= cost;
      state.artifacts.push(art);
      if (art.onPickup) art.onPickup(state);
      flashMessage(`🔮 ${art.name} を入手!`);
      renderShop();
    });
    container.appendChild(el);
  });
}

function populateRemoveItems() {
  const container = document.getElementById('remove-items');
  if (!container) return;
  container.innerHTML = '';

  const cost = applyDiscount(REMOVE_COST);
  state.shopOfferings.removeCards.slice(0, 3).forEach(card => {
    if (!state.deck.find(c => c.id === card.id)) return;
    const el = document.createElement('div');
    el.className = 'shop-item';
    el.innerHTML = `
      <div style="font-size:16px;width:28px;text-align:center;color:${card.color === 'red' ? '#cc2222' : '#111'}">${card.rank}${card.suit}</div>
      <div class="shop-item-info">
        <div>${card.rank} ${card.suit}</div>
      </div>
      <div class="shop-item-cost">💰${cost}</div>
    `;
    el.addEventListener('click', () => {
      if (state.player.currency < cost) { flashMessage('💰 通貨が足りません'); return; }
      state.player.currency -= cost;
      state.deck = state.deck.filter(c => c.id !== card.id);
      flashMessage(`🗑️ ${card.rank}${card.suit} を削除しました`);
      renderShop();
    });
    container.appendChild(el);
  });
}

function populateAddItems() {
  const container = document.getElementById('add-items');
  if (!container) return;
  container.innerHTML = '';

  const cost = applyDiscount(ADD_CARD_COST);
  state.shopOfferings.addCards.slice(0, 3).forEach(card => {
    const el = document.createElement('div');
    el.className = 'shop-item';
    el.innerHTML = `
      <div style="font-size:16px;width:28px;text-align:center;color:${card.color === 'red' ? '#cc2222' : '#111'}">${card.rank}${card.suit}</div>
      <div class="shop-item-info">
        <div>${card.rank} ${card.suit}</div>
      </div>
      <div class="shop-item-cost">💰${cost}</div>
    `;
    el.addEventListener('click', () => {
      if (state.player.currency < cost) { flashMessage('💰 通貨が足りません'); return; }
      state.player.currency -= cost;
      state.deck.push({ ...card, effect: null });
      flashMessage(`🛒 ${card.rank}${card.suit} を購入しました`);
      renderShop();
    });
    container.appendChild(el);
  });
}

function renderDeckView() {
  const grid = document.getElementById('deck-view');
  if (!grid) return;
  grid.innerHTML = '';
  state.deck.forEach(card => {
    const el = createCardEl(card);
    el.style.width = '54px';
    el.style.height = '78px';
    el.querySelector('.card-corner').style.fontSize = '12px';
    el.querySelector('.card-center').style.fontSize = '18px';
    grid.appendChild(el);
  });
}

function flashMessage(msg) {
  const app = document.getElementById('app');
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;bottom:60px;left:50%;transform:translateX(-50%);
    background:rgba(0,20,0,0.9);border:2px solid var(--gold);
    padding:10px 20px;font-size:9px;color:var(--gold);
    z-index:1000;animation:popIn 0.3s ease;pointer-events:none;
  `;
  el.textContent = msg;
  app.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function promptHandChoice(effectDef, callback) {
  const overlay = document.createElement('div');
  overlay.className = 'effect-select-overlay';
  const handNames = ['ワンペア','ツーペア','スリーカード','ストレート','フラッシュ','フルハウス','フォーカード','ストレートフラッシュ','ロイヤルフラッシュ'];
  overlay.innerHTML = `
    <div class="effect-select-box">
      <div class="effect-select-title">対象の役を選択</div>
      ${handNames.map(h => `<div class="effect-option" data-hand="${h}">
        <div class="effect-option-name">${h}</div>
      </div>`).join('')}
      <button class="btn btn-sm btn-red" id="cancel-hand">キャンセル</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.effect-option').forEach(el => {
    el.addEventListener('click', () => {
      document.body.removeChild(overlay);
      callback(el.dataset.hand);
    });
  });
  document.getElementById('cancel-hand').addEventListener('click', () => document.body.removeChild(overlay));
}

function promptSuitChoice(effectDef, callback) {
  const suits = ['♠','♥','♦','♣'];
  const overlay = document.createElement('div');
  overlay.className = 'effect-select-overlay';
  overlay.innerHTML = `
    <div class="effect-select-box">
      <div class="effect-select-title">2つのスートを選択</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
        ${suits.map(s => `<div class="effect-option" data-suit="${s}" style="width:60px;justify-content:center;font-size:24px">${s}</div>`).join('')}
      </div>
      <div id="suit-selected" style="font-size:10px;color:var(--gold);margin-top:12px;text-align:center">選択: なし</div>
      <div style="display:flex;gap:12px;margin-top:12px">
        <button class="btn btn-sm" id="confirm-suit" disabled>確定</button>
        <button class="btn btn-sm btn-red" id="cancel-suit">キャンセル</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let chosen = [];
  overlay.querySelectorAll('.effect-option[data-suit]').forEach(el => {
    el.addEventListener('click', () => {
      const s = el.dataset.suit;
      if (chosen.includes(s)) {
        chosen = chosen.filter(x => x !== s);
        el.style.borderColor = 'transparent';
      } else if (chosen.length < 2) {
        chosen.push(s);
        el.style.borderColor = 'var(--effect-blue)';
      }
      document.getElementById('suit-selected').textContent = '選択: ' + (chosen.join(' & ') || 'なし');
      document.getElementById('confirm-suit').disabled = chosen.length !== 2;
    });
  });
  document.getElementById('confirm-suit').addEventListener('click', () => {
    if (chosen.length === 2) {
      document.body.removeChild(overlay);
      callback(chosen[0], chosen[1]);
    }
  });
  document.getElementById('cancel-suit').addEventListener('click', () => document.body.removeChild(overlay));
}
