/* ============================================================================
   SECOND ORDER — the motion engine
   ----------------------------------------------------------------------------
   Every animated element on this site is treated as an underdamped second-order
   system responding to a step input. Nothing eases; things overshoot, ring, and
   settle, the way a real mass on a spring does.

   The step response of a second-order system with damping ratio z (< 1) and
   natural frequency wn is

       y(t) = 1 - (e^(-z*wn*t) / sqrt(1 - z^2)) * sin(wd*t + phi)

   where  wd  = wn * sqrt(1 - z^2)     (damped natural frequency)
          phi = acos(z)                (phase offset)

   y(0) is exactly 0, because sin(acos(z)) == sqrt(1 - z^2) and the two terms
   cancel. y(t) approaches 1 asymptotically but never reaches it, which a GSAP
   ease must, so the tail is corrected linearly (see dampedEase below).
   ========================================================================== */

/* Damping ratios by role. Lower z = more ring. These are the whole visual
   signature of the site, so they are tuned here and nowhere else. */
export const DAMPING = {
  display:  0.60,  // headings: one confident overshoot
  card:     0.35,  // project cards: visible ring
  data:     0.85,  // mono labels and numbers: near-critical, crisp
  reactive: 0.20,  // hover and pointer response: springy
};

/* Cycles of ringing visible inside the tween's duration. Higher = busier. */
const DEFAULT_CYCLES = 1.6;

/**
 * Build a GSAP-compatible ease from a damping ratio.
 *
 * GSAP accepts any function (p) => value for `ease`, where p is normalized
 * progress. Time is normalized to the tween duration, so wn is derived from
 * the requested number of ring cycles rather than being a free parameter.
 *
 * @param {number} zeta   Damping ratio, 0 < zeta < 1. Below ~0.15 rings forever.
 * @param {number} cycles Visible oscillation cycles across the tween.
 * @returns {(p: number) => number}
 */
export function dampedEase(zeta = DAMPING.display, cycles = DEFAULT_CYCLES) {
  // Clamp away from the boundaries: zeta >= 1 is not underdamped (no ring, and
  // the sqrt below goes to zero), zeta <= 0 never settles.
  const z = Math.min(Math.max(zeta, 0.05), 0.95);

  const s = Math.sqrt(1 - z * z);
  const wd = 2 * Math.PI * cycles;  // damped frequency over p in [0, 1]
  const wn = wd / s;
  const phi = Math.acos(z);

  const y = (p) => 1 - (Math.exp(-z * wn * p) / s) * Math.sin(wd * p + phi);

  // y(1) lands just shy of (or past) 1. Adding p * (1 - y(1)) forces the
  // endpoint to exactly 1 while leaving y(0) = 0 and the ring shape intact.
  const tail = 1 - y(1);

  return (p) => (p >= 1 ? 1 : y(p) + p * tail);
}

/* Pre-built eases for the common roles, so callers do not rebuild the closure
   on every tween. */
export const EASE = {
  display:  dampedEase(DAMPING.display),
  card:     dampedEase(DAMPING.card),
  data:     dampedEase(DAMPING.data),
  reactive: dampedEase(DAMPING.reactive, 1.0),
};

/* ---------------------------------------------------------------------------
   Excitation
   ---------------------------------------------------------------------------
   Scroll velocity is the forcing input. A reveal that happens while the page
   is being flung scrolls harder than one that drifts into view, so the same
   element overshoots further. This is what makes the motion feel driven rather
   than scripted.
   ------------------------------------------------------------------------- */

/** Scroll speed, in px/s, at which excitation saturates. */
const VELOCITY_CEILING = 2600;

/**
 * Map a ScrollTrigger velocity to a 0..1 excitation level.
 * @param {number} velocity Signed px/s from ScrollTrigger.getVelocity().
 */
export function excitation(velocity) {
  const v = Math.abs(velocity || 0);
  // sqrt curve: a gentle scroll still registers, a fast one saturates rather
  // than launching things off the page.
  return Math.min(Math.sqrt(v / VELOCITY_CEILING), 1);
}

/**
 * Scale a base displacement by how hard the system is being driven.
 * @param {number} base     Resting displacement in px.
 * @param {number} velocity Signed px/s.
 * @param {number} gain     Multiplier at full excitation.
 */
export function drive(base, velocity, gain = 1.8) {
  return base * (1 + excitation(velocity) * (gain - 1));
}

/* ---------------------------------------------------------------------------
   Reduced motion
   ---------------------------------------------------------------------------
   Ringing is exactly the kind of motion that triggers vestibular symptoms, so
   under prefers-reduced-motion every ease collapses to a linear ramp and
   durations shorten. Callers check `reduced()` rather than branching on the
   media query directly.
   ------------------------------------------------------------------------- */

const reduceQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

export function reduced() {
  return !!(reduceQuery && reduceQuery.matches);
}

/** Ease for a role, honouring reduced motion. */
export function easeFor(role) {
  if (reduced()) return 'none';
  return EASE[role] || EASE.display;
}

/** Duration for a role, honouring reduced motion. */
export function durationFor(role) {
  if (reduced()) return 0.2;
  return role === 'reactive' ? 0.55 : role === 'data' ? 0.7 : 1.1;
}

/** Notify callers when the preference flips mid-session. */
export function onReducedChange(fn) {
  if (!reduceQuery) return;
  const handler = () => fn(reduceQuery.matches);
  if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', handler);
  else reduceQuery.addListener(handler);
}
