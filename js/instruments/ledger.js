/* ============================================================================
   INSTRUMENT — World Cup Fantasy live ledger
   ----------------------------------------------------------------------------
   The hard part was never the scoring formula. It was that the feed lies:
   goals get reassigned an hour later, assists appear late, cards get rescinded.
   Points are already banked and shown to users by the time the correction
   arrives.

   The answer was an immutable, revertible audit log. Every correction is an
   entry, and every entry can be undone without unwinding the tournament. So
   the instrument is the match clock and that log.
   ========================================================================== */

import { dampedEase, DAMPING, reduced } from '../secondorder.js';

const gsap = window.gsap;

/* A match, as the feed delivered it — including the parts it got wrong. */
const FEED = [
  { min: 12, kind: 'goal',    player: 'Rodríguez',  pts: 6,  text: 'Goal · Rodríguez' },
  { min: 12, kind: 'assist',  player: 'Okafor',     pts: 3,  text: 'Assist · Okafor' },
  { min: 27, kind: 'card',    player: 'Lindqvist',  pts: -1, text: 'Yellow · Lindqvist' },
  { min: 41, kind: 'goal',    player: 'Okafor',     pts: 6,  text: 'Goal · Okafor' },
  { min: 55, kind: 'correct', player: 'Rodríguez',  pts: -6, text: 'Goal at 12\' reassigned off Rodríguez',
    note: 'Feed correction' },
  { min: 55, kind: 'correct', player: 'Haugen',     pts: 6,  text: 'Goal at 12\' credited to Haugen',
    note: 'Feed correction' },
  { min: 68, kind: 'save',    player: 'Bertrand',   pts: 2,  text: 'Penalty saved · Bertrand' },
  { min: 79, kind: 'correct', player: 'Lindqvist',  pts: 1,  text: 'Yellow at 27\' rescinded',
    note: 'Feed correction' },
  { min: 88, kind: 'goal',    player: 'Haugen',     pts: 6,  text: 'Goal · Haugen' },
];

/* Squads. The point of showing them: when the feed reassigns the 12' goal at
   55', whoever owns Rodríguez drops and whoever owns Haugen climbs — points
   that were already on screen move. That is the whole reason the audit log
   exists. */
const TEAMS = [
  { name: 'Limestone XI',  players: ['Rodríguez', 'Bertrand'], base: 31 },
  { name: 'Kingston Rd',   players: ['Okafor'],                base: 38 },
  { name: 'North of 7',    players: ['Haugen', 'Lindqvist'],   base: 33 },
  { name: 'Casablanca FC', players: ['Bertrand', 'Lindqvist'], base: 36 },
];

export function mount(container, system) {
  container.innerHTML = `
    <div class="ledger">
      <div class="ledger-head">
        <div class="ledger-clock">
          <span class="ledger-min">0'</span>
          <span class="ledger-label">match clock</span>
        </div>
        <div class="ledger-bank">
          <span class="ledger-pts">0</span>
          <span class="ledger-label">points banked</span>
        </div>
      </div>

      <input class="ledger-scrub" type="range" min="0" max="90" value="0"
             aria-label="Scrub the match clock to replay the feed">

      <div class="ledger-split">
        <div class="ledger-log" role="log" aria-live="polite"></div>
        <aside class="ledger-board">
          <div class="ledger-board-head">standings</div>
          <ol class="ledger-teams"></ol>
        </aside>
      </div>

      <p class="ledger-hint">Scrub to 55'. The feed takes a goal back.</p>
    </div>
  `;

  const minEl = container.querySelector('.ledger-min');
  const ptsEl = container.querySelector('.ledger-pts');
  const scrub = container.querySelector('.ledger-scrub');
  const log = container.querySelector('.ledger-log');
  const hint = container.querySelector('.ledger-hint');

  let minute = 0;
  let shown = 0;
  const reverted = new Set();
  let auto = true;
  let raf = 0;
  let alive = true;
  let last = 0;

  const teamsEl = container.querySelector('.ledger-teams');
  let lastOrder = '';

  function total() {
    return FEED
      .slice(0, shown)
      .reduce((sum, e, i) => sum + (reverted.has(i) ? 0 : e.pts), 0);
  }

  /** A team's points: base plus every applied event for a player it owns. */
  function teamPoints(team) {
    return FEED.slice(0, shown).reduce((sum, e, i) => {
      if (reverted.has(i) || !team.players.includes(e.player)) return sum;
      return sum + e.pts;
    }, team.base);
  }

  function paintBoard() {
    const rows = TEAMS
      .map((t) => ({ t, pts: teamPoints(t) }))
      .sort((a, b) => b.pts - a.pts);
    const order = rows.map((r) => r.t.name).join('|');
    const moved = order !== lastOrder && lastOrder !== '';
    lastOrder = order;

    teamsEl.innerHTML = rows.map((r, i) => `
      <li class="ledger-team">
        <span class="lt-rank">${i + 1}</span>
        <span class="lt-name">${r.t.name}</span>
        <span class="lt-pts">${r.pts}</span>
      </li>`).join('');

    if (moved && gsap && !reduced()) {
      gsap.from(teamsEl.children, {
        opacity: 0.2, x: -8, duration: 0.6, stagger: 0.05,
        ease: dampedEase(DAMPING.card, 1.2),
      });
    }
  }

  function paintTotal() {
    const v = total();
    ptsEl.textContent = String(v);
    if (gsap && !reduced()) {
      gsap.fromTo(ptsEl,
        { y: -10, opacity: 0.4 },
        { y: 0, opacity: 1, duration: 0.7, ease: dampedEase(DAMPING.data, 1.3) }
      );
    }
    paintBoard();
  }

  function addEntry(e, i) {
    const row = document.createElement('div');
    row.className = `lentry lentry--${e.kind}`;
    row.dataset.index = String(i);
    row.innerHTML = `
      <span class="lentry-min">${e.min}'</span>
      <span class="lentry-text">${e.text}</span>
      <span class="lentry-pts">${e.pts > 0 ? '+' : ''}${e.pts}</span>
      ${e.kind === 'correct' ? '<button type="button" class="lentry-undo">revert</button>' : ''}
    `;
    log.prepend(row);

    const undo = row.querySelector('.lentry-undo');
    if (undo) {
      undo.addEventListener('click', () => {
        const on = reverted.has(i);
        if (on) reverted.delete(i); else reverted.add(i);
        row.classList.toggle('is-reverted', !on);
        undo.textContent = on ? 'revert' : 'restore';
        paintTotal();
        hint.textContent = on
          ? 'Correction reapplied.'
          : 'Correction reverted. The log keeps both, so neither is lost.';
      });
    }

    if (gsap && !reduced()) {
      gsap.from(row, {
        opacity: 0, x: -18, duration: 0.65,
        ease: dampedEase(DAMPING.card, 1.2),
      });
    }
  }

  function setMinute(m) {
    minute = m;
    minEl.textContent = `${Math.floor(m)}'`;

    // Replay from scratch when scrubbed backwards.
    const want = FEED.filter((e) => e.min <= m).length;
    if (want < shown) {
      log.innerHTML = '';
      shown = 0;
      reverted.clear();
    }
    while (shown < want) {
      addEntry(FEED[shown], shown);
      shown++;
    }
    paintTotal();
  }

  scrub.addEventListener('input', () => {
    auto = false;
    setMinute(Number(scrub.value));
  });

  function frame(now) {
    if (!alive) return;
    if (!last) last = now;
    const dt = (now - last) / 1000;
    last = now;

    if (auto && !reduced()) {
      const m = Math.min(minute + dt * 9, 90);
      scrub.value = String(Math.round(m));
      setMinute(m);
      if (m >= 90) auto = false;
    }
    raf = requestAnimationFrame(frame);
  }

  setMinute(0);
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      container.innerHTML = '';
    },
  };
}
