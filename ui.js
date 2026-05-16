// ── ui.js ─────────────────────────────────────────────────────────────────
// All DOM creation and rendering helpers

import { HAND_STRENGTH } from './cards.js';
import { CARD_EFFECTS } from './effects.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── TOOLTIP ───────────────────────────────────────────────────────────────

const tooltip = document.getElementById('tooltip');

export function showTooltip(e, card) {
  let html = `<div class="tooltip-card-name">${card.rank}${card.suit}</div>`;
  if (card.effect) {
    const eff = CARD_EFFECTS.find(ef => ef.id === card.effect.type);
    if (eff) {
      let desc = typeof eff.description === 'function'
        ? eff.description(card.effect.targetHand || card.effect.suits?.[0], card.effect.suits?.[1])
        : eff.description;
      html += `<div class="tooltip-effect">${eff.icon} ${eff.name}</div>`;
      html += `<div style="color:#aaa;font-size:7px;">${desc}</div>`;
    }
  }
  tooltip.innerHTML = html;
  tooltip.classList.remove('hidden');
  positionTooltip(e);
}

export function hideTooltip() {
  tooltip.classList.add('hidden');
}

function positionTooltip(e) {
  const x = e.clientX + 14;
  const y = e.clientY + 14;
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  tooltip.style.left = (x + tw > window.innerWidth ? x - tw - 28 : x) + 'px';
  tooltip.style.top = (y + th > window.innerHeight ? y - th - 28 : y) + 'px';
}

document.addEventListener('mousemove', (e) => {
  if (!tooltip.classList.contains('hidden')) positionTooltip(e);
});

// ── CARD RENDERING ────────────────────────────────────────────────────────

const SUIT_SYMBOL = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };

export function createCardEl(card, opts = {}) {
  const el = document.createElement('div');
  el.className = `card ${card.color}`;
  if (opts.selected) el.classList.add('selected');
  if (card.effect) el.classList.add('has-effect');
  if (opts.back) {
    el.classList.add('back');
    return el;
  }

  el.innerHTML = `
    <div class="card-corner tl">${card.rank}<br>${card.suit}</div>
    <div class="card-center">${card.suit}</div>
    <div class="card-corner br">${card.rank}<br>${card.suit}</div>
  `;

  if (opts.animate) el.classList.add('card-deal');

  el.addEventListener('mouseenter', (e) => showTooltip(e, card));
  el.addEventListener('mouseleave', hideTooltip);

  return el;
}

// ── HAND RENDERING ────────────────────────────────────────────────────────

export function renderHand(handArea, hand, selectedIndices, onToggle) {
  handArea.innerHTML = '';
  const n = hand.length;
  const spreadAngle = 32; // total degrees
  const cardSpread = 64;  // px between cards

  hand.forEach((card, i) => {
    const el = createCardEl(card, { selected: selectedIndices.includes(i) });
    const angle = n > 1 ? (i / (n - 1) - 0.5) * spreadAngle : 0;
    const xOff = (i - (n - 1) / 2) * cardSpread;
    const yOff = Math.abs(angle) * 1.2;

    el.style.left = `calc(50% + ${xOff}px - 34px)`;
    el.style.transform = `rotate(${angle}deg) translateY(${yOff}px)`;
    el.style.transition = 'transform 0.2s, bottom 0.2s, box-shadow 0.2s';
    el.style.zIndex = i;

    el.addEventListener('click', () => onToggle(i));

    // Hover: straighten & lift
    el.addEventListener('mouseenter', () => {
      el.style.transform = `rotate(0deg) translateY(-20px)`;
      el.style.zIndex = 100;
    });
    el.addEventListener('mouseleave', () => {
      const sel = selectedIndices.includes(i);
      el.style.transform = `rotate(${angle}deg) translateY(${yOff}px) ${sel ? 'translateY(-10px)' : ''}`;
      el.style.zIndex = i;
    });

    handArea.appendChild(el);
  });
}

// ── PLAYED CARDS AREA ─────────────────────────────────────────────────────

export function renderPlayedCards(rowEl, cards) {
  rowEl.innerHTML = '';
  if (!cards || cards.length === 0) return;
  cards.forEach(card => {
    const el = createCardEl(card, { animate: true });
    el.style.width = '60px';
    el.style.height = '86px';
    rowEl.appendChild(el);
  });
}

// ── HUD ───────────────────────────────────────────────────────────────────

export function renderHUD(state) {
  const hud = $('#hud');
  if (!hud) return;
  hud.innerHTML = `
    <div class="hud-panel">
      <div class="hud-label">ENEMY</div>
      <div class="hud-name">${state.enemy.name || '---'}</div>
      <div class="hp-bar-wrap">
        <div class="hp-bar enemy" style="width:${state.enemy.maxHp ? (state.enemy.hp / state.enemy.maxHp * 100) : 0}%"></div>
      </div>
      <div class="hp-text">${state.enemy.hp} / ${state.enemy.maxHp}</div>
    </div>
    <div class="hud-panel">
      <div class="hud-label">PLAYER</div>
      <div class="hud-name">あなた</div>
      <div class="hp-bar-wrap">
        <div class="hp-bar player" style="width:${state.player.maxHp ? (state.player.hp / state.player.maxHp * 100) : 0}%"></div>
      </div>
      <div class="hp-text">${state.player.hp} / ${state.player.maxHp}</div>
    </div>
    <div class="hud-panel">
      <div class="hud-label">CURRENCY</div>
      <div class="currency-display">💰 ${state.player.currency}</div>
    </div>
  `;
}

// ── ARTIFACT PANEL ────────────────────────────────────────────────────────

export function renderArtifacts(artifacts) {
  const panel = $('#artifact-panel');
  if (!panel) return;
  const list = panel.querySelector('.artifact-list');
  list.innerHTML = '';
  if (artifacts.length === 0) {
    list.innerHTML = '<span style="font-size:8px;color:#666;">なし</span>';
    return;
  }
  artifacts.forEach(art => {
    const el = document.createElement('div');
    el.className = 'artifact-icon';
    el.textContent = art.icon;
    el.addEventListener('mouseenter', (e) => {
      tooltip.innerHTML = `<div class="tooltip-card-name">${art.icon} ${art.name}</div><div style="color:#aaa;font-size:7px;">${art.description}</div>`;
      tooltip.classList.remove('hidden');
      positionTooltip(e);
    });
    el.addEventListener('mouseleave', hideTooltip);
    list.appendChild(el);
  });
}

// ── DAMAGE FLOAT ──────────────────────────────────────────────────────────

export function showDamageFloat(targetEl, amount, isHeal = false) {
  const app = document.getElementById('app');
  const rect = targetEl.getBoundingClientRect();
  const appRect = app.getBoundingClientRect();

  const el = document.createElement('div');
  el.className = 'dmg-float' + (isHeal ? ' heal' : '');
  el.textContent = (isHeal ? '+' : '-') + amount;
  el.style.left = (rect.left - appRect.left + rect.width / 2) + 'px';
  el.style.top = (rect.top - appRect.top) + 'px';
  app.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// ── PHASE BANNER ──────────────────────────────────────────────────────────

export function showPhaseBanner(text) {
  const app = document.getElementById('app');
  const el = document.createElement('div');
  el.className = 'phase-banner';
  el.textContent = text;
  app.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

// ── SHAKE/FLASH ───────────────────────────────────────────────────────────

export function shakeElement(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

// ── TURN RESULT POPUP ─────────────────────────────────────────────────────

export function showTurnResult(log, container) {
  container.innerHTML = `
    <div class="turn-result-inner">
      <div>あなた: <span style="color:var(--gold)">${log.playerHandName}</span> (強さ: ${log.playerStrength})</div>
      <div>敵: <span style="color:var(--gold)">${log.enemyHandName}</span> (強さ: ${log.enemyStrength})</div>
      <div class="damage-text">-${log.playerDamage} (敵へ)</div>
      ${log.lifesteal ? `<div class="heal-text">+${log.lifestealAmount} HP回復</div>` : ''}
      <div style="color:var(--hp-red)">-${log.enemyDamage} (自分へ)</div>
      <div class="${log.winner === 'player' ? 'win-text' : log.winner === 'enemy' ? 'damage-text' : ''}">${log.winner === 'player' ? '⭐ あなたの勝利!' : log.winner === 'enemy' ? '💀 敵の勝利!' : '引き分け'}</div>
      ${log.diceResult ? `<div style="color:var(--gold)">🎲 ダイス: ${log.diceResult} ${log.diceResult >= 5 ? '→ 生き残り！' : '→ 失敗...'}</div>` : ''}
    </div>
  `;
  container.classList.remove('hidden');
}

// ── SCREEN MANAGEMENT ─────────────────────────────────────────────────────

export function showScreen(id) {
  // Hide all .screen elements AND the dynamically created shop-screen
  $$('.screen').forEach(s => s.classList.add('hidden'));
  const shopEl = document.getElementById('shop-screen');
  if (shopEl) shopEl.classList.add('hidden');

  const el = $(`#${id}`);
  if (el) el.classList.remove('hidden');
}
