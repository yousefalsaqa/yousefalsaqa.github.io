/* ============================================================================
   SYSTEMS — the index data
   ----------------------------------------------------------------------------
   `instrument` names the module in js/instruments/ that renders this system's
   behaviour. Every system gets its own, because a CAN bus and an RFID body map
   are not the same object and should not be the same card.
   ========================================================================== */

export const SYSTEMS = [
  {
    id: 'cast',
    no: '01',
    name: 'CAST Medical Interface',
    domain: 'Medical simulation',
    href: 'capstone.html',
    period: 'Sep 2024 – May 2025',
    instrument: 'bodymap',
    lede:
      'Twelve RFID tags sit under the manikin skin at the auscultation points. ' +
      'The stethoscope reads whichever tag it is over, the scenario logic looks ' +
      'up what belongs at that spot, and the Pi plays it. Move the stethoscope ' +
      'and the sound changes with it.',
    detail:
      'Nursing students need to practise auscultation and a commercial simulator ' +
      'costs six figures. This one is a Raspberry Pi, a reader, twelve tags and ' +
      'about $250 of parts. It is running at the School of Nursing. I was ' +
      'assistant lead for software and integration.',
    specs: [
      ['Input', '12 RFID tags at anatomical positions'],
      ['Process', '28 audio cases, scenario logic, Flask on a Raspberry Pi'],
      ['Output', 'The sound that belongs at that position'],
      ['Constraint', '$250 of hardware'],
      ['Status', 'Deployed, Queen\'s School of Nursing'],
    ],
  },

  {
    id: 'autodrive',
    no: '02',
    name: "Queen's AutoDrive",
    domain: 'Autonomous vehicle',
    href: 'autodrive-project.html',
    period: 'Sep 2021 – May 2024',
    instrument: 'trace',
    lede:
      'Year one I trained the lane detection CNN and got it fast enough on a ' +
      'Jetson Xavier NX to actually use. Year two I moved to integration. ' +
      'Perception, planning and control are separate ROS2 nodes and they have ' +
      'to agree on time.',
    detail:
      'They are synchronized at 10 Hz over CAN. When they drift, nothing errors ' +
      'out. The planner keeps acting on perception that is a few frames old, and ' +
      'the only place you see it is in how the car behaves.',
    specs: [
      ['Input', 'Vehicle camera feed'],
      ['Process', 'CNN lane detection, TensorRT on Jetson Xavier NX, ROS2 fusion'],
      ['Output', 'CAN commands, nodes synchronized at 10 Hz'],
      ['Constraint', 'Real-time inference in an embedded power budget'],
      ['Status', 'Two competition years, 2021–22 and 2023–24'],
    ],
  },

  {
    id: 'vela',
    no: '03',
    name: 'Vela',
    domain: 'Agent architecture',
    href: 'vela.html',
    period: 'Aug 2026 – present',
    instrument: 'console',
    lede:
      'She runs on the Claude Agent SDK, listens for a wake word, talks back, ' +
      'and can drive the desktop. Open things, control media, tell me what is ' +
      'currently open, keep an eye on something and speak up when it changes. ' +
      'Everything she knows about me is markdown in an Obsidian vault.',
    detail:
      'One note per fact, named after the sentence instead of an id, because ' +
      'that name is what Obsidian links with. I can open the vault, read what ' +
      'she thinks, correct it, and she reads the edit back the next time she ' +
      'recalls. Projects and watches go in SQLite because that is operational ' +
      'state, not something I need to read.',
    specs: [
      ['Input', 'Voice on a wake word, or typed'],
      ['Process', 'Claude Agent SDK, 19 TypeScript modules, custom tool layer'],
      ['Output', 'Speech, desktop actions, notes written to the vault'],
      ['Constraint', 'Memory has to be readable and editable by hand'],
      ['Status', 'In daily use'],
    ],
  },

  {
    id: 'wcf',
    no: '04',
    name: 'World Cup Fantasy',
    domain: 'Full-stack platform',
    href: 'worldcupfantasy-details.html',
    period: 'Jan 2026 – Jul 2026',
    instrument: 'ledger',
    lede:
      'Six months solo, live for the whole tournament. Users pick a squad, the ' +
      'scoring engine reads the match feed and banks points while the match is ' +
      'still running.',
    detail:
      'The feed is wrong often enough that you have to design for it. Goals get ' +
      'reassigned, assists show up an hour late, cards get rescinded, and by ' +
      'then the points are already banked and on screen. Every correction is an ' +
      'entry in an audit log that can be reverted, so undoing a bad correction ' +
      'does not mean unwinding everything after it.',
    specs: [
      ['Input', 'Live match feed, API-Football'],
      ['Process', '~39,000 lines of TypeScript, 54 API routes, Prisma + PostgreSQL'],
      ['Output', 'Banked points, live leaderboard'],
      ['Constraint', 'Scoring resolves mid-match, with no second attempt'],
      ['Status', 'Ran in production. Forked to La Liga at ~80% reuse'],
    ],
  },

  {
    id: 'aca',
    no: '05',
    name: 'Admission Coordinator Assistant',
    domain: 'Workflow automation',
    href: 'admission-coordinator-assistant.html',
    period: 'Jan 2026 – present',
    instrument: 'sessions',
    lede:
      'The evaluator reads the documents and types the calculated average. The ' +
      'tool does the rest: writes the admit basis, sets the curriculum, enters ' +
      'the score, signs off the documents, updates the requirements, then moves ' +
      'to the next applicant.',
    detail:
      'PeopleSoft has no API so all of it is browser automation, and it is slow, ' +
      'so it runs five sessions at once. The scoring rules genuinely differ by ' +
      'curriculum. IB sums, CBSE averages, GCSE needs a 1–9 to 1–6 conversion ' +
      'table. Those live in a config table, so adding a curriculum is a config ' +
      'entry rather than new code.',
    specs: [
      ['Input', 'Applicant documents and one typed score'],
      ['Process', 'Five parallel sessions, config-driven curriculum rules'],
      ['Output', 'Evaluated, signed-off application'],
      ['Constraint', 'No API. Everything goes through the browser'],
      ['Status', '~1,200 applications on the original IB-only build'],
    ],
  },

  {
    id: 'resonance',
    no: '06',
    name: 'Resonance',
    domain: 'Game systems',
    href: 'resonance.html',
    period: 'Jul 2026 – present',
    instrument: 'sweep',
    lede:
      'You probe a part to hear what it is doing, tune your frequency to match ' +
      'what its dampener is applying to it, then either overload it or stabilize ' +
      'it. Overload is the simple route, you drive it past what it can take. ' +
      'Stabilize is where the skill is: you have to match the part\'s movement ' +
      'as it destabilizes and bring it back down.',
    detail:
      'Unreal Engine 5.8, C++ gameplay layer, Chaos for the structural failure. ' +
      'Every verb and machine state change writes one key=value line to the log, ' +
      'so when something feels wrong I read the numbers from that second instead ' +
      'of guessing at it.',
    specs: [
      ['Input', 'Probe, then sustained frequency matching'],
      ['Process', 'Per-part resonance profiles, C++ gameplay, Chaos destruction'],
      ['Output', 'A named part buckles, shears, or comes back under control'],
      ['Constraint', 'Feel gets diagnosed from telemetry'],
      ['Status', 'Phase 1, 47 commits, in playtest'],
    ],
  },
];
