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
  let raf = 0;

  /* The reticle tracks the pointer exactly. An earlier version ran it as a
     damped follower, which was the same mistake every lagging custom cursor
     makes: once the native cursor is hidden, any lag between the hand and the
     mark reads as the page being slow. The physics belongs in the page, not
     between the user and their own pointer. */
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

  /* One write per frame rather than one per pointermove event, so a high-rate
     mouse cannot outpace the compositor. */
  function frame() {
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
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
