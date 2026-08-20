/* ============================================================================
   TUNER — the plate is the index
   ----------------------------------------------------------------------------
   Six systems, six Chladni modes. Sweeping the drive frequency locks the plate
   into a mode and loads that system's instrument. There is no scroll hijack:
   the rail is a discrete control you click, drag or arrow through, so the page
   still scrolls the way a page scrolls.

   Each system's instrument is loaded on demand from js/instruments/. They all
   expose the same shape:

       mount(container, system) -> { destroy(): void }
   ========================================================================== */

import { SYSTEMS, formatFreq } from './systems.js';
import { dampedEase, DAMPING, reduced } from './secondorder.js';

const gsap = window.gsap;

/* Instruments are keyed by the `instrument` field in systems.js. */
const LOADERS = {
  bodymap:  () => import('./instruments/bodymap.js'),
  sweep:    () => import('./instruments/sweep.js'),
  trace:    () => import('./instruments/trace.js'),
  vault:    () => import('./instruments/vault.js'),
  ledger:   () => import('./instruments/ledger.js'),
  sessions: () => import('./instruments/sessions.js'),
};

export class Tuner {
  /**
   * @param {HTMLElement} root Section containing the rail and panel slots.
   * @param {import('./cymatics.js').CymaticPlate|null} plate
   */
  constructor(root, plate) {
    this.root = root;
    this.plate = plate;
    this.index = -1;
    this.live = null;          // { destroy } of the mounted instrument
    this.busy = false;
    this.rail = root.querySelector('[data-rail]');
    this.panel = root.querySelector('[data-panel]');
    this.stage = root.querySelector('[data-stage]');
    this.readout = root.querySelector('[data-freq]');
    this._onKey = this._key.bind(this);
  }

  init() {
    this._buildRail();
    this._bindDrag();
    document.addEventListener('keydown', this._onKey);
    this.select(0, true);
  }

  destroy() {
    document.removeEventListener('keydown', this._onKey);
    if (this.live) { this.live.destroy(); this.live = null; }
  }

  /* ------------------------------------------------------------------ rail */

  _buildRail() {
    if (!this.rail) return;
    this.rail.innerHTML = '';

    const lo = SYSTEMS[0].freq;
    const hi = SYSTEMS[SYSTEMS.length - 1].freq;

    SYSTEMS.forEach((sys, i) => {
      // Position each station by its actual frequency, so the spacing on the
      // rail reflects the mode spectrum rather than being evenly divided.
      const pos = ((sys.freq - lo) / (hi - lo)) * 100;

      const station = document.createElement('button');
      station.type = 'button';
      station.className = 'station';
      station.style.left = `${pos}%`;
      station.dataset.index = String(i);
      station.setAttribute('aria-label', `Tune to ${sys.name}, ${formatFreq(sys.freq)}`);
      station.innerHTML =
        `<span class="station-tick" aria-hidden="true"></span>` +
        `<span class="station-no">${sys.no}</span>` +
        `<span class="station-name">${sys.name}</span>`;

      station.addEventListener('click', () => this.select(i));
      this.rail.appendChild(station);
    });

    this.needle = document.createElement('div');
    this.needle.className = 'needle';
    this.needle.setAttribute('aria-hidden', 'true');
    this.rail.appendChild(this.needle);

    this.stations = Array.from(this.rail.querySelectorAll('.station'));
  }

  _bindDrag() {
    if (!this.rail) return;
    let dragging = false;

    const pick = (clientX) => {
      const r = this.rail.getBoundingClientRect();
      const t = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
      const lo = SYSTEMS[0].freq;
      const hi = SYSTEMS[SYSTEMS.length - 1].freq;
      const f = lo + t * (hi - lo);
      // Snap to whichever station is nearest in frequency.
      let best = 0, bestD = Infinity;
      SYSTEMS.forEach((s, i) => {
        const d = Math.abs(s.freq - f);
        if (d < bestD) { bestD = d; best = i; }
      });
      this.select(best);
    };

    this.rail.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.station')) return;  // clicks handled per-station
      dragging = true;
      this.rail.setPointerCapture(e.pointerId);
      pick(e.clientX);
    });
    this.rail.addEventListener('pointermove', (e) => { if (dragging) pick(e.clientX); });
    this.rail.addEventListener('pointerup', () => { dragging = false; });
    this.rail.addEventListener('pointercancel', () => { dragging = false; });
  }

  _key(e) {
    // Only when the tuner is the thing on screen, and never while typing.
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    const r = this.root.getBoundingClientRect();
    if (r.bottom < 120 || r.top > window.innerHeight - 120) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.select(Math.min(this.index + 1, SYSTEMS.length - 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.select(Math.max(this.index - 1, 0));
    }
  }

  /* --------------------------------------------------------------- select */

  async select(i, immediate = false) {
    if (i === this.index || this.busy) return;
    const sys = SYSTEMS[i];
    if (!sys) return;

    this.busy = true;
    const prev = this.index;
    this.index = i;

    // Rail state
    this.stations?.forEach((s, n) => s.classList.toggle('is-live', n === i));
    if (this.needle) {
      const lo = SYSTEMS[0].freq;
      const hi = SYSTEMS[SYSTEMS.length - 1].freq;
      const pos = ((sys.freq - lo) / (hi - lo)) * 100;
      if (immediate || reduced() || !gsap) {
        this.needle.style.left = `${pos}%`;
      } else {
        // The needle is a physical part: it rings past the station and settles.
        gsap.to(this.needle, {
          left: `${pos}%`,
          duration: 0.95,
          ease: dampedEase(DAMPING.card, 1.3),
        });
      }
    }
    if (this.readout) this.readout.textContent = formatFreq(sys.freq);

    // Drive the plate into this system's mode.
    if (this.plate) this.plate.setMode(sys.mode[0], sys.mode[1], immediate);

    // Swap the panel: the outgoing system is driven apart, the incoming one
    // settles. Overload out, stabilize in.
    await this._swapPanel(sys, prev, immediate);
    this.busy = false;
  }

  async _swapPanel(sys, prev, immediate) {
    if (!this.panel) return;

    if (this.live) { this.live.destroy(); this.live = null; }

    const out = this.panel.firstElementChild;
    if (out && !immediate && gsap && !reduced()) {
      await gsap.to(out, {
        opacity: 0,
        y: -18,
        duration: 0.32,
        ease: 'power2.in',
      });
    }
    this.panel.innerHTML = '';

    const card = document.createElement('article');
    card.className = 'sysdoc';
    card.innerHTML = `
      <p class="sysdoc-domain">${sys.domain} · ${sys.period}</p>
      <h3 class="sysdoc-name"><a href="${sys.href}">${sys.name}</a></h3>
      <p class="sysdoc-lede">${sys.lede}</p>
      <p class="sysdoc-detail">${sys.detail}</p>
      <dl class="sysdoc-spec">
        ${sys.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
      </dl>
      <a class="sysdoc-link" href="${sys.href}">Open ${sys.no} <span aria-hidden="true">&rarr;</span></a>
    `;
    this.panel.appendChild(card);

    if (!immediate && gsap && !reduced()) {
      gsap.fromTo(card,
        { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 1.0, ease: dampedEase(DAMPING.card, 1.4) }
      );
      gsap.fromTo(card.querySelectorAll('.sysdoc-spec > div'),
        { opacity: 0, x: 14 },
        { opacity: 1, x: 0, duration: 0.7, stagger: 0.05, delay: 0.12, ease: dampedEase(DAMPING.data, 1.0) }
      );
    }

    // Mount this system's instrument.
    if (this.stage) {
      this.stage.innerHTML = '';
      const load = LOADERS[sys.instrument];
      if (load) {
        try {
          const mod = await load();
          if (this.index === SYSTEMS.indexOf(sys)) {
            this.live = mod.mount(this.stage, sys);
          }
        } catch (err) {
          // A broken instrument must not take the page with it.
          console.warn(`[tuner] instrument "${sys.instrument}" failed:`, err);
          this.stage.innerHTML =
            `<p class="instrument-fallback">${sys.domain}</p>`;
        }
      }
    }
  }
}

export function mountTuner(root, plate) {
  if (!root) return null;
  const t = new Tuner(root, plate);
  t.init();
  return t;
}
