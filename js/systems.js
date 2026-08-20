/* ============================================================================
   SYSTEMS — the index data
   ----------------------------------------------------------------------------
   Six systems, each assigned a Chladni mode pair. Tuning the plate to a mode
   is how you navigate to that system, so the mode is identity, not decoration:
   higher mode pairs are more complex figures and sit higher on the frequency
   rail.

   `instrument` names the module in js/instruments/ that renders this system's
   behaviour. Every system gets its own, because a CAN bus trace and an RFID
   body map are not the same object and should not be the same card.
   ========================================================================== */

export const SYSTEMS = [
  {
    id: 'cast',
    no: '01',
    name: 'CAST Medical Interface',
    domain: 'Medical simulation',
    href: 'capstone.html',
    mode: [1, 2],
    freq: 412,
    role: 'Assistant lead, software and integration',
    period: 'Sep 2024 – May 2025',
    instrument: 'bodymap',
    lede:
      'A digital stethoscope that knows where it is. Twelve RFID tags sit at ' +
      'anatomical positions under the manikin skin. The reader identifies the ' +
      'tag, the scenario logic picks the matching case, and the correct heart ' +
      'or lung sound plays for that spot.',
    detail:
      'Nursing students need to practise auscultation without a standardised ' +
      'patient. Commercial simulators run into six figures. This one runs on a ' +
      'Raspberry Pi and about $250 of parts, and it is in use at the School of ' +
      'Nursing.',
    specs: [
      ['Input', '12 RFID tags at anatomical positions'],
      ['Process', 'Scenario logic across 28 audio cases, Flask on a Raspberry Pi'],
      ['Output', 'Localized heart and lung audio'],
      ['Constraint', '$250 total hardware budget'],
      ['Status', 'Deployed, Queen\'s School of Nursing'],
    ],
  },

  {
    id: 'resonance',
    no: '02',
    name: 'Resonance',
    domain: 'Game systems',
    href: 'resonance.html',
    mode: [2, 3],
    freq: 968,
    role: 'Solo, design and C++ gameplay',
    period: 'Jul 2026 – present',
    instrument: 'sweep',
    lede:
      'You cannot out-damage these machines. Every part has a natural frequency, ' +
      'and combat is finding it: sustain the right frequency and drive the part ' +
      'past what it can survive, or ride its motion until it settles.',
    detail:
      'Unreal Engine 5.8, C++ gameplay layer, Chaos for the structural failure. ' +
      'Every verb and machine state change writes one key=value line to the log, ' +
      'so when a mechanic feels wrong the fix starts from the numbers in that ' +
      'second rather than from a theory about it.',
    specs: [
      ['Input', 'Sustained frequency matching, not input timing'],
      ['Process', 'Per-part resonance profiles, C++ gameplay, Chaos destruction'],
      ['Output', 'A named part cracks, buckles or shears off'],
      ['Constraint', 'Feel is diagnosed from telemetry, never from memory'],
      ['Status', 'Phase 1, 47 commits, in playtest'],
    ],
  },

  {
    id: 'autodrive',
    no: '03',
    name: "Queen's AutoDrive",
    domain: 'Autonomous vehicle',
    href: 'autodrive-project.html',
    mode: [1, 4],
    freq: 1420,
    role: 'Perception, then systems integration',
    period: 'Sep 2021 – May 2024',
    instrument: 'trace',
    lede:
      'Two years on a Level 4 vehicle for the SAE AutoDrive Challenge. Year one ' +
      'was lane perception: getting a CNN fast enough to be useful on a Jetson ' +
      'Xavier NX. Year two was integration, which is the harder problem.',
    detail:
      'Perception, planning and control run as separate ROS2 nodes and have to ' +
      'agree on time. They are synchronized at 10 Hz over CAN. When they drift, ' +
      'nothing throws an error — the car just starts making decisions on stale ' +
      'data.',
    specs: [
      ['Input', 'Vehicle camera feed'],
      ['Process', 'CNN lane detection, TensorRT on Jetson Xavier NX; ROS2 fusion'],
      ['Output', 'CAN commands, nodes synchronized at 10 Hz'],
      ['Constraint', 'Real-time inference inside an embedded power budget'],
      ['Status', 'Two competition years, 2021–22 and 2023–24'],
    ],
  },

  {
    id: 'vela',
    no: '04',
    name: 'Vela',
    domain: 'Agent architecture',
    href: 'vela.html',
    mode: [3, 4],
    freq: 2090,
    role: 'Solo, TypeScript',
    period: 'Aug 2026 – present',
    instrument: 'vault',
    lede:
      'An assistant with hands. It runs on the Claude Agent SDK, drives a Windows ' +
      'desktop, and keeps what it believes about me as markdown notes in an ' +
      'Obsidian vault I can open, read and correct.',
    detail:
      'One note per fact, named after the sentence rather than an id, because ' +
      'that name is what Obsidian links with. Notes link to each other, so the ' +
      'memory is a graph I can navigate. Unrecognised frontmatter keys are ' +
      'written back untouched so a plugin\'s metadata survives the next write.',
    specs: [
      ['Input', 'Voice and text, with ambient listening'],
      ['Process', 'Claude Agent SDK, 19 TypeScript modules, custom tool layer'],
      ['Output', 'Desktop actions, spoken replies, durable memory'],
      ['Constraint', 'Memory stays human-readable and hand-editable'],
      ['Status', 'In daily use'],
    ],
  },

  {
    id: 'wcf',
    no: '05',
    name: 'World Cup Fantasy',
    domain: 'Full-stack platform',
    href: 'worldcupfantasy-details.html',
    mode: [2, 5],
    freq: 2860,
    role: 'Solo, full stack',
    period: 'Jan 2026 – Jul 2026',
    instrument: 'ledger',
    lede:
      'Built solo in six months and run live for real users through the whole of ' +
      'World Cup 2026, group stage to Final. The scoring engine had to be right ' +
      'the first time, during matches, against a feed that was regularly wrong.',
    detail:
      'Goals get retroactively reassigned. Assists appear an hour late. Cards get ' +
      'rescinded. Every admin action — point overrides, retroactive corrections — ' +
      'writes to an immutable, revertible audit log, so a bad correction can be ' +
      'undone without unwinding the tournament.',
    specs: [
      ['Input', 'Live match feed, API-Football'],
      ['Process', '~39,000 lines of TypeScript, 54 API routes, Prisma + PostgreSQL'],
      ['Output', 'Banked points, live leaderboard'],
      ['Constraint', 'Scoring resolved live, mid-match, with no second attempt'],
      ['Status', 'Ran in production; forked to La Liga at ~80% reuse'],
    ],
  },

  {
    id: 'aca',
    no: '06',
    name: 'Admission Coordinator Assistant',
    domain: 'Workflow automation',
    href: 'admission-coordinator-assistant.html',
    mode: [4, 5],
    freq: 3740,
    role: 'Built and maintained in role',
    period: 'Jan 2026 – present',
    instrument: 'sessions',
    lede:
      'Five simultaneous PeopleSoft browser sessions behind one Start / Next / ' +
      'Skip workflow. The evaluator reads the documents and types one number. ' +
      'The tool does the data entry, the sign-off, the curriculum change and the ' +
      'document requirements, then advances.',
    detail:
      'PeopleSoft has no API, so every action is browser automation. The scoring ' +
      'rules genuinely differ by curriculum — IB sums, CBSE averages, GCSE needs ' +
      'a 1–9 to 1–6 conversion table — so they live in a config table. Adding a ' +
      'curriculum is a config entry.',
    specs: [
      ['Input', 'Applicant documents plus one typed score'],
      ['Process', 'Fan-out worker threads, config-driven curriculum rules'],
      ['Output', 'Evaluated, signed-off application'],
      ['Constraint', 'No API — everything runs through the browser'],
      ['Status', '~1,200 applications on the original IB-only build'],
    ],
  },
];

/** Format a frequency for the rail. */
export function formatFreq(hz) {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${hz} Hz`;
}
