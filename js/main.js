/* ============================================================================
   MAIN — entry point
   ----------------------------------------------------------------------------
   Everything that must survive a Barba container swap lives in setup()/reset()
   pairs so a page transition can tear down and re-arm cleanly.
   ========================================================================== */

import { mountPlate } from './cymatics.js';
import {
  initMotion, teardownMotion, initScroll, couplePlate,
} from './motion.js';
import { onReducedChange } from './secondorder.js';

/* Reveals are hidden by CSS only when this class is present, so a script that
   dies before this line leaves the page fully readable. */
document.documentElement.classList.add('js-enabled');

let plate = null;

/* ---------------------------------------------------------------------------
   Theme
   ---------------------------------------------------------------------------
   Manual only, never derived from prefers-color-scheme. The inline script in
   <head> applies the stored choice before first paint; this only wires the
   toggle and keeps the plate's palette in sync.
   ------------------------------------------------------------------------- */

function initTheme() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  const label = toggle.querySelector('.theme-toggle-text');
  const paint = (isLight) => {
    if (label) label.textContent = isLight ? 'LIGHT' : 'DARK';
    toggle.setAttribute('aria-pressed', String(isLight));
    toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
  };

  paint(document.documentElement.getAttribute('data-theme') === 'light');

  toggle.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('theme', 'dark'); } catch { /* private mode */ }
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      try { localStorage.setItem('theme', 'light'); } catch { /* private mode */ }
    }
    paint(!isLight);
    // The plate samples its colours from CSS custom properties, so it has to
    // be told the tokens moved.
    if (plate) plate.readTokens();
  });
}

/* ---------------------------------------------------------------------------
   Navigation
   ------------------------------------------------------------------------- */

function initNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');
  if (!toggle || !nav) return;

  const close = () => {
    nav.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  const header = document.getElementById('header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
}

/* ---------------------------------------------------------------------------
   Section readout — the header shows which system you are looking at
   ------------------------------------------------------------------------- */

function initReadout(scope) {
  const out = document.querySelector('#headerStatus .readout-text');
  if (!out || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && e.target.dataset.status) {
        out.textContent = e.target.dataset.status;
      }
    });
  }, { rootMargin: '-35% 0px -60% 0px' });

  scope.querySelectorAll('[data-status]').forEach((s) => io.observe(s));
  return io;
}

/* ---------------------------------------------------------------------------
   Per-page setup
   ------------------------------------------------------------------------- */

export function setupPage(scope = document) {
  const canvas = scope.querySelector('[data-cymatics]');
  if (canvas) {
    plate = mountPlate(canvas);
    // mountPlate returns null when WebGL2 is unavailable; the static poster
    // underneath stays visible in that case.
    if (plate) canvas.closest('[data-plate-host]')?.setAttribute('data-webgl', 'on');
  }

  initMotion(scope);
  initReadout(scope);
  couplePlate(plate);
}

export function resetPage() {
  teardownMotion();
  if (plate) { plate.destroy(); plate = null; }
}

/* ---------------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------------- */

/* Nothing on this page is worth hiding permanently. If a font never resolves,
   a plugin throws, or ScrollTrigger fails to fire, this puts everything back
   after three seconds rather than leaving a blank page. */
function failsafe() {
  setTimeout(() => {
    document.querySelectorAll('[data-reveal], [data-split]').forEach((el) => {
      if (getComputedStyle(el).opacity === '0') {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }
    });
  }, 3000);
}

function boot() {
  initTheme();
  initNav();
  initScroll();
  setupPage(document);
  failsafe();

  // If the visitor flips the OS preference mid-session, reload the motion
  // layer rather than leaving half-animated state behind.
  onReducedChange(() => {
    resetPage();
    setupPage(document);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
