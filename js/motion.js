/* ============================================================================
   MOTION — scroll wiring
   ----------------------------------------------------------------------------
   Turns the second-order engine into actual page behaviour: reveals that ring
   into place, scaled by how hard the page is being scrolled.

   GSAP, ScrollTrigger, SplitText and Lenis are loaded as globals by <script>
   tags ahead of this module, so they are read off window rather than imported.
   ========================================================================== */

import { easeFor, durationFor, drive, excitation, reduced, DAMPING, dampedEase }
  from './secondorder.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const SplitText = window.SplitText;

let lenis = null;
let registered = false;

/* ---------------------------------------------------------------------------
   Smooth scroll
   ------------------------------------------------------------------------- */

export function initScroll() {
  if (reduced() || !window.Lenis) return null;
  if (lenis) return lenis;

  lenis = new window.Lenis({
    duration: 1.05,
    // Exponential approach — the scroll position itself is a first-order lag,
    // which is the same family of behaviour as everything else on the page.
    easing: (t) => 1 - Math.pow(2, -10 * t),
    smoothWheel: true,
    touchMultiplier: 1.6,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.documentElement.classList.add('lenis');

  return lenis;
}

export function destroyScroll() {
  if (!lenis) return;
  lenis.destroy();
  lenis = null;
  document.documentElement.classList.remove('lenis');
}

/** Jump to top without animating — used between Barba pages. */
export function scrollTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
}

/* ---------------------------------------------------------------------------
   Reveals
   ---------------------------------------------------------------------------
   Any element carrying data-reveal arrives as a step response. The role
   attribute picks the damping ratio; scroll velocity at the moment of firing
   scales how far it overshoots.
   ------------------------------------------------------------------------- */

function revealOne(el, trigger) {
  const role = el.dataset.reveal || 'display';
  const base = parseFloat(el.dataset.revealY || '') || 34;
  const velocity = trigger ? trigger.getVelocity() : 0;

  gsap.fromTo(el,
    { opacity: 0, y: drive(base, velocity) },
    {
      opacity: 1,
      y: 0,
      duration: durationFor(role),
      ease: easeFor(role),
      overwrite: 'auto',
    }
  );
}

export function initReveals(scope = document) {
  const els = scope.querySelectorAll('[data-reveal]');

  els.forEach((el) => {
    // Stagger groups: a container marked data-reveal-group animates its
    // children in sequence rather than as one block.
    const group = el.dataset.revealGroup
      ? Array.from(el.children)
      : null;

    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: (self) => {
        if (group) {
          const role = el.dataset.reveal || 'card';
          gsap.set(el, { opacity: 1 });
          gsap.fromTo(group,
            { opacity: 0, y: drive(28, self.getVelocity()) },
            {
              opacity: 1,
              y: 0,
              duration: durationFor(role),
              ease: easeFor(role),
              stagger: reduced() ? 0 : 0.055,
              overwrite: 'auto',
            }
          );
        } else {
          revealOne(el, self);
        }
      },
    });
  });
}

/* ---------------------------------------------------------------------------
   Headline: split and ring in per line
   ------------------------------------------------------------------------- */

const splits = [];

export function initHeadlines(scope = document) {
  if (!SplitText) return;

  scope.querySelectorAll('[data-split]').forEach((el) => {
    // Fonts must be loaded before splitting, or lines break at the fallback
    // face's metrics and re-wrap when the real face arrives.
    const run = () => {
      const split = new SplitText(el, {
        type: 'lines',
        linesClass: 'line',
      });
      splits.push(split);

      // Each line needs a clipping parent for the mask-up effect.
      split.lines.forEach((line) => {
        const wrap = document.createElement('span');
        wrap.className = 'line-mask';
        line.parentNode.insertBefore(wrap, line);
        wrap.appendChild(line);
      });

      gsap.set(el, { opacity: 1 });
      gsap.from(split.lines, {
        yPercent: 118,
        duration: reduced() ? 0.2 : 1.25,
        ease: reduced() ? 'none' : dampedEase(DAMPING.display, 1.2),
        stagger: reduced() ? 0 : 0.085,
      });
    };

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
    else run();
  });
}

/* ---------------------------------------------------------------------------
   Variable-font axis driving
   ---------------------------------------------------------------------------
   Scroll velocity compresses the width axis and thickens the weight axis, so
   the type visibly loads up while the page is being driven and relaxes back
   when it settles. This is the single most distinctive behaviour on the site.
   ------------------------------------------------------------------------- */

const REST_WDTH = 88;
const REST_WGHT = 620;
const DRIVE_WDTH = 66;   // narrows under load
const DRIVE_WGHT = 780;  // and thickens

export function initAxisDrive() {
  if (reduced()) return;

  const root = document.documentElement;
  let current = 0;

  const state = { level: 0 };

  ScrollTrigger.create({
    start: 0,
    end: () => ScrollTrigger.maxScroll(window),
    onUpdate: (self) => {
      const target = excitation(self.getVelocity());
      // Only re-tween on a meaningful change, otherwise this fires every frame.
      if (Math.abs(target - current) < 0.04) return;
      current = target;
      gsap.to(state, {
        level: target,
        duration: 0.5,
        ease: dampedEase(0.7, 0.8),
        overwrite: true,
        onUpdate: () => {
          const k = state.level;
          root.style.setProperty('--wdth-display', (REST_WDTH + (DRIVE_WDTH - REST_WDTH) * k).toFixed(1));
          root.style.setProperty('--wght-display', (REST_WGHT + (DRIVE_WGHT - REST_WGHT) * k).toFixed(0));
        },
      });
    },
  });
}

/* ---------------------------------------------------------------------------
   Reduced motion housekeeping
   ---------------------------------------------------------------------------
   Autoplaying demo clips are motion too. Under the preference they are paused
   and given controls so they can still be watched deliberately.
   ------------------------------------------------------------------------- */

export function tameAutoplay(scope = document) {
  if (!reduced()) return;
  scope.querySelectorAll('video[autoplay]').forEach((v) => {
    v.autoplay = false;
    v.controls = true;
    v.pause();
  });
}

/* ---------------------------------------------------------------------------
   Lifecycle
   ------------------------------------------------------------------------- */

export function initMotion(scope = document) {
  if (!gsap || !ScrollTrigger) {
    // Without the libraries nothing should stay hidden.
    document.documentElement.classList.remove('js-enabled');
    return;
  }

  if (!registered) {
    gsap.registerPlugin(ScrollTrigger);
    if (SplitText) gsap.registerPlugin(SplitText);
    registered = true;
  }

  initHeadlines(scope);
  initReveals(scope);
  tameAutoplay(scope);
}

/** Tear down per-page triggers before Barba swaps containers. */
export function teardownMotion() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  splits.splice(0).forEach((s) => { try { s.revert(); } catch { /* already gone */ } });
}
