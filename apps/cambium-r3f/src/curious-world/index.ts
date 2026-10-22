import { createWorld, type WorldAPI, type WorldState } from './world.ts';
import { DISTRICTS, WORLD_LANDMARKS, PATHS, keyboardAxis } from './world-model.ts';
import { createNavigationChart, createInstrumentObserver } from './navigation-instrument.ts';
import { TRAVELER_DESIGNS, type TravelerDesignId } from './character.ts';
import { travelerPortrait } from './traveler-portrait.ts';
import {
  HELD_GATE, gateActionState, gateAdmissionSummary, gateCountLabel, gateInspectRows, normalizeGateSnapshot,
  type GateBridge, type GateKind, type GateSnapshot,
} from './gate-folio.ts';

type Landmark = typeof WORLD_LANDMARKS[number];
type District = typeof DISTRICTS[number];
export interface CuriousWorldBridge extends GateBridge {
  openWorkbench: (target: 'mission' | 'gate' | 'inspect') => void;
  onExit: (error?: string) => void;
  getReadState: () => { state: string; label: string };
  subscribeRead: (listener: (snapshot: { state: string; label: string }) => void) => () => void;
}

const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const localPassports = new WeakMap<HTMLElement, Set<string>>();
const localTravelers = new WeakMap<HTMLElement, TravelerDesignId>();
export function normalizeJoystick(x: number, z: number, radius: number): { x: number; z: number } {
  if (![x, z, radius].every(Number.isFinite) || radius <= 0) return { x: 0, z: 0 };
  const scale = Math.max(radius, Math.hypot(x, z));
  return { x: x / scale, z: z / scale };
}
export function captureWorldKey(code: string, focused: boolean, editable: boolean): boolean {
  return focused && !editable && (movementCodes.has(code) || code === 'KeyE' || code === 'Escape');
}

export function mountCuriousWorld(root: HTMLElement, bridge: CuriousWorldBridge): { dispose: () => void; focus: () => void } {
  if (!root || !bridge || typeof bridge.subscribeRead !== 'function') throw new Error('Curious world bridge unavailable');
  let disposed = false;
  let begun = false;
  let modal = false;
  let travelerId: TravelerDesignId = localTravelers.get(root) ?? 'courier';
  let nearby: Landmark | null = null;
  let world: WorldAPI | null = null;
  let unsubscribe: (() => void) | null = null;
  let gateUnsubscribe: (() => void) | null = null;
  let gate: GateSnapshot = HELD_GATE;
  // The Gate lives in the Gate landmark folio. Only one Gate view is mounted
  // at a time; showPanel() clears it so stale callbacks never paint elsewhere.
  let gateHost: HTMLElement | null = null;
  let gateDigest: string | null = null;
  let gateConfirm: GateKind | null = null;
  let gateMessage: { text: string; tone: 'pending' | 'ok' | 'refused' } | null = null;
  let returnFocus: HTMLElement | null = null;
  let stickPointer: number | null = null;
  let touchAxis = { x: 0, z: 0 };
  const pressed = new Set<string>();
  const discoveries = localPassports.get(root) ?? new Set<string>();
  localPassports.set(root, discoveries);
  const listeners: (() => void)[] = [];
  root.classList.add('cw');
  root.tabIndex = -1;
  root.dataset.evidence = 'source';
  root.dataset.walking = 'false';
  delete root.dataset.curiousWorldFailure;

  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function listen(target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions | boolean): void {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  }
  function button(label: string, className: string, action?: () => void): HTMLButtonElement {
    const node = element('button', className, label);
    node.type = 'button';
    if (action) listen(node, 'click', () => action());
    return node;
  }
  function toolIcon(kind: 'map' | 'exit' | 'traveler'): SVGSVGElement {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('viewBox', '0 0 24 24'); node.setAttribute('aria-hidden', 'true'); node.setAttribute('focusable', 'false');
    const path = document.createElementNS(node.namespaceURI, 'path');
    path.setAttribute('d', kind === 'traveler' ? 'M7 9a5 5 0 1 0 10 0 5 5 0 0 0-10 0M3 22c0-5 3-8 9-8s9 3 9 8M8 7h8M6 9h12' : kind === 'map' ? 'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5zm6-2v16m6-14v16' : 'M4 4h11v16H4V4m6 8h11m-4-4 4 4-4 4');
    node.append(path); return node;
  }

  const viewport = element('div', 'cw-viewport');
  viewport.setAttribute('aria-label', 'Walkable source world');
  const hud = element('div', 'cw-hud');
  const header = element('header', 'cw-top');
  const brand = element('div', 'cw-brand');
  const brandLine = element('div', 'cw-brand-line');
  brandLine.append(element('span', 'cw-wordmark', 'curious'), element('span', 'cw-edition', 'FIELD ATLAS / 01'));
  const read = element('span', 'cw-read', 'Source world');
  read.setAttribute('role', 'status');
  brand.append(brandLine, read);
  const topActions = element('div', 'cw-top-actions');
  const mapButton = button('', 'cw-button cw-map-button', () => openMap());
  mapButton.append(toolIcon('map'), element('span', '', 'Chart'));
  mapButton.setAttribute('aria-label', 'Open district chart and local passport');
  const exitButton = button('', 'cw-button cw-exit', () => exit());
  exitButton.append(toolIcon('exit'), element('span', '', '2D desk'));
  exitButton.setAttribute('aria-label', 'Return to the 2D desk');
  const travelerButton = button('', 'cw-button cw-traveler-button', () => openTravelers());
  const travelerLabel = element('span', '', 'Courier');
  travelerButton.append(toolIcon('traveler'), travelerLabel);
  travelerButton.setAttribute('aria-label', 'Choose your traveler');
  topActions.append(travelerButton, mapButton, exitButton);
  header.append(brand, topActions);
  const location = element('div', 'cw-location');
  const districtNumber = element('span', 'cw-location-index', '00 / THE THRESHOLD');
  const districtName = element('strong', 'cw-district', 'The Commons');
  const districtTagline = element('span', 'cw-tagline', 'A threshold into the whole system');
  const stampCount = element('button', 'cw-stamp-count', `${discoveries.size} / 8 · local visits`);
  stampCount.type = 'button';
  stampCount.setAttribute('aria-label', 'Open local exploration passport');
  listen(stampCount, 'click', () => openMap());
  location.append(districtNumber, districtName, districtTagline);

  const instrument = element('div', 'cw-instrument');
  const instrumentButton = button('', 'cw-instrument-open', () => openMap());
  instrumentButton.setAttribute('aria-label', 'Open the district chart. Visits are local exploration only.');
  const navigation = createNavigationChart(DISTRICTS, PATHS);
  instrumentButton.append(navigation.svg);
  const instrumentHeading = element('span', 'cw-instrument-heading', 'FIELD CHART');
  instrument.append(instrumentHeading, instrumentButton, stampCount, element('span', 'cw-instrument-note', 'Local exploration'));
  const instrumentObserver = createInstrumentObserver((snapshot: WorldState) => navigation.render(snapshot, discoveries));
  function updateInstrument(force = true): void {
    if (!world || disposed) return;
    instrumentObserver.update(world.getState(), performance.now(), force);
  }
  function syncInstrument(): void { updateInstrument(); }
  function renderTravelerLabel(): void {
    const design = TRAVELER_DESIGNS.find(item => item.id === travelerId)!;
    travelerLabel.textContent = design.name;
    travelerButton.setAttribute('aria-label', `Choose your traveler. Current traveler: ${design.name}.`);
  }
  renderTravelerLabel();

  const near = element('div', 'cw-nearby');
  const nearCopy = element('div', 'cw-near-copy');
  const nearName = element('strong', 'cw-near-name', 'Follow your curiosity');
  const nearVerb = element('span', 'cw-near-verb', 'Walk closer to inspect a source landmark');
  nearCopy.append(nearName, nearVerb);
  const inspect = button('', 'cw-inspect', () => inspectNearby());
  inspect.append(element('kbd', 'cw-inspect-key', 'E'), element('span', '', 'Inspect'), element('span', 'cw-inspect-arrow', '↗'));
  inspect.disabled = true;
  near.append(nearCopy, inspect);
  const hint = element('div', 'cw-desktop-hint');
  for (const [key, label] of [['WASD', 'walk'], ['SHIFT', 'run'], ['DRAG', 'look']]) {
    const cue = element('span', 'cw-key-cue'); cue.append(element('kbd', '', key), element('span', '', label)); hint.append(cue);
  }

  const joystick = element('div', 'cw-joystick');
  joystick.setAttribute('role', 'group');
  joystick.setAttribute('aria-label', 'Touch walking control. Drag to walk; release to stop.');
  const stickRing = element('span', 'cw-stick-ring');
  const stickKnob = element('span', 'cw-stick-knob');
  stickRing.setAttribute('aria-hidden', 'true');
  stickKnob.setAttribute('aria-hidden', 'true');
  joystick.append(stickRing, stickKnob, element('span', 'cw-stick-label', 'WALK'));

  const intro = element('section', 'cw-intro');
  intro.setAttribute('aria-label', 'Start the pocket world');
  const introPanel = element('div', 'cw-intro-panel');
  introPanel.append(element('span', 'cw-kicker', 'AN EXPEDITION INTO THE SYSTEM'), element('h1', 'cw-title', 'Follow your\ncuriosity.'), element('p', 'cw-intro-copy', 'Follow the paths. Meet the organs. See how the whole system connects.'));
  const controls = element('div', 'cw-control-chips');
  const controlKeys: HTMLElement[] = [];
  for (const [key, label] of [['WASD', 'Walk the paths'], ['DRAG', 'Look around'], ['E', 'Open a folio']]) {
    const cue = element('span', 'cw-control-chip'), cueKey = element('kbd', '', key);
    controlKeys.push(cueKey); cue.append(cueKey, element('span', '', label)); controls.append(cue);
  }
  const touchControls = window.matchMedia('(max-width: 600px), (pointer: coarse)');
  function renderPassportCount(): void {
    stampCount.textContent = touchControls.matches ? `${discoveries.size} / 8 visits` : `${discoveries.size} / 8 · local visits`;
    stampCount.setAttribute('aria-label', `${discoveries.size} of 8 districts visited in this page. Local exploration only; open the passport.`);
  }
  function updateControlCues(): void {
    const keys = touchControls.matches ? ['STICK', 'DRAG', 'TAP'] : ['WASD', 'DRAG', 'E'];
    controlKeys.forEach((key, index) => { key.textContent = keys[index]; });
    renderPassportCount();
  }
  listen(touchControls, 'change', updateControlCues);
  updateControlCues();
  const begin = button('Enter the world', 'cw-begin', () => {
    begun = true; root.dataset.walking = 'true'; intro.hidden = true; clearInput(); world?.setBlocked(false); world?.start(); syncInstrument(); focus();
  });
  begin.append(element('span', '', '↗'));
  const introLedger = element('div', 'cw-intro-ledger');
  for (const [number, label] of [['08', 'districts'], ['11', 'organs'], ['30', 'source landmarks']]) {
    const item = element('span', ''); item.append(element('strong', '', number), element('span', '', label)); introLedger.append(item);
  }
  introPanel.append(controls, begin, introLedger, element('p', 'cw-local-note', 'A source exploration. Visits stay in this page; they do not advance real work.'));
  intro.append(introPanel);

  const dialog = element('dialog', 'cw-dialog');
  dialog.setAttribute('aria-label', 'Source world inspector');
  const dialogTop = element('div', 'cw-dialog-top');
  const dialogTitle = element('h2', 'cw-dialog-title', 'Source inspector');
  const closeButton = button('Close ×', 'cw-button cw-close', () => closePanel());
  dialogTop.append(dialogTitle, closeButton);
  const dialogBody = element('div', 'cw-dialog-body');
  dialog.append(dialogTop, dialogBody);
  hud.append(header, location, instrument, hint, joystick, near);
  root.replaceChildren(viewport, hud, intro, dialog);

  function focus(): void {
    if (disposed) return;
    if (modal) closeButton.focus();
    else if (!begun) begin.focus();
    else (viewport.querySelector<HTMLCanvasElement>('canvas') ?? root).focus({ preventScroll: true });
  }
  function clearInput(): void {
    pressed.clear(); touchAxis = { x: 0, z: 0 };
    const pointer = stickPointer;
    stickPointer = null;
    if (pointer !== null && joystick.hasPointerCapture(pointer)) joystick.releasePointerCapture(pointer);
    stickKnob.style.transform = 'translate(-50%, -50%)';
    world?.clearInput();
  }
  function updateInput(): void {
    if (disposed || !begun || modal || document.hidden) { world?.clearInput(); return; }
    const axis = keyboardAxis(pressed);
    world?.setInput(normalizeJoystick(axis.x + touchAxis.x, axis.z + touchAxis.z, 1), pressed.has('ShiftLeft') || pressed.has('ShiftRight'));
  }
  function exit(): void { dispose(); bridge.onExit(); }
  function showPanel(title: string): void {
    if (disposed) return;
    if (!modal) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal = true; clearInput(); world?.setBlocked(true); syncInstrument();
    dialog.dataset.panel = 'folio';
    gateHost = null; gateDigest = null; gateConfirm = null; gateMessage = null;
    dialogTitle.textContent = title;
    dialogBody.replaceChildren();
    dialogBody.scrollTop = 0;
    if (!dialog.open) dialog.showModal();
    closeButton.focus();
  }
  function closePanel(): void {
    if (disposed || !modal) return;
    modal = false; dialog.close(); clearInput(); world?.setBlocked(!begun);
    if (begun && !document.hidden) world?.start();
    syncInstrument();
    if (returnFocus?.isConnected && root.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    else focus();
    returnFocus = null;
  }
  function actionButton(label: string, action: string, id?: string): HTMLButtonElement {
    const node = button(label, 'cw-link');
    node.dataset.cwAction = action;
    if (id) node.dataset.cwTarget = id;
    return node;
  }
  function inspectLandmark(landmark: Landmark): void {
    showPanel(landmark.name);
    const folio = element('div', 'cw-folio');
    const specimen = element('figure', 'cw-specimen');
    specimen.style.setProperty('--cw-specimen', landmark.color);
    const serial = WORLD_LANDMARKS.findIndex(item => item.id === landmark.id) + 1;
    specimen.append(element('span', 'cw-specimen-index', `${String(serial).padStart(2, '0')} / 30`));
    if (landmark.portrait) {
      const image = element('img', 'cw-portrait');
      image.src = landmark.portrait;
      image.alt = `${landmark.name} canonical concept reference portrait`;
      image.width = 256; image.height = 256;
      specimen.append(image);
    } else specimen.append(element('span', 'cw-specimen-letter', landmark.name.slice(0, 1)));
    specimen.append(element('figcaption', 'cw-specimen-tag', `${landmark.kind.toUpperCase()} / ${landmark.portrait ? 'CONCEPT REFERENCE' : 'SOURCE EMBLEM'}`));
    const narrative = element('div', 'cw-folio-narrative');
    const district = DISTRICTS.find(item => item.id === landmark.districtId);
    narrative.append(element('span', 'cw-kicker', `${landmark.kind} · ${district?.name ?? 'Source atlas'}`),
      element('h3', 'cw-role', landmark.verb), element('p', 'cw-detail', landmark.detail));
    const boundary = element('div', 'cw-boundary');
    boundary.append(element('span', 'cw-kicker', 'SOURCE BOUNDARY'), element('p', '', landmark.boundary));
    narrative.append(boundary);
    folio.append(specimen, narrative); dialogBody.append(folio);
    if (landmark.links.length) {
      const connections = element('section', 'cw-connections');
      connections.append(element('span', 'cw-kicker', 'THE CONNECTIONS'), element('p', 'cw-connections-caption', 'Source-defined relationships. Inspect a connected landmark.'));
      const links = element('div', 'cw-source-links');
      const diagram = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const mapped = landmark.links.filter(link => WORLD_LANDMARKS.some(item => item.id === link.to)).slice(0, 6);
      const height = Math.max(112, mapped.length * 46 + 22);
      diagram.setAttribute('viewBox', `0 0 440 ${height}`); diagram.setAttribute('class', 'cw-connection-diagram');
      diagram.setAttribute('aria-hidden', 'true'); diagram.setAttribute('focusable', 'false');
      function diagramShape(tag: 'path' | 'circle' | 'text', attributes: Record<string, string>, text?: string): void {
        const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
        if (text !== undefined) node.textContent = text;
        diagram.append(node);
      }
      diagramShape('circle', { cx: '56', cy: String(height / 2), r: '19', class: 'cw-connection-origin' });
      diagramShape('text', { x: '56', y: String(height / 2 + 4), 'text-anchor': 'middle', class: 'cw-connection-serial' }, String(serial).padStart(2, '0'));
      mapped.forEach((link, index) => {
        const target = WORLD_LANDMARKS.find(item => item.id === link.to);
        const y = 32 + index * 46;
        diagramShape('path', { d: `M75 ${height / 2} C145 ${height / 2} 144 ${y} 222 ${y}`, class: `cw-connection-edge cw-edge-${link.kind}` });
        diagramShape('circle', { cx: '222', cy: String(y), r: '4', class: 'cw-connection-end' });
        diagramShape('text', { x: '239', y: String(y - 2), class: 'cw-connection-name' }, target?.name ?? link.to);
        diagramShape('text', { x: '239', y: String(y + 14), class: 'cw-connection-kind' }, `${link.kind} / ${link.basis}`);
      });
      for (const link of landmark.links) {
        const target = WORLD_LANDMARKS.find(item => item.id === link.to);
        if (!target) continue;
        const node = actionButton(`${target.name} ↗`, 'inspect', target.id);
        node.append(element('small', '', `${link.label} · ${link.kind} / ${link.basis}`));
        node.title = link.label;
        links.append(node);
      }
      const connectionGrid = element('div', 'cw-connection-grid'); connectionGrid.append(diagram, links);
      connections.append(connectionGrid); dialogBody.append(connections);
    }
    const provenance = element('details', 'cw-provenance');
    provenance.append(element('summary', '', 'Source reference'));
    const source = element('p', 'cw-source-path', landmark.source);
    source.title = landmark.source;
    provenance.append(source); dialogBody.append(provenance);
    if (landmark.id === 'gate') {
      gateHost = element('section', 'cw-gate');
      gateHost.setAttribute('aria-label', 'Founder Gate');
      dialogBody.insertBefore(gateHost, dialogBody.children[1] ?? null);
      renderGate();
    }
    const actions = element('div', 'cw-workbench-actions');
    actions.append(actionButton('Source atlas ↗', 'workbench', 'inspect'), actionButton('Mission desk ↗', 'workbench', 'mission'));
    dialogBody.append(actions);
  }
  function gateNode(tag: 'dl' | 'dt' | 'dd', className: string, value?: string): HTMLElement {
    return element(tag, className, value);
  }
  function renderGateList(host: HTMLElement): void {
    host.append(element('span', 'cw-kicker', 'FOUNDER GATE / GOAL PROPOSALS'));
    const mode = element('p', 'cw-gate-mode', gate.label);
    mode.dataset.signer = gate.signer;
    mode.setAttribute('role', 'status');
    host.append(mode);
    if (gate.state !== 'read') {
      host.append(element('p', 'cw-gate-empty', gate.state === 'checking' ? 'Checking the founder read…' : 'The Gate read is held. Nothing can be signed until a verified read returns.'));
      return;
    }
    if (!gate.proposals.length) { host.append(element('p', 'cw-gate-empty', 'No goal proposals are waiting for a founder decision.')); return; }
    const list = element('div', 'cw-gate-list');
    for (const proposal of gate.proposals) {
      const node = actionButton(proposal.title, 'gate-open', proposal.changeDigest);
      node.classList.add('cw-gate-row');
      node.append(element('small', 'cw-gate-digest', proposal.changeDigest),
        element('small', '', `${proposal.expired ? 'Approval window expired' : `Approve by ${proposal.approvalExpiresAt}`} · Inspect ↗`));
      list.append(node);
    }
    host.append(list);
  }
  function renderGateProposal(host: HTMLElement, digest: string): void {
    const proposal = gate.proposals.find(item => item.changeDigest === digest);
    host.append(element('span', 'cw-kicker', 'FOUNDER GATE / INSPECT'));
    if (!proposal) {
      host.append(element('p', 'cw-gate-empty', gate.state === 'read' ? 'This proposal is no longer pending.' : 'The Gate read is not verified right now.'));
      if (gateMessage) host.append(gateStatus());
      host.append(actionButton('All pending proposals ↗', 'inspect', 'gate'));
      return;
    }
    host.append(element('h3', 'cw-gate-title', proposal.title));
    if (proposal.summary) host.append(element('p', 'cw-gate-summary', proposal.summary));
    const mode = element('p', 'cw-gate-mode', gate.label);
    mode.dataset.signer = gate.signer;
    host.append(mode);
    const facts = gateNode('dl', 'cw-gate-inspect');
    for (const row of gateInspectRows(proposal)) {
      const term = gateNode('dt', '', row.label);
      const value = gateNode('dd', row.label === 'Change digest' ? 'cw-gate-digest' : '', row.value);
      facts.append(term, value);
    }
    facts.append(gateNode('dt', '', 'Admission'), gateNode('dd', '', gateAdmissionSummary(proposal.inspect)),
      gateNode('dt', '', 'Approval window'), gateNode('dd', '', `${proposal.approvalExpiresAt}${proposal.expired ? ' · expired' : ''}`),
      gateNode('dt', '', 'Source'), gateNode('dd', '', proposal.sourceRef || 'not served'));
    host.append(facts);
    if (proposal.inspect && proposal.inspect.issues.length) {
      const warning = element('ul', 'cw-gate-warning');
      proposal.inspect.issues.forEach(issue => warning.append(element('li', '', issue)));
      host.append(warning);
    }
    host.append(element('p', 'cw-gate-consequence', proposal.consequence), element('p', 'cw-gate-reversibility', proposal.reversibility));
    const actions = element('div', 'cw-gate-actions');
    if (gateConfirm) {
      const approving = gateConfirm === 'approve-goal-graph';
      const state = gateActionState(gate, proposal, gateConfirm);
      actions.append(element('p', 'cw-gate-confirm-line', approving
        ? `Sign founder approval for change digest ${proposal.changeDigest}? The goal graph commits only after this signature.`
        : `Sign founder rejection for change digest ${proposal.changeDigest}? The goal graph is not written.`));
      const confirm = actionButton(approving ? 'Confirm approval' : 'Confirm rejection', 'gate-sign', gateConfirm);
      confirm.classList.add(approving ? 'cw-gate-approve' : 'cw-gate-reject');
      confirm.disabled = !state.enabled;
      confirm.dataset.cwFocus = 'true';
      actions.append(confirm, actionButton('Cancel', 'gate-cancel'));
    } else {
      for (const [kind, label] of [['approve-goal-graph', 'Approve'], ['reject-goal-graph', 'Reject']] as const) {
        const state = gateActionState(gate, proposal, kind);
        const node = actionButton(proposal.signing ? 'Signing…' : label, 'gate-confirm', kind);
        node.classList.add(kind === 'approve-goal-graph' ? 'cw-gate-approve' : 'cw-gate-reject');
        node.disabled = !state.enabled;
        if (kind === 'approve-goal-graph') node.dataset.cwFocus = 'true';
        actions.append(node);
      }
      const reason = gateActionState(gate, proposal, 'approve-goal-graph').reason;
      if (reason) actions.append(element('p', 'cw-gate-blocked', reason));
    }
    host.append(actions);
    if (gateMessage) host.append(gateStatus());
    host.append(actionButton('All pending proposals ↗', 'inspect', 'gate'));
  }
  function gateStatus(): HTMLElement {
    const status = element('p', 'cw-gate-status', gateMessage?.text ?? '');
    status.dataset.tone = gateMessage?.tone ?? 'pending';
    status.setAttribute('role', 'status');
    return status;
  }
  function renderGate(): void {
    const host = gateHost;
    if (disposed || !host || !host.isConnected) return;
    const hadFocus = host.contains(document.activeElement);
    host.replaceChildren();
    if (gateDigest) renderGateProposal(host, gateDigest);
    else renderGateList(host);
    if (hadFocus || !dialog.contains(document.activeElement)) {
      (host.querySelector<HTMLElement>('[data-cw-focus="true"]:not([disabled])') ?? host.querySelector<HTMLElement>('button:not([disabled])') ?? closeButton).focus({ preventScroll: true });
    }
  }
  function openGateProposal(digest: string): void {
    if (!gate.proposals.some(item => item.changeDigest === digest)) return;
    showPanel('Founder Gate'); dialog.dataset.panel = 'gate';
    gateHost = element('section', 'cw-gate');
    gateHost.setAttribute('aria-label', 'Founder Gate proposal inspector');
    gateDigest = digest;
    dialogBody.append(gateHost);
    renderGate();
  }
  function signGate(kind: GateKind): void {
    const digest = gateDigest;
    const proposal = gate.proposals.find(item => item.changeDigest === digest);
    gateConfirm = null;
    if (!digest || !proposal || !gateActionState(gate, proposal, kind).enabled || typeof bridge.signGate !== 'function') {
      gateMessage = { text: 'Signing is closed for this proposal · no write.', tone: 'refused' };
      renderGate(); return;
    }
    gateMessage = { text: 'Signing with Telegram founder verification…', tone: 'pending' };
    renderGate();
    let pending: Promise<unknown>;
    try { pending = Promise.resolve(bridge.signGate(kind, digest)); } catch { pending = Promise.reject(new Error('sign failed')); }
    pending.then(result => {
      const outcome = result && typeof result === 'object' ? result as { ok?: unknown; message?: unknown } : {};
      return { ok: outcome.ok === true, text: typeof outcome.message === 'string' ? outcome.message.slice(0, 200) : 'Refused · no write.' };
    }, () => ({ ok: false, text: 'Signing failed · no write.' })).then(({ ok, text }) => {
      if (disposed || gateDigest !== digest) return;
      gateMessage = { text, tone: ok ? 'ok' : 'refused' };
      renderGate();
    });
  }
  function onGate(snapshot: unknown): void {
    if (disposed) return;
    gate = normalizeGateSnapshot(snapshot);
    if (nearby?.id === 'gate') nearVerb.textContent = `${nearby.verb} · ${gateCountLabel(gate)}`;
    if (modal && gateHost?.isConnected) renderGate();
  }
  function inspectNearby(): void {
    if (disposed || !begun || modal) return;
    const target = world?.interact() ?? nearby;
    if (target && !modal) inspectLandmark(target);
  }
  function openTravelers(): void {
    showPanel('Your traveling companions'); dialog.dataset.panel = 'travelers';
    dialogBody.append(element('span', 'cw-kicker', 'THREE FIELD KITS / ONE EXPLORER'),
      element('p', 'cw-traveler-copy', 'Choose a silhouette for the trail.'));
    const choices = element('div', 'cw-travelers');
    choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', 'Choose your traveler');
    for (const [index, design] of TRAVELER_DESIGNS.entries()) {
      const card = actionButton('', 'traveler', design.id);
      card.classList.add('cw-traveler-card');
      card.setAttribute('aria-label', `Travel as ${design.name}`);
      card.setAttribute('aria-pressed', String(travelerId === design.id));
      const art = element('div', 'cw-traveler-art');
      art.append(travelerPortrait(design), element('span', 'cw-traveler-serial', `0${index + 1}`));
      const copy = element('div', 'cw-traveler-caption');
      copy.append(element('strong', '', design.name), element('span', '', design.description),
        element('span', 'cw-traveler-selection', travelerId === design.id ? 'YOUR TRAVELER' : 'CHOOSE THIS KIT ↗'));
      card.append(art, copy); choices.append(card);
    }
    const resume = button('Return to the trail ↗', 'cw-traveler-resume cw-link', () => closePanel());
    dialogBody.append(choices, element('p', 'cw-traveler-note', 'Cosmetic companions for local exploration.'), resume);
  }
  function selectTraveler(id: string | undefined): void {
    const design = TRAVELER_DESIGNS.find(item => item.id === id);
    if (!design || !world || disposed) return;
    travelerId = design.id; localTravelers.set(root, travelerId); world.setCharacter(travelerId); renderTravelerLabel();
    for (const card of dialogBody.querySelectorAll<HTMLButtonElement>('[data-cw-action="traveler"]')) {
      const selected = card.dataset.cwTarget === travelerId;
      card.setAttribute('aria-pressed', String(selected));
      const label = card.querySelector('.cw-traveler-selection');
      if (label) label.textContent = selected ? 'YOUR TRAVELER' : 'CHOOSE THIS KIT ↗';
    }
    updateInstrument();
  }
  function openMap(): void {
    showPanel('The field chart'); dialog.dataset.panel = 'passport';
    dialogBody.append(element('span', 'cw-kicker', 'EIGHT DISTRICTS / ONE CONNECTED WORLD'), element('p', 'cw-passport-copy', `${discoveries.size} of 8 districts visited. Local exploration only; visits do not advance real work.`));
    const layout = element('div', 'cw-passport-layout');
    const map = element('div', 'cw-map-ring');
    const chart = createNavigationChart(DISTRICTS, PATHS);
    const snapshot = world?.getState();
    chart.render(snapshot ?? { x: 0, z: 0, heading: 0, district: null }, discoveries);
    map.append(chart.svg, element('span', 'cw-map-caption', 'Physical paths / numbered districts'));
    const districtList = element('div', 'cw-district-list');
    DISTRICTS.forEach((district, index) => {
      const node = actionButton('', 'travel', district.id);
      node.append(element('span', 'cw-district-serial', String(index + 1).padStart(2, '0')),
        element('span', 'cw-district-link-name', district.name), element('span', 'cw-local-stamp', discoveries.has(district.id) ? 'VISITED' : '↗'));
      node.style.setProperty('--cw-dot', district.color);
      node.dataset.visited = String(discoveries.has(district.id));
      node.setAttribute('aria-label', `Travel to ${district.name}${discoveries.has(district.id) ? ', locally visited' : ''}`);
      node.append(element('small', '', district.tagline));
      districtList.append(node);
    });
    const gateShortcut = actionButton(`Founder Gate · ${gateCountLabel(gate)} ↗`, 'inspect', 'gate');
    gateShortcut.append(element('small', '', 'The Gate landmark stands in the Purpose district.'));
    layout.append(map, districtList); dialogBody.append(layout, gateShortcut, actionButton('Browse all 30 source landmarks ↗', 'directory'));
  }
  function openDirectory(): void {
    showPanel('The source directory'); dialog.dataset.panel = 'directory';
    dialogBody.append(element('p', 'cw-passport-copy', 'Thirty landmarks. Existing source references define each identity; relationships retain their recorded source basis.'));
    for (const kind of ['organ', 'system', 'desk'] as const) {
      const group = element('div', 'cw-directory-group');
      const landmarks = WORLD_LANDMARKS.filter(item => item.kind === kind);
      group.append(element('h3', 'cw-kicker', `${kind.toUpperCase()}S / ${String(landmarks.length).padStart(2, '0')}`));
      for (const landmark of landmarks) {
        const node = actionButton(landmark.name, 'inspect', landmark.id);
        node.append(element('span', 'cw-directory-arrow', '↗'));
        node.append(element('small', '', landmark.verb));
        group.append(node);
      }
      dialogBody.append(group);
    }
  }

  listen(dialogBody, 'click', event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-cw-action]') : null;
    if (!target || !dialogBody.contains(target)) return;
    const id = target.dataset.cwTarget;
    if (target.dataset.cwAction === 'traveler') selectTraveler(id);
    else if (target.dataset.cwAction === 'inspect') {
      const landmark = WORLD_LANDMARKS.find(item => item.id === id);
      if (landmark) inspectLandmark(landmark);
    } else if (target.dataset.cwAction === 'travel' && id && DISTRICTS.some(item => item.id === id)) {
      closePanel(); begun = true; root.dataset.walking = 'true'; intro.hidden = true; world?.setBlocked(false); world?.teleport(id); world?.start(); syncInstrument(); focus();
    } else if (target.dataset.cwAction === 'directory') openDirectory();
    else if (target.dataset.cwAction === 'gate-open' && id) openGateProposal(id);
    else if (target.dataset.cwAction === 'gate-confirm' && (id === 'approve-goal-graph' || id === 'reject-goal-graph')) {
      gateConfirm = id; gateMessage = null; renderGate();
    } else if (target.dataset.cwAction === 'gate-cancel') { gateConfirm = null; renderGate(); }
    else if (target.dataset.cwAction === 'gate-sign' && (id === 'approve-goal-graph' || id === 'reject-goal-graph')) signGate(id);
    else if (target.dataset.cwAction === 'workbench' && (id === 'mission' || id === 'gate' || id === 'inspect')) {
      dispose(); bridge.openWorkbench(id);
    }
  });
  listen(dialog, 'cancel', event => { event.preventDefault(); closePanel(); });
  listen(dialog, 'keydown', event => {
    const key = event as KeyboardEvent;
    if (key.key !== 'Tab') return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex="0"]')).filter(item => !item.hidden);
    const first = items[0], last = items[items.length - 1];
    if (key.shiftKey && document.activeElement === first) { key.preventDefault(); last?.focus(); }
    else if (!key.shiftKey && document.activeElement === last) { key.preventDefault(); first?.focus(); }
  });
  listen(window, 'keydown', event => {
    const key = event as KeyboardEvent;
    const focused = root.contains(document.activeElement);
    const editable = key.target instanceof Element && !!key.target.closest('input,textarea,select,[contenteditable="true"]');
    if (!captureWorldKey(key.code, focused, editable)) return;
    key.preventDefault(); key.stopPropagation();
    if (key.code === 'Escape') { if (modal) closePanel(); else exit(); return; }
    if (modal || !begun) { clearInput(); return; }
    if (key.code === 'KeyE') { if (!key.repeat) inspectNearby(); return; }
    pressed.add(key.code); updateInput();
  }, true);
  listen(window, 'keyup', event => {
    const key = event as KeyboardEvent;
    if (pressed.delete(key.code)) { key.preventDefault(); key.stopPropagation(); updateInput(); }
  }, true);
  listen(window, 'blur', () => { clearInput(); syncInstrument(); });
  listen(window, 'focus', () => { syncInstrument(); });
  listen(document, 'visibilitychange', () => {
    clearInput();
    if (document.hidden) world?.pause();
    else if (begun && !modal) world?.start();
    syncInstrument();
  });
  listen(root, 'focusout', event => {
    const next = (event as FocusEvent).relatedTarget;
    if (!(next instanceof Node) || !root.contains(next)) clearInput();
  });
  function stickMove(event: PointerEvent): void {
    if (event.pointerId !== stickPointer || modal || !begun) return;
    const bounds = joystick.getBoundingClientRect();
    touchAxis = normalizeJoystick(event.clientX - bounds.left - bounds.width / 2, event.clientY - bounds.top - bounds.height / 2, 34);
    stickKnob.style.transform = `translate(calc(-50% + ${touchAxis.x * 30}px), calc(-50% + ${touchAxis.z * 30}px))`;
    updateInput();
  }
  listen(joystick, 'pointerdown', event => {
    const pointer = event as PointerEvent;
    if (!begun || modal || stickPointer !== null) return;
    pointer.preventDefault(); focus();
    stickPointer = pointer.pointerId;
    joystick.setPointerCapture(pointer.pointerId);
    stickMove(pointer);
  });
  listen(joystick, 'pointermove', event => stickMove(event as PointerEvent));
  const stopStick = (event: Event): void => {
    if ((event as PointerEvent).pointerId !== stickPointer) return;
    const pointer = stickPointer;
    stickPointer = null;
    if (pointer !== null && joystick.hasPointerCapture(pointer)) joystick.releasePointerCapture(pointer);
    touchAxis = { x: 0, z: 0 }; stickKnob.style.transform = 'translate(-50%, -50%)'; updateInput();
  };
  listen(joystick, 'pointerup', stopStick);
  listen(joystick, 'pointercancel', stopStick);
  listen(joystick, 'lostpointercapture', stopStick);

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  listen(motion, 'change', () => world?.setReducedMotion(motion.matches));
  function renderRead(snapshot: { state: string; label: string }): void {
    if (disposed) return;
    read.textContent = typeof snapshot?.label === 'string' ? snapshot.label.slice(0, 90) : 'Source world · Read held';
    read.dataset.readState = typeof snapshot?.state === 'string' ? snapshot.state : 'held';
  }
  function onError(message: string): void {
    if (disposed) return;
    root.dataset.curiousWorldFailure = message.slice(0, 180);
    dispose(); bridge.onExit(message.slice(0, 180));
  }
  function onDistrict(district: District | null): void {
    const index = district ? DISTRICTS.findIndex(item => item.id === district.id) + 1 : 0;
    districtNumber.textContent = `${String(index).padStart(2, '0')} / ${district ? 'DISTRICT' : 'THE THRESHOLD'}`;
    districtName.textContent = district?.name ?? 'The Commons';
    districtTagline.textContent = district?.tagline ?? 'Choose a path. Meet the whole system.';
    if (district) {
      discoveries.add(district.id);
      renderPassportCount();
      root.dataset.localDistrictVisits = String(discoveries.size);
    }
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true; instrumentObserver.dispose(); clearInput();
    if (stickPointer !== null && joystick.hasPointerCapture(stickPointer)) joystick.releasePointerCapture(stickPointer);
    stickPointer = null;
    if (dialog.open) dialog.close();
    listeners.splice(0).reverse().forEach(remove => remove());
    unsubscribe?.(); unsubscribe = null;
    gateUnsubscribe?.(); gateUnsubscribe = null; gateHost = null;
    world?.dispose(); world = null;
    root.replaceChildren(); root.classList.remove('cw'); delete root.dataset.walking;
  }
  try {
    world = createWorld(viewport, {
      onNearby: target => {
        nearby = target; inspect.disabled = !target;
        near.dataset.active = String(!!target);
        nearName.textContent = target?.name ?? 'Follow your curiosity';
        nearVerb.textContent = !target ? 'Walk closer to inspect a source landmark'
          : target.id === 'gate' ? `${target.verb} · ${gateCountLabel(gate)}` : `${target.verb} · source`;
      },
      onDistrict,
      onState: snapshot => {
        if (!disposed && begun && !modal && !document.hidden)
          instrumentObserver.update(snapshot, performance.now(), !snapshot.renderActive);
      },
      onInteract: target => { if (begun && !modal) inspectLandmark(target); },
      onDiscover: id => {
        if (!DISTRICTS.some(district => district.id === id)) return;
        discoveries.add(id); renderPassportCount();
        root.dataset.localDistrictVisits = String(discoveries.size);
      },
      onError,
    }, { reducedMotion: motion.matches });
    if (disposed) { world.dispose(); world = null; throw new Error('Curious renderer unavailable'); }
    world.setBlocked(true); world.setCharacter(travelerId); world.start();
    updateInstrument();
    renderRead(bridge.getReadState());
    unsubscribe = bridge.subscribeRead(renderRead);
    // A Gate bridge fault holds only the Gate closed; the world keeps walking.
    try {
      if (typeof bridge.subscribeGate === 'function') gateUnsubscribe = bridge.subscribeGate(onGate);
      else if (typeof bridge.getGateState === 'function') onGate(bridge.getGateState());
    } catch { gateUnsubscribe = null; onGate(HELD_GATE); }
  } catch (error) {
    dispose();
    throw error instanceof Error ? error : new Error('Curious world could not start');
  }
  return { dispose, focus };
}
