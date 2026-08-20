/* ============================================================================
   CURSOR — a probe, not a blob
   ----------------------------------------------------------------------------
   The near-universal custom cursor is a circle that scales up on hover. It is
   so common it has stopped reading as a choice.

   This is a crosshair reticle that behaves like the rest of the site: it lags
   the pointer as a damped follower rather than tracking it exactly, and it
   carries a live readout of whatever it is over. On the plate it reports the
   local displacement of the standing wave. Over a control it reports what the
   control does.

   Disabled entirely on coarse pointers and under reduced motion, where a
   lagging cursor is an obstacle rather than an effect.
   ========================================================================== */

import { reduced } from './secondorder.js';

export function mountCursor() {
  const fine = window.matchMedia('(pointer: fine)').matches;
  if (!fine || reduced()) return null;

  const el = document.createElement('div');
  el.className = 'reticle';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <svg class="reticle-mark" viewBox="0 0 40 40">
      <circle class="reticle-ring" cx="20" cy="20" r="13"/>
      <path class="reticle-cross" d="M20 4 V13 M20 27 V36 M4 20 H13 M27 20 H36"/>
      <circle class="reticle-dot" cx="20" cy="20" r="1.4"/>
    </svg>
    <span class="reticle-readout"></span>
  `;
  document.body.appendChild(el);
  document.documentElement.classList.add('has-reticle');

  const readout = el.querySelector('.reticle-readout');

  let tx = window.innerWidth / 2;
  let ty = window.innerHeight / 2;
  let x = tx, y = ty;
  let vx = 0, vy = 0;
  let raf = 0;

  /* Critically-damped follower. Same family as everything else here, but
     zeta = 1 so the cursor never overshoots the pointer — a reticle that
     wobbles past where you are pointing is unusable. */
  const K = 260;              // stiffness
  const C = 2 * Math.sqrt(K); // critical damping

  const onMove = (e) => {
    tx = e.clientX;
    ty = e.clientY;
  };

  const onOver = (e) => {
    const t = e.target.closest('[data-probe], a, button, input, [role="button"]');
    if (!t) {
      el.dataset.mode = 'idle';
      readout.textContent = '';
      return;
    }
    if (t.dataset && t.dataset.probe) {
      el.dataset.mode = 'probe';
      readout.textContent = t.dataset.probe;
    } else if (t.matches('a')) {
      el.dataset.mode = 'link';
      readout.textContent = t.dataset.readout || 'open';
    } else {
      el.dataset.mode = 'control';
      readout.textContent = t.dataset.readout || '';
    }
  };

  const onDown = () => el.classList.add('is-down');
  const onUp = () => el.classList.remove('is-down');
  const onLeave = () => el.classList.add('is-out');
  const onEnter = () => el.classList.remove('is-out');

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerover', onOver, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  document.addEventListener('pointerenter', onEnter);

  let last = 0;
  function frame(now) {
    const dt = last ? Math.min((now - last) / 1000, 0.032) : 0.016;
    last = now;

    // Spring-damper toward the pointer, integrated semi-implicitly.
    const ax = K * (tx - x) - C * vx;
    const ay = K * (ty - y) - C * vy;
    vx += ax * dt; vy += ay * dt;
    x += vx * dt;  y += vy * dt;

    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerenter', onEnter);
      el.remove();
      document.documentElement.classList.remove('has-reticle');
    },
  };
}
