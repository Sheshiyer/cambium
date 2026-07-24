// cambium-quests · miniapp page chunk — </head><body> static shell markup (nav, scene containers, sheet)
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const SCAFFOLD = `</head>
<body>
<div class="substrate"><div class="blob a"></div><div class="blob b"></div><div class="grain"></div></div>
<div class="app" data-component="MissionControlShell">
  <span class="sr" data-component="ComponentRegistry" data-source="docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/component-map.md">Mission Control component registry</span>
  <header class="root-status" data-component="RootStatusStack">
    <div class="root-brand">
      <span class="root-brand-glyph" data-component="RootBrandGlyph" data-glyph-kind="genesis" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 3.8 19.5 11.2 27.4 8.8 23.8 16 27.4 23.2 19.5 20.8 16 28.2 12.5 20.8 4.6 23.2 8.2 16 4.6 8.8 12.5 11.2Z"/><path d="M16 6.8 18.1 12.6 24.2 12.1 19.4 16 24.2 19.9 18.1 19.4 16 25.2 13.9 19.4 7.8 19.9 12.6 16 7.8 12.1 13.9 12.6Z"/><circle class="mc-core" cx="16" cy="16" r="2.1"/><path class="mc-soft" d="M7 27c4.2-.6 6.8-.6 9.2.1 2.8.8 5.2.7 8.8-.4"/></svg></span>
      <div class="brand">Mission Control<small>tenant <span id="ten">cambium</span> · branch arcs</small></div>
    </div>
    <div class="root-chip-stack">
      <button id="sceneBadge" type="button" class="chip scene-chip" data-interaction-kind="sheet" data-source="tg-miniapp-scenes@v1">Mission</button>
      <button id="fresh" type="button" class="chip" data-interaction-kind="sheet" data-source="missing">syncing</button>
    </div>
  </header>
  <div class="ptr" id="ptr" data-refresh-route="/api/quests/cambium" data-refresh-writes="signed-actions-only"><div class="drop"></div><span id="ptrProof" class="ptr-proof">Pull to refresh updates /api/quests/cambium; decisions stay behind signed actions.</span></div>
  <nav class="root-nav" data-component="RootNav" aria-label="Mission Control scenes">
    <button id="tb0" class="root-tab on" data-component="RootSceneTab" data-root-scene="mission" data-nav-glyph="genesis" data-scene-source="tg-miniapp-scenes@v1" aria-selected="true"><span class="root-tab-glyph" data-component="RootNavGlyph" data-glyph-kind="genesis" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 3.8 19.5 11.2 27.4 8.8 23.8 16 27.4 23.2 19.5 20.8 16 28.2 12.5 20.8 4.6 23.2 8.2 16 4.6 8.8 12.5 11.2Z"/><path d="M16 6.8 18.1 12.6 24.2 12.1 19.4 16 24.2 19.9 18.1 19.4 16 25.2 13.9 19.4 7.8 19.9 12.6 16 7.8 12.1 13.9 12.6Z"/><circle class="mc-core" cx="16" cy="16" r="2.1"/></svg></span><span class="root-tab-label">Mission</span><small>next move</small></button>
    <button id="tb1" class="root-tab" data-component="RootSceneTab" data-root-scene="gate" data-nav-glyph="gate" data-scene-source="tg-miniapp-scenes@v1" aria-selected="false"><span class="root-tab-glyph" data-component="RootNavGlyph" data-glyph-kind="gate" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 4.8 27 24.8H5Z"/><path d="M16 6.8 24.7 23H7.3Z"/><path d="M16 12.8 20.8 20.8H11.2Z"/><path class="mc-core" d="M15.9 17.2 17.9 20.2H13.9Z"/></svg></span><span class="root-tab-label">Gate</span><small>review</small></button>
    <button id="tb2" class="root-tab" data-component="RootSceneTab" data-root-scene="tools" data-nav-glyph="ops" data-scene-source="tg-miniapp-scenes@v1" aria-selected="false"><span class="root-tab-glyph" data-component="RootNavGlyph" data-glyph-kind="ops" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="mc-fill" d="M7.2 13.4 21.8 6.7 27.6 13.3 20.1 24.7 5.4 20.3Z"/><path d="M8.2 14.2 21.5 8.2 26 13.6 19.3 23 6.8 19.4Z"/><path d="m10.1 15.3 9.5 3.7 4.6-4.9M19.6 19l1.9-10.8"/></svg></span><span class="root-tab-label">Tools</span><small>act</small></button>
    <button id="tb3" class="root-tab" data-component="RootSceneTab" data-root-scene="story" data-nav-glyph="proof" data-scene-source="tg-miniapp-scenes@v1" aria-selected="false"><span class="root-tab-glyph" data-component="RootNavGlyph" data-glyph-kind="proof" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="mc-fill" d="M10.2 5.4c3.6 1.7 6.7 1.8 9.8.4 1.7-.7 3.3.5 3.2 2.3l-1 14.7c-.1 1.9-1.9 3-3.6 2.1-3.1-1.6-6.2-1.8-9.5-.5Z"/><path d="M10.2 5.4c3.6 1.7 6.7 1.8 9.8.4 1.7-.7 3.3.5 3.2 2.3l-1 14.7c-.1 1.9-1.9 3-3.6 2.1-3.1-1.6-6.2-1.8-9.5-.5Z"/><path class="mc-dash" d="M12.4 11.4c2.3.8 4.6.8 7.1.1M12.1 15.4c2.8.9 5.5.9 8.2 0"/></svg></span><span class="root-tab-label">Story</span><small>signals</small></button>
    <button id="tb4" class="root-tab" data-component="RootSceneTab" data-root-scene="inspect" data-nav-glyph="cortex" data-scene-source="tg-miniapp-scenes@v1" aria-selected="false"><span class="root-tab-glyph" data-component="RootNavGlyph" data-glyph-kind="cortex" aria-hidden="true"><svg viewBox="0 0 32 32"><circle class="mc-fill" cx="16" cy="16" r="10.8"/><circle cx="16" cy="16" r="10.3"/><circle cx="16" cy="16" r="4.1"/><circle class="mc-core" cx="16" cy="16" r="1.6"/><path d="M16 5.7v6.1M16 20.2v6.1M5.7 16h6.1M20.2 16h6.1"/></svg></span><span class="root-tab-label">Inspect</span><small>proof</small></button>
    <div class="ind root-nav-indicator" id="ind"></div>
  </nav>
  <div class="track" id="track">
    <section class="scene" id="sceneQ" aria-labelledby="sceneQTitle">
      <h2 id="sceneQTitle" class="sr">Mission</h2>
      <div class="stem" id="stem">
        <div class="skel"></div><div class="skel"></div><div class="skel"></div>
        <div class="skel"></div><div class="skel"></div>
      </div>
      <div class="bar"><div id="fill" class="fill"></div></div>
      <div class="meta"><span id="progress"></span><span id="here"></span></div>
    </section>
    <section class="scene" id="sceneG" aria-labelledby="sceneGTitle">
      <h2 id="sceneGTitle" class="sr">Gate</h2>
      <div class="gate-shell" data-component="GateChamber">
        <section class="gate-hero" data-component="GateMissionCard">
          <div class="gate-title-row">
            <span class="mc-glyph is-proof-needed" data-component="MissionGlyph" data-glyph-kind="gate" data-state="proof-needed" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 4.8 27 24.8H5Z"/><path d="M16 6.8 24.7 23H7.3Z"/><path d="M16 12.8 20.8 20.8H11.2Z"/><path class="mc-core" d="M15.9 17.2 17.9 20.2H13.9Z"/><path class="mc-soft" d="M8.2 27.2c2.2-2.8 4.6-3.2 7.8-1.2 3.2-2 5.6-1.6 7.8 1.2"/></svg></span>
            <div>
              <h3>Gate</h3>
              <p>founder decisions · proof first</p>
              <div id="gateHeroDecision" class="gate-hero-decision" data-component="GateDecisionHeroCard"><b>Gate quiet</b><span>loading the queue…</span></div>
            </div>
          </div>
        </section>
        <div class="gate-progress-summary" data-component="GateProgressSummary">
          <div class="gauge" id="gauge" data-component="OrbitProgress"></div>
          <div class="gate-progress-copy"><b>Receipt sync</b><span>receipts land after operator consumption</span></div>
        </div>
        <div class="gate-state-strip" data-component="GateStateStack">
          <span><b>Decision</b><small>founder sign</small></span>
          <span><b>Effect</b><small>awaits operator</small></span>
          <span><b>Proof</b><small>evidence first</small></span>
        </div>
        <div id="gate" class="gate-queue">loading the queue…</div>
      </div>
    </section>
    <section class="scene" id="sceneC" aria-labelledby="sceneCTitle">
      <h2 id="sceneCTitle" class="sr">Tools</h2>
      <div class="ghead">Tools · the operator toolbelt</div>
      <div class="gsub">the /ts-* command surface, run through the curios.self bot in Telegram.</div>
      <div id="cmds"></div>
    </section>
    <section class="scene" id="sceneS" aria-labelledby="sceneSTitle"><h2 id="sceneSTitle" class="sr">Story</h2><div id="beats"></div></section>
    <section class="scene" id="sceneF" aria-labelledby="sceneFTitle"><h2 id="sceneFTitle" class="sr">Inspect</h2><div class="mapwrap" id="mapwrap"></div></section>
  </div>
</div>
<div class="veil" id="veil"></div>
<div class="sheet" id="sheet"><div class="grab"></div><div id="sheetBody"></div></div>
`;
