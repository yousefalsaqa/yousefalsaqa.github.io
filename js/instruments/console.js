/* ============================================================================
   INSTRUMENT — Vela
   ----------------------------------------------------------------------------
   The tools are the real ones off src/tools.ts: remember / recall / forget,
   list_projects / add_project, launch_app, media_control, list_windows, and
   watch / list_watches / resolve_watch, on top of what the Agent SDK already
   gives her (files, shell, codebase search, web).

   Two things worth seeing: which tool a sentence actually fires, and what
   happens to the vault when she is told something. Remembering writes a
   markdown note, and that note shows up here the same way it shows up in
   Obsidian.
   ========================================================================== */

import { dampedEase, DAMPING, reduced } from '../secondorder.js';

const gsap = window.gsap;

/* Each exchange names the tools it fires and, where relevant, the note it
   writes. Kept short: this is a demonstration of the tool layer, not a
   transcript of a whole evening. */
const EXCHANGES = [
  {
    say: 'what am I working on',
    tools: ['list_projects'],
    reply: 'Three. Resonance, this portfolio, and the WSIB lookup. Resonance was the last one you touched.',
  },
  {
    say: 'open the resonance log',
    tools: ['list_projects', 'launch_app'],
    reply: 'Opening Resonance.log. Last write was 14 minutes ago.',
  },
  {
    say: 'remember that I graduated in 2025',
    tools: ['remember'],
    reply: 'Written.',
    note: {
      name: 'yousef-graduated-basc-mechatronics-2025',
      kind: 'user',
      body: 'BASc Mechatronics & Robotics Engineering, Queen\'s, 2025.',
    },
  },
  {
    say: 'what do you know about the game',
    tools: ['recall'],
    reply: 'Unreal 5.8, combat is frequency matching against machine parts. You told me the dampener sets the target frequency.',
  },
  {
    say: 'watch the build and tell me when it finishes',
    tools: ['watch'],
    reply: 'Watching. I will say something when it changes.',
  },
  {
    say: 'skip this track',
    tools: ['media_control'],
    reply: 'Skipped.',
  },
  {
    say: 'what have I got open',
    tools: ['list_windows'],
    reply: 'Unreal Editor, two Chrome windows, Blender, and a terminal in the portfolio repo.',
  },
];

/* The vault as it starts. Notes are named after the sentence, not an id. */
const VAULT = [
  { name: 'yousef-writes-typescript-by-default', kind: 'user',
    body: 'Reaches for TypeScript first on anything with a server.' },
  { name: 'resonance-is-an-unreal-engine-game', kind: 'project',
    body: 'UE 5.8. Combat is frequency matching against machine parts.' },
  { name: 'blunt-feedback-is-useful-data', kind: 'feedback',
    body: '"Boring" is a measurement. Do not soften it.' },
  { name: 'fabrication-is-aspirational-as-of-aug', kind: 'pending',
    body: 'Wants a workshop. Does not have one. Flagged as not yet true.' },
];

export function mount(container, system) {
  container.innerHTML = `
    <div class="vla">
      <div class="vla-main">
        <div class="vla-bar">
          <span class="vla-wake"><i></i><i></i><i></i><i></i><i></i></span>
          <span class="vla-status">listening for "vela"</span>
        </div>

        <div class="vla-log" role="log" aria-live="polite"></div>

        <div class="vla-prompts" role="group" aria-label="Things to say to Vela"></div>
      </div>

      <aside class="vla-vault">
        <div class="vla-vault-head">
          <span>vault/Memory</span>
          <span class="vla-vault-count">${VAULT.length}</span>
        </div>
        <ul class="vla-notes"></ul>
        <p class="vla-vault-foot">One note per fact. Editable in Obsidian.</p>
      </aside>
    </div>
  `;

  const log = container.querySelector('.vla-log');
  const promptHost = container.querySelector('.vla-prompts');
  const notesHost = container.querySelector('.vla-notes');
  const countEl = container.querySelector('.vla-vault-count');
  const statusEl = container.querySelector('.vla-status');

  let alive = true;
  let busy = false;
  let queued = 0;
  const timers = [];
  const after = (ms, fn) => { const t = setTimeout(() => { if (alive) fn(); }, ms); timers.push(t); return t; };

  /* ---- vault ---- */
  function addNote(n, fresh) {
    const li = document.createElement('li');
    li.className = `vnote vnote--${n.kind}${fresh ? ' is-fresh' : ''}`;
    li.innerHTML = `
      <span class="vnote-name">${n.name}.md</span>
      <span class="vnote-body">${n.body}</span>
    `;
    notesHost.prepend(li);
    countEl.textContent = String(notesHost.children.length);
    if (fresh && gsap && !reduced()) {
      gsap.from(li, { opacity: 0, x: 18, duration: 0.8, ease: dampedEase(DAMPING.card, 1.3) });
    }
    return li;
  }
  VAULT.forEach((n) => addNote(n, false));

  /* ---- transcript ---- */
  function line(cls, html) {
    const el = document.createElement('div');
    el.className = `vln ${cls}`;
    el.innerHTML = html;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    if (gsap && !reduced()) {
      gsap.from(el, { opacity: 0, y: 10, duration: 0.55, ease: dampedEase(DAMPING.data, 1.1) });
    }
    return el;
  }

  function run(ex) {
    if (busy) return;
    busy = true;
    statusEl.textContent = 'listening';

    line('vln--you', `<span class="vln-who">you</span><span class="vln-text">${ex.say}</span>`);

    after(reduced() ? 0 : 380, () => {
      // Tool chips appear before the reply, because that is the order it
      // happens in — she calls the tool, then answers from what it returned.
      const chips = ex.tools
        .map((t) => `<code class="vln-tool">${t}</code>`).join('');
      line('vln--tools', `<span class="vln-who"></span><span class="vln-text">${chips}</span>`);
      statusEl.textContent = `running ${ex.tools[ex.tools.length - 1]}`;

      after(reduced() ? 0 : 520, () => {
        line('vln--her', `<span class="vln-who">vela</span><span class="vln-text">${ex.reply}</span>`);
        if (ex.note) after(reduced() ? 0 : 260, () => addNote(ex.note, true));
        statusEl.textContent = 'listening for "vela"';
        busy = false;
      });
    });
  }

  /* ---- prompt buttons ---- */
  EXCHANGES.forEach((ex) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vla-prompt';
    b.textContent = ex.say;
    b.addEventListener('click', () => run(ex));
    promptHost.appendChild(b);
  });

  // Open with one exchange already run, so the panel is not empty on arrival.
  after(reduced() ? 0 : 500, () => run(EXCHANGES[0]));

  if (gsap && !reduced()) {
    gsap.from(promptHost.children, {
      opacity: 0, y: 10, duration: 0.6, stagger: 0.04,
      ease: dampedEase(DAMPING.data, 1.0),
    });
  }

  return {
    destroy() {
      alive = false;
      timers.forEach(clearTimeout);
      container.innerHTML = '';
    },
  };
}
