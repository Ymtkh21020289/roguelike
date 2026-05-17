// ── gameState.js ──────────────────────────────────────────────────────────
// Central game state and state mutation helpers

import { createDeck, shuffle, evaluateHand } from './cards.js';
import { getEffectiveStrength, applyCardEffects } from './effects.js';

export const BATTLES = [
  { name: 'ゴブリン', sprite: '👺', hp: 20, difficulty: 1 },
  { name: 'スケルトン', sprite: '💀', hp: 28, difficulty: 2 },
  { name: 'オーク', sprite: '👹', hp: 38, difficulty: 3 },
  { name: 'ドラゴン', sprite: '🐉', hp: 55, difficulty: 4 },
  { name: '魔王', sprite: '😈', hp: 75, difficulty: 5 },
];

export const TOTAL_BATTLES = BATTLES.length;

export function createInitialState() {
  return {
    phase: 'title',       // title | battle | shop | gameover | gameclear
    battleIndex: 0,
    player: {
      hp: 30,
      maxHp: 30,
      currency: 0,
      totalDamageDealt: 0,
    },
    enemy: {
      hp: 0,
      maxHp: 0,
      name: '',
      sprite: '',
      difficulty: 1,
    },
    deck: [],         // player's full deck
    hand: [],         // current hand (up to 10 cards)
    drawPile: [],     // remaining draw pile this battle
    discardPile: [],
    selectedIndices: [],
    artifacts: [],
    turn: 0,
    roundLog: [],     // {playerHand, enemyHand, playerDmg, enemyDmg, winner}
    battleReward: 0,
    shopOfferings: {
      effects: [],    // {card, effect}
      artifacts: [],
      removeCards: [], // cards available for removal (cost)
      addCards: [],    // shop cards to buy
    },
    rerollCost: 5,
  };
}

/** Start a new game */
export function initGame(state) {
  const fresh = createInitialState();
  fresh.phase = 'battle';
  fresh.deck = createDeck();
  fresh.player = { hp: 30, maxHp: 30, currency: 0, totalDamageDealt: 0 };
  fresh.artifacts = [];
  fresh.battleIndex = 0;
  startBattle(fresh);
  return fresh;
}

/** Set up a battle */
export function startBattle(state) {
  const battle = BATTLES[state.battleIndex];
  state.enemy = {
    hp: battle.hp,
    maxHp: battle.hp,
    name: battle.name,
    sprite: battle.sprite,
    difficulty: battle.difficulty,
  };
  state.drawPile = shuffle([...state.deck]);
  state.hand = [];
  state.discardPile = [];
  state.selectedIndices = [];
  state.turn = 0;
  state.player.totalDamageDealt = 0;
  state.battleReward = 0;
  drawToTen(state);
}

/** Draw cards until hand has 10 */
export function drawToTen(state) {
  while (state.hand.length < 10) {
    if (state.drawPile.length === 0) {
      // Reshuffle discard
      if (state.discardPile.length === 0) break;
      state.drawPile = shuffle([...state.discardPile]);
      state.discardPile = [];
    }
    state.hand.push(state.drawPile.shift());
  }
  state.selectedIndices = [];
}

/** Bot selects 5 cards optimally-ish */
export function botSelectCards(deck, artifacts) {
  const hand = shuffle([...deck]).slice(0, 10);
  return botPickBest(hand, artifacts);
}

/** Simple bot: try all C(10,5) combos, pick best hand */
export function botPickBest(hand, artifacts) {
  let bestHand = null;
  let bestCards = [];
  let bestStrength = -1;

  const n = hand.length;
  for (let a = 0; a < n - 4; a++)
  for (let b = a+1; b < n - 3; b++)
  for (let c = b+1; c < n - 2; c++)
  for (let d = c+1; d < n - 1; d++)
  for (let e = d+1; e < n; e++) {
    const combo = [hand[a], hand[b], hand[c], hand[d], hand[e]];
    const ev = evaluateHand(combo);
    const eff = getEffectiveStrength(ev.name, ev.strength, artifacts);
    if (eff > bestStrength) {
      bestStrength = eff;
      bestHand = ev;
      bestCards = combo;
    }
  }
  return { cards: bestCards, handEval: bestHand };
}

/** Process one turn of combat */
export function processTurn(state) {
  const selectedCards = state.selectedIndices.map(i => state.hand[i]);
  const playerHandEval = evaluateHand(selectedCards);
  const playerResult = applyCardEffects(selectedCards, playerHandEval, playerHandEval.strength, state.artifacts);

  // Bot plays
  const botResult = botPickBest(shuffle([...state.deck]).slice(0, 10), []);
  const enemyHandEval = botResult.handEval;
  const enemyStrength = getEffectiveStrength(enemyHandEval.name, enemyHandEval.strength, []);
  const enemyDamage = enemyStrength;

  // ── 強さ指数比較: 勝った側のみダメージを通す。同値は両方通す ──
  const playerWins = playerResult.finalStrength > enemyStrength;
  const enemyWins  = enemyStrength > playerResult.finalStrength;
  const isDraw     = playerResult.finalStrength === enemyStrength;

  const actualPlayerDamage = (playerWins || isDraw) ? playerResult.damage : 0;
  const actualEnemyDamage  = (enemyWins  || isDraw) ? enemyDamage : 0;

  // Apply damage
  state.enemy.hp = Math.max(0, state.enemy.hp - actualPlayerDamage);
  state.player.hp = Math.max(0, state.player.hp - actualEnemyDamage);
  state.player.totalDamageDealt += actualPlayerDamage;

  // Lifesteal (only triggers if player actually dealt damage)
  if (playerResult.lifesteal && actualPlayerDamage > 0) {
    const healAmt = Math.floor(actualPlayerDamage / 2);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmt);
    playerResult.lifestealAmount = healAmt;
  } else {
    playerResult.lifestealAmount = 0;
  }

  // Discard selected cards, keep rest in hand
  const remaining = state.hand.filter((_, i) => !state.selectedIndices.includes(i));
  state.discardPile.push(...selectedCards);
  state.hand = remaining;
  state.turn++;

  // Check lucky dice on player death
  let diceResult = null;
  if (state.player.hp <= 0) {
    const luckyDice = state.artifacts.find(a => a.id === 'LUCKY_DICE');
    if (luckyDice) {
      const roll = Math.floor(Math.random() * 6) + 1;
      diceResult = roll;
      if (roll >= 5) {
        state.player.hp = 1;
      }
    }
  }

  // winner は強さ指数の比較で決まる
  const winner = playerWins ? 'player' : enemyWins ? 'enemy' : 'draw';

  const log = {
    playerCards: selectedCards,
    enemyCards: botResult.cards,
    playerHandName: playerHandEval.name,
    enemyHandName: enemyHandEval.name,
    playerStrength: playerResult.finalStrength,
    enemyStrength,
    playerDamage: actualPlayerDamage,
    enemyDamage: actualEnemyDamage,
    blockedPlayerDamage: playerWins || isDraw ? 0 : playerResult.damage, // blocked amount
    blockedEnemyDamage:  enemyWins  || isDraw ? 0 : enemyDamage,
    lifesteal: playerResult.lifesteal && actualPlayerDamage > 0,
    lifestealAmount: playerResult.lifestealAmount,
    winner,
    diceResult,
  };

  state.roundLog.push(log);
  return log;
}

/** After battle won, compute reward */
export function computeReward(state) {
  const baseReward = state.player.totalDamageDealt;
  let reward = baseReward;
  const goldMulti = state.artifacts.find(a => a.id === 'GOLD_MULTIPLIER');
  if (goldMulti) reward = Math.floor(reward * 1.2);
  state.battleReward = reward;
  state.player.currency += reward;
  return reward;
}
