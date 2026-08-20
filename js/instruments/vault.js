/* ============================================================================
   INSTRUMENT — Vela memory vault
   ----------------------------------------------------------------------------
   Vela's memory is not a table. Every fact is one markdown note in an Obsidian
   vault, named after the sentence rather than an id, because that name is what
   Obsidian links with. Notes reference each other, so what she believes is a
   graph you can walk.

   The instrument is that graph. Recall filters it the way she filters it, and
   hovering a note lights the facts it is connected to.
   ========================================================================== */

import { dampedEase, DAMPING, reduced } from '../secondorder.js';

const gsap = window.gsap;

/* A representative slice of the vault. x/y are percentages of the field. */
const NOTES = [
  { id: 'grad',   x: 26, y: 20, kind: 'user',
    name: 'yousef-graduated-basc-mechatronics',
    body: 'BASc Mechatronics & Robotics Engineering, Queen\'s, 2025.',
    links: ['ts', 'robotics'] },
  { id: 'ts',     x: 62, y: 16, kind: 'user',
    name: 'yousef-writes-typescript-by-default',
    body: 'Reaches for TypeScript first on anything with a server.',
    links: ['wcf'] },
  { id: 'robotics', x: 18, y: 52, kind: 'user',
    name: 'yousef-works-on-physical-systems',
    body: 'Robotics, embedded control, anything with a sensor on it.',
    links: ['resonance'] },
  { id: 'wcf',    x: 78, y: 44, kind: 'project',
    name: 'worldcupfantasy-ran-live-through-the-tournament',
    body: 'Solo build, ran in production for the whole of World Cup 2026.',
    links: [] },
  { id: 'resonance', x: 44, y: 66, kind: 'project',
    name: 'resonance-is-an-unreal-engine-game',
    body: 'UE 5.8. Combat is frequency matching against machine parts.',
    links: ['fab'] },
  { id: 'fab',    x: 72, y: 76, kind: 'pending',
    name: 'fabrication-is-aspirational-as-of-aug',
    body: 'Wants a workshop. Does not have one yet. Flagged as not-yet-true.',
    links: [] },
  { id: 'blunt',  x: 52, y: 36, kind: 'feedback',
    name: 'blunt-feedback-is-useful-data',
    body: '"Boring" is a measurement. Do not soften it into a compliment.',
    links: ['resonance'] },
];

export function mount(container, system) {
  container.innerHTML = `
    <div class="vault">
      <div class="vault-head">
        <label class="vault-recall">
          <span class="vault-recall-icon" aria-hidden="true">/</span>
          <input type="search" class="vault-input" placeholder="recall"
                 aria-label="Filter the vault by recalling a fact">
        </label>
        <span class="vault-count">${NOTES.length} notes</span>
      </div>

      <div class="vault-field">
        <svg class="vault-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
        <div class="vault-notes"></div>
      </div>

      <div class="vault-read" role="status" aria-live="polite">
        <span class="vault-read-name">—</span>
        <span class="vault-read-body">Hover a note to read what she believes.</span>
      </div>
    </div>
  `;

  const linksSvg = container.querySelector('.vault-links');
  const notesHost = container.querySelector('.vault-notes');
  const input = container.querySelector('.vault-input');
  const countEl = container.querySelector('.vault-count');
  const readName = container.querySelector('.vault-read-name');
  const readBody = container.querySelector('.vault-read-body');

  const byId = new Map(NOTES.map((n) => [n.id, n]));
  const nodes = [];

  /* ---- edges ---- */
  const edges = [];
  NOTES.forEach((n) => {
    n.links.forEach((to) => {
      const t = byId.get(to);
      if (!t) return;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', n.x); line.setAttribute('y1', n.y);
      line.setAttribute('x2', t.x); line.setAttribute('y2', t.y);
      line.setAttribute('class', 'vlink');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      linksSvg.appendChild(line);
      edges.push({ el: line, from: n.id, to });
    });
  });

  /* ---- notes ---- */
  NOTES.forEach((n) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `vnote vnote--${n.kind}`;
    el.style.left = `${n.x}%`;
    el.style.top = `${n.y}%`;
    el.dataset.id = n.id;
    el.innerHTML = `
      <span class="vnote-kind">${n.kind}</span>
      <span class="vnote-name">${n.name}.md</span>
    `;
    el.setAttribute('aria-label', `${n.name}. ${n.body}`);

    const focus = () => highlight(n);
    el.addEventListener('pointerenter', focus);
    el.addEventListener('focus', focus);
    el.addEventListener('pointerleave', clear);
    el.addEventListener('blur', clear);

    notesHost.appendChild(el);
    nodes.push({ note: n, el });
  });

  function highlight(n) {
    readName.textContent = `${n.name}.md`;
    readBody.textContent = n.body;

    const related = new Set([n.id, ...n.links]);
    edges.forEach((e) => {
      if (e.from === n.id || e.to === n.id) { related.add(e.from); related.add(e.to); }
    });

    nodes.forEach((x) => {
      x.el.classList.toggle('is-lit', related.has(x.note.id));
      x.el.classList.toggle('is-dim', !related.has(x.note.id));
    });
    edges.forEach((e) => {
      e.el.classList.toggle('is-lit', e.from === n.id || e.to === n.id);
    });
  }

  function clear() {
    nodes.forEach((x) => x.el.classList.remove('is-lit', 'is-dim'));
    edges.forEach((e) => e.el.classList.remove('is-lit'));
  }

  /* ---- recall ---- */
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    nodes.forEach((x) => {
      const hit = !q
        || x.note.name.includes(q)
        || x.note.body.toLowerCase().includes(q)
        || x.note.kind.includes(q);
      x.el.classList.toggle('is-hidden', !hit);
      if (hit) shown++;
    });
    edges.forEach((e) => {
      const a = nodes.find((x) => x.note.id === e.from);
      const b = nodes.find((x) => x.note.id === e.to);
      const vis = a && b && !a.el.classList.contains('is-hidden') && !b.el.classList.contains('is-hidden');
      e.el.classList.toggle('is-hidden', !vis);
    });
    countEl.textContent = q ? `${shown} of ${NOTES.length} notes` : `${NOTES.length} notes`;
  });

  if (gsap && !reduced()) {
    gsap.from(nodes.map((n) => n.el), {
      opacity: 0, scale: 0.7, duration: 0.9,
      stagger: { each: 0.05, from: 'center' },
      ease: dampedEase(DAMPING.card, 1.2),
    });
    gsap.from(edges.map((e) => e.el), {
      opacity: 0, duration: 0.8, delay: 0.3, stagger: 0.04,
    });
  }

  return {
    destroy() { container.innerHTML = ''; },
  };
}
