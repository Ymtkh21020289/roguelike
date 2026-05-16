// ── effects.js ────────────────────────────────────────────────────────────
// Special card effects and artifact definitions

import { HAND_NAMES, SUITS } from './cards.js';

// ── CARD EFFECTS ──────────────────────────────────────────────────────────

export const CARD_EFFECTS = [
  {
    id: 'LIFESTEAL',
    name: '吸血',
    icon: '🩸',
    cost: 20,
    description: 'この役に組み込んだ場合、与えたダメージの半分分HPを回復する。',
    color: '#ff4060',
    apply: () => ({ type: 'LIFESTEAL' })
  },
  {
    id: 'STRENGTH_BOOST',
    name: '強化',
    icon: '⚡',
    cost: 18,
    description: 'この役に組み込んだ場合、役の強さ指数を+1して計算する。',
    color: '#ffcc00',
    apply: () => ({ type: 'STRENGTH_BOOST', value: 1 })
  },
  {
    id: 'DAMAGE_PLUS',
    name: '鋭利',
    icon: '🗡️',
    cost: 16,
    description: 'この役に組み込んだ場合、与えるダメージを+2する。',
    color: '#ff8040',
    apply: () => ({ type: 'DAMAGE_PLUS', value: 2 })
  },
  {
    id: 'HAND_DAMAGE_PLUS',
    name: '専門家',
    icon: '🎯',
    cost: 22,
    description: (hand) => `【${hand}】の役の中に組み込んだ場合、与えるダメージを+3する。`,
    color: '#40c0ff',
    paramType: 'hand',
    apply: (hand) => ({ type: 'HAND_DAMAGE_PLUS', value: 3, targetHand: hand })
  },
  {
    id: 'DUAL_SUIT',
    name: '二重紋',
    icon: '⚜️',
    cost: 25,
    description: (s1, s2) => `このカードは【${s1}】と【${s2}】を同時に満たすことができる。`,
    color: '#c040ff',
    paramType: 'dualSuit',
    apply: (s1, s2) => ({ type: 'DUAL_SUIT', suits: [s1, s2] })
  },
];

// ── ARTIFACTS ─────────────────────────────────────────────────────────────

export const ARTIFACT_POOL = [
  {
    id: 'GOLD_MULTIPLIER',
    name: '金の蹄鉄',
    icon: '🧲',
    cost: 40,
    description: 'これを持っている限り、もらえる通貨の数が1.2倍される。',
    rarity: 'common',
    onBattleReward: (gold) => Math.floor(gold * 1.2),
  },
  {
    id: 'HAND_STRENGTH_UP',
    name: '賢者の書',
    icon: '📖',
    cost: 45,
    description: '【ワンペア】の強さ指数は+1される。',
    rarity: 'common',
    targetHand: 'ワンペア',
    handBonus: 1,
  },
  {
    id: 'FLUSH_POWER',
    name: '四色のジェム',
    icon: '💎',
    cost: 50,
    description: '【フラッシュ】の強さ指数は+2される。',
    rarity: 'uncommon',
    targetHand: 'フラッシュ',
    handBonus: 2,
  },
  {
    id: 'SHOP_DISCOUNT',
    name: '商人の指輪',
    icon: '💍',
    cost: 38,
    description: 'デッキ強化画面で必要な通貨が10%割引される。',
    rarity: 'common',
    shopDiscount: 0.10,
  },
  {
    id: 'LUCKY_DICE',
    name: '幸運のダイス',
    icon: '🎲',
    cost: 55,
    description: '自分のHPが0になった時サイコロを振り、5または6が出ればHPを1にする。',
    rarity: 'rare',
    onDeath: true,
  },
  {
    id: 'STRAIGHT_MASTER',
    name: 'ランナーズシューズ',
    icon: '👟',
    cost: 48,
    description: '【ストレート】の強さ指数は+2される。',
    rarity: 'uncommon',
    targetHand: 'ストレート',
    handBonus: 2,
  },
  {
    id: 'FULL_HOUSE_UP',
    name: '家庭の守護神',
    icon: '🏠',
    cost: 52,
    description: '【フルハウス】の強さ指数は+1される。',
    rarity: 'uncommon',
    targetHand: 'フルハウス',
    handBonus: 1,
  },
  {
    id: 'EXTRA_HP',
    name: '鉄の心臓',
    icon: '❤️‍🔥',
    cost: 60,
    description: '最大HPが10増加する。（即時適用）',
    rarity: 'rare',
    onPickup: (state) => {
      state.player.maxHp += 10;
      state.player.hp = Math.min(state.player.hp + 10, state.player.maxHp);
    },
  },
  {
    id: 'HIGHCARD_BONUS',
    name: '孤高の一枚',
    icon: '🃏',
    cost: 30,
    description: '【ハイカード】の強さ指数は+3される。',
    rarity: 'common',
    targetHand: 'ハイカード',
    handBonus: 3,
  },
];

/** Pick N random items from pool, excluding already owned */
export function sampleArtifacts(pool, owned, n) {
  const available = pool.filter(a => !owned.find(o => o.id === a.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/** Get effective hand strength with artifact bonuses */
export function getEffectiveStrength(handName, baseStrength, artifacts) {
  let bonus = 0;
  for (const art of artifacts) {
    if (art.targetHand === handName && art.handBonus) {
      bonus += art.handBonus;
    }
  }
  return baseStrength + bonus;
}

/** Apply card effects to compute final damage result */
export function applyCardEffects(selectedCards, handEval, baseDamage, artifacts) {
  let damage = baseDamage;
  let strengthMod = 0;
  let lifesteal = false;
  let lifestealAmount = 0;
  let extraDamage = 0;

  for (const card of selectedCards) {
    if (!card.effect) continue;
    const e = card.effect;
    switch (e.type) {
      case 'STRENGTH_BOOST':
        strengthMod += e.value;
        break;
      case 'DAMAGE_PLUS':
        extraDamage += e.value;
        break;
      case 'HAND_DAMAGE_PLUS':
        if (e.targetHand === handEval.name) extraDamage += e.value;
        break;
      case 'LIFESTEAL':
        lifesteal = true;
        break;
    }
  }

  // Recompute base with strength mod
  const finalStrength = getEffectiveStrength(handEval.name, handEval.strength, artifacts) + strengthMod;
  damage = finalStrength + extraDamage;

  if (lifesteal) {
    lifestealAmount = Math.floor(damage / 2);
  }

  return { damage, finalStrength, lifesteal, lifestealAmount, strengthMod, extraDamage };
}
