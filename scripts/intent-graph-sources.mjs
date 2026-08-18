import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

export const INTENT_GRAPH_AUTHORITY_BOUNDARIES = Object.freeze({
  d1GoalGraph: Object.freeze({
    role: 'sole_operational_writer',
    owns: Object.freeze(['goals', 'dependencies', 'status', 'approvals', 'terminal_receipts']),
  }),
  intentGraph: Object.freeze({
    role: 'read_only_projection',
    writesOperationalState: false,
    writesDoctrine: false,
  }),
});

const GENERATED_PATHS = new Set([
  'docs/architecture/intent-graph.v1.json',
  'docs/architecture/intent-graph.md',
]);

function canonicalText(value) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

function digestText(value) {
  return `sha256:${createHash('sha256').update(canonicalText(value), 'utf8').digest('hex')}`;
}

function headingSections(text, heading) {
  const lines = canonicalText(text).split('\n');
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]);
    if (!match || match[2] !== heading) continue;
    const level = match[1].length;
    let end = lines.length - 1;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = /^(#{1,6})\s+/.exec(lines[cursor]);
      if (next && next[1].length <= level) {
        end = cursor;
        break;
      }
    }
    matches.push(lines.slice(index, end).join('\n'));
  }
  return matches;
}

function exactlyOne(matches, pathSelector) {
  if (matches.length !== 1) {
    throw new TypeError(`selector ${pathSelector} must resolve exactly once; received ${matches.length} matches`);
  }
  return canonicalText(matches[0]);
}

function selectContent(raw, selector, relativePath) {
  const text = canonicalText(raw);
  const pathSelector = `${relativePath}#${selector}`;
  if (selector === 'whole-file') return text;
  if (selector.startsWith('markdown.heading:')) {
    return exactlyOne(headingSections(text, selector.slice('markdown.heading:'.length)), pathSelector);
  }
  if (selector.startsWith('markdown.bold-field:')) {
    const specification = selector.slice('markdown.bold-field:'.length);
    const separator = specification.lastIndexOf('#');
    const heading = specification.slice(0, separator);
    const field = specification.slice(separator + 1);
    const matches = headingSections(text, heading).flatMap((section) => section.split('\n').filter((line) => {
      const match = /^\*\*([^*]+)\*\*:\s*(.*?)\s*$/.exec(line);
      return match?.[1] === field;
    }));
    return exactlyOne(matches, pathSelector);
  }
  if (selector.startsWith('frontmatter.')) {
    const field = selector.slice('frontmatter.'.length);
    const lines = text.split('\n');
    const end = lines.indexOf('---', 1);
    return exactlyOne(lines.slice(1, end).filter((line) => line.startsWith(`${field}:`)), pathSelector);
  }
  if (selector.startsWith('markdown.list-item:')) {
    const prefix = selector.slice('markdown.list-item:'.length);
    return exactlyOne(text.split('\n').filter((line) => line.startsWith(prefix)), pathSelector);
  }
  if (selector.startsWith('xml.task-name:')) {
    const name = selector.slice('xml.task-name:'.length);
    const matches = [];
    for (const match of text.matchAll(/<task\b[^>]*>[\s\S]*?<\/task>/g)) {
      const names = [...match[0].matchAll(/<name>\s*([^<]+?)\s*<\/name>/g)].map((entry) => entry[1]);
      if (names.length === 1 && names[0] === name) matches.push(match[0]);
    }
    return exactlyOne(matches, pathSelector);
  }
  throw new TypeError(`unsupported source selector ${pathSelector}`);
}

function assertSourcePolicy(relativePath, selector) {
  if (relativePath === '.planning/STATE.md' || GENERATED_PATHS.has(relativePath)) {
    throw new TypeError(`source path ${relativePath} is excluded from the intent graph`);
  }
  if (relativePath === '.planning/ROADMAP.md'
      && (!selector.startsWith('markdown.bold-field:Phase ') || !selector.endsWith('#Goal'))) {
    throw new TypeError(`ROADMAP source ${relativePath} may select only an exact Phase Goal field`);
  }
  if (relativePath === 'ISA.md'
      && selector !== 'frontmatter.task'
      && !selector.startsWith('markdown.list-item:- 2026-08-18 06:25: refined:')) {
    throw new TypeError('ISA source may select only frontmatter.task or the exact reviewed Phase 4 decision');
  }
}

function createResolver(repositoryRoot) {
  const root = realpathSync(repositoryRoot);
  const selected = (relativePath, selector) => {
    assertSourcePolicy(relativePath, selector);
    let raw;
    try {
      raw = readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
    } catch {
      throw new TypeError(`source ${relativePath}#${selector} is missing`);
    }
    return selectContent(raw, selector, relativePath);
  };
  return {
    node(relativePath, authority, selector) {
      return { path: relativePath, authority, selector, digest: digestText(selected(relativePath, selector)) };
    },
    edge(relativePath, selector) {
      return { path: relativePath, selector, digest: digestText(selected(relativePath, selector)) };
    },
    whole(relativePath) {
      return { path: relativePath, digest: digestText(selected(relativePath, 'whole-file')) };
    },
  };
}

const noStop = Object.freeze({ kind: 'none', sourcePath: null, selector: null, satisfied: false });

function state({ completion, approval = 'not_required', blockedReason = null, stopCondition = noStop }) {
  return { completion, approval, freshness: 'fresh', blockedReason, stopCondition: { ...stopCondition } };
}

function sourceStop(kind, sourcePath, selector, satisfied) {
  return { kind, sourcePath, selector, satisfied };
}

export function buildIntentGraphSources(repositoryRoot) {
  const source = createResolver(repositoryRoot);
  const visionSelector = 'markdown.heading:Just Cause';
  const missionSelector = 'markdown.heading:Current pursuit';
  const phase3GoalSelector = 'markdown.bold-field:Phase 3: Canonical Infinite-Game Anchors#Goal';
  const phase4GoalSelector = 'markdown.bold-field:Phase 4: Provenance-Preserving Intent Graph#Goal';
  const isaTaskSelector = 'frontmatter.task';
  const evidenceSelector = 'markdown.heading:Probe Execution';
  const learningSelector = 'markdown.heading:Gaps Summary';
  const gateSelector = 'markdown.list-item:- 2026-08-18 06:25: refined:';
  const projectOverlaySelector = 'markdown.heading:Authority and pickup';
  const planningOverlaySelector = 'markdown.heading:Current Milestone: v0.4 Cambium Infinite-Game Doctrine and Intent Graph';

  const taskDeclarations = [
    ['phase3-plan01-task01', '.planning/phases/03-canonical-infinite-game-anchors/03-01-PLAN.md', 'Task 1: Commit the RED infinite-game anchor contract', true],
    ['phase3-plan01-task02', '.planning/phases/03-canonical-infinite-game-anchors/03-01-PLAN.md', 'Task 2: Bind active ISA acceptance and commit canonical root anchors', true],
    ['phase3-plan02-task01', '.planning/phases/03-canonical-infinite-game-anchors/03-02-PLAN.md', 'Task 1: Link canonical anchors, close ISA evidence, and verify the committed range', true],
    ['phase4-plan01-task01', '.planning/phases/04-provenance-preserving-intent-graph/04-01-PLAN.md', 'Task 1: Commit the RED adversarial intent-graph contract', false],
    ['phase4-plan01-task02', '.planning/phases/04-provenance-preserving-intent-graph/04-01-PLAN.md', 'Task 2: Implement the pure compiler and authority contract', false],
    ['phase4-plan02-task01', '.planning/phases/04-provenance-preserving-intent-graph/04-02-PLAN.md', 'Task 1: Commit the RED generator and readback-parity contract', false],
    ['phase4-plan02-task02', '.planning/phases/04-provenance-preserving-intent-graph/04-02-PLAN.md', 'Task 2: Generate the canonical repository projection and matching readback', false],
    ['phase4-plan03-task01', '.planning/phases/04-provenance-preserving-intent-graph/04-03-PLAN.md', 'Task 1: Publish graph discovery and the D1 authority distinction', false],
    ['phase4-plan03-task02', '.planning/phases/04-provenance-preserving-intent-graph/04-03-PLAN.md', 'Task 2: Close Phase 4 acceptance from full committed evidence', false],
  ];

  const nodes = [
    {
      key: 'vision', kind: 'vision', lifecycle: 'enduring',
      source: source.node('VISION.md', 'vision_anchor', visionSelector),
      state: state({ completion: 'not_applicable' }),
    },
    {
      key: 'mission', kind: 'mission', lifecycle: 'renewable',
      source: source.node('MISSION.md', 'repository_mission', missionSelector),
      state: state({ completion: 'pending', stopCondition: sourceStop('mission_review', 'MISSION.md', missionSelector, false) }),
    },
    {
      key: 'approved-milestone-goal', kind: 'goal', lifecycle: 'finite',
      source: source.node('ISA.md', 'isa_acceptance', isaTaskSelector),
      state: state({ completion: 'pending', approval: 'approved' }),
    },
    {
      key: 'phase3-goal', kind: 'goal', lifecycle: 'finite',
      source: source.node('.planning/ROADMAP.md', 'gsd_planning', phase3GoalSelector),
      state: state({ completion: 'satisfied', stopCondition: sourceStop('finite_goal', '.planning/ROADMAP.md', phase3GoalSelector, true) }),
    },
    {
      key: 'phase4-goal', kind: 'goal', lifecycle: 'finite',
      source: source.node('.planning/ROADMAP.md', 'gsd_planning', phase4GoalSelector),
      state: state({ completion: 'pending', stopCondition: sourceStop('finite_goal', '.planning/ROADMAP.md', phase4GoalSelector, false) }),
    },
    ...taskDeclarations.map(([key, sourcePath, name, complete]) => ({
      key,
      kind: 'task',
      lifecycle: 'planned',
      source: source.node(sourcePath, 'gsd_planning', `xml.task-name:${name}`),
      state: state({
        completion: complete ? 'satisfied' : 'pending',
        stopCondition: complete
          ? sourceStop('external_verification', '.planning/phases/03-canonical-infinite-game-anchors/03-VERIFICATION.md', evidenceSelector, true)
          : noStop,
      }),
    })),
    {
      key: 'phase3-evidence', kind: 'evidence', lifecycle: 'verified',
      source: source.node('.planning/phases/03-canonical-infinite-game-anchors/03-VERIFICATION.md', 'verification_evidence', evidenceSelector),
      state: state({ completion: 'satisfied', stopCondition: sourceStop('external_verification', '.planning/phases/03-canonical-infinite-game-anchors/03-VERIFICATION.md', evidenceSelector, true) }),
    },
    {
      key: 'phase3-learning', kind: 'learning', lifecycle: 'verified',
      source: source.node('.planning/phases/03-canonical-infinite-game-anchors/03-VERIFICATION.md', 'verification_evidence', learningSelector),
      state: state({ completion: 'satisfied' }),
    },
    {
      key: 'phase4-reviewed-gate', kind: 'gate', lifecycle: 'gated',
      source: source.node('ISA.md', 'isa_acceptance', gateSelector),
      state: state({
        completion: 'blocked',
        approval: 'required',
        blockedReason: 'Next-wave execution approval is recorded outside this read-only generated source model.',
        stopCondition: sourceStop('approval_boundary', 'ISA.md', gateSelector, false),
      }),
    },
    {
      key: 'root-project-overlay', kind: 'overlay', lifecycle: 'derived',
      source: source.node('PROJECT.md', 'derived_reference', projectOverlaySelector),
      anchorReferences: [source.whole('VISION.md'), source.whole('MISSION.md')],
      state: state({ completion: 'not_applicable' }),
    },
    {
      key: 'planning-project-overlay', kind: 'overlay', lifecycle: 'derived',
      source: source.node('.planning/PROJECT.md', 'derived_reference', planningOverlaySelector),
      anchorReferences: [source.whole('VISION.md'), source.whole('MISSION.md')],
      state: state({ completion: 'not_applicable' }),
    },
  ];

  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const edge = (from, kind, to) => {
    const owner = byKey.get(from);
    return {
      from,
      kind,
      to,
      source: source.edge(owner.source.path, owner.source.selector),
    };
  };

  const edges = [
    edge('vision', 'directs', 'mission'),
    edge('mission', 'scopes', 'approved-milestone-goal'),
    edge('mission', 'scopes', 'phase3-goal'),
    edge('mission', 'scopes', 'phase4-goal'),
    ...taskDeclarations.map(([key, , , complete]) => edge(complete ? 'phase3-goal' : 'phase4-goal', 'decomposes', key)),
    ...taskDeclarations.filter(([, , , complete]) => complete).map(([key]) => edge(key, 'proves', 'phase3-evidence')),
    edge('phase3-evidence', 'closes', 'phase3-goal'),
    edge('phase3-evidence', 'produces', 'phase3-learning'),
    edge('phase3-learning', 'informs', 'phase4-reviewed-gate'),
    edge('phase4-reviewed-gate', 'renews', 'phase4-goal'),
    edge('phase4-reviewed-gate', 'gates', 'phase4-goal'),
    edge('root-project-overlay', 'references', 'vision'),
    edge('root-project-overlay', 'references', 'mission'),
    edge('planning-project-overlay', 'references', 'vision'),
    edge('planning-project-overlay', 'references', 'mission'),
  ];

  return { nodes, edges };
}
