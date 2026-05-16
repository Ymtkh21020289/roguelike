// ── cards.js ──────────────────────────────────────────────────────────────
// Card definitions, deck generation, poker hand evaluation

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const RANK_VALUE = {
  'A': 14, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13
};

export const SUIT_COLOR = {
  '♠': 'black', '♣': 'black', '♥': 'red', '♦': 'red'
};

/** Create a standard 52-card deck */
export function createDeck() {
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: id++,
        suit,
        rank,
        color: SUIT_COLOR[suit],
        effect: null  // special effect slot
      });
    }
  }
  return deck;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── HAND EVALUATION ──────────────────────────────────────────────────────

// strength index per hand type
export const HAND_STRENGTH = {
  'ロイヤルフラッシュ': 10,
  'ストレートフラッシュ': 9,
  'フォーカード': 8,
  'フルハウス': 7,
  'フラッシュ': 6,
  'ストレート': 5,
  'スリーカード': 4,
  'ツーペア': 3,
  'ワンペア': 2,
  'ハイカード': 1,
};

export const HAND_NAMES = Object.keys(HAND_STRENGTH);

/**
 * Evaluate a 5-card hand (array of card objects).
 * Supports suit-override via card.suitOverride (for dual-suit effect).
 * Returns { name, strength }
 */
export function evaluateHand(cards) {
  if (!cards || cards.length !== 5) return { name: 'ハイカード', strength: 1 };

  // Resolve effective suits (dual-suit effect)
  const resolvedCards = cards.map(c => ({
    ...c,
    effectiveSuit: c.effect?.type === 'DUAL_SUIT' ? c.effect.suits : [c.suit]
  }));

  const ranks = resolvedCards.map(c => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const rankCounts = {};
  for (const r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1;
  const counts = Object.values(rankCounts).sort((a, b) => b - a);

  // Check flush: can any suit assignment make all same suit?
  const isFlush = checkFlush(resolvedCards);
  const isStraight = checkStraight(ranks);

  // Royal flush
  if (isFlush && isStraight && ranks[0] === 14 && ranks[4] === 10) {
    return { name: 'ロイヤルフラッシュ', strength: HAND_STRENGTH['ロイヤルフラッシュ'] };
  }
  if (isFlush && isStraight) return { name: 'ストレートフラッシュ', strength: HAND_STRENGTH['ストレートフラッシュ'] };
  if (counts[0] === 4) return { name: 'フォーカード', strength: HAND_STRENGTH['フォーカード'] };
  if (counts[0] === 3 && counts[1] === 2) return { name: 'フルハウス', strength: HAND_STRENGTH['フルハウス'] };
  if (isFlush) return { name: 'フラッシュ', strength: HAND_STRENGTH['フラッシュ'] };
  if (isStraight) return { name: 'ストレート', strength: HAND_STRENGTH['ストレート'] };
  if (counts[0] === 3) return { name: 'スリーカード', strength: HAND_STRENGTH['スリーカード'] };
  if (counts[0] === 2 && counts[1] === 2) return { name: 'ツーペア', strength: HAND_STRENGTH['ツーペア'] };
  if (counts[0] === 2) return { name: 'ワンペア', strength: HAND_STRENGTH['ワンペア'] };
  return { name: 'ハイカード', strength: HAND_STRENGTH['ハイカード'] };
}

function checkFlush(resolvedCards) {
  // With dual-suit, a card can act as either suit.
  // Brute-force: pick one effective suit per dual-suit card, check if any combo works.
  const suitOptions = resolvedCards.map(c => c.effectiveSuit);

  function recurse(idx, chosen) {
    if (idx === 5) {
      return new Set(chosen).size === 1;
    }
    for (const s of suitOptions[idx]) {
      if (recurse(idx + 1, [...chosen, s])) return true;
    }
    return false;
  }

  return recurse(0, []);
}

function checkStraight(sortedRanks) {
  // Normal straight
  const normal = sortedRanks.every((r, i) => i === 0 || sortedRanks[i - 1] - r === 1);
  if (normal) return true;
  // A-2-3-4-5
  if (sortedRanks[0] === 14) {
    const low = [5, 4, 3, 2, 1];
    const alt = [14, ...sortedRanks.slice(1)];
    // replace A with 1
    const adjusted = [5, sortedRanks[1], sortedRanks[2], sortedRanks[3], sortedRanks[4]];
    return adjusted.every((r, i) => i === 0 || adjusted[i - 1] - r === 1);
  }
  return false;
}
