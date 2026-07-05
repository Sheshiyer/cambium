import type { BranchLoop, BranchStoryArc } from './branch-stories.ts';

export type BranchLoopRunMode = 'read-only' | 'approval-required' | 'never-alone';

export interface BranchLoopLibraryRow {
  loopId: string;
  branchId: string;
  branchKind: BranchStoryArc['branchKind'];
  branchName: string;
  productId: string;
  productName: string;
  title: string;
  cadence: string;
  objective: string;
  metric: string;
  boundaryColor: BranchLoop['boundaryColor'];
  runMode: BranchLoopRunMode;
  oneChangeRule: string;
  stateFile: string;
  stopRule: string;
  modelRoute: string;
  proofRequired: string;
  promotionState: BranchStoryArc['promotion']['state'];
  currentGate: string;
  packetFile: string;
}

export interface BranchLoopLibrary {
  source: 'product-branch-packets@v1';
  status: 'empty' | 'ready' | 'blocked';
  total: number;
  green: number;
  yellow: number;
  red: number;
  rows: BranchLoopLibraryRow[];
}

export interface LoopCanRunUnattendedOptions {
  schedulingApproved?: boolean;
}

export function loopCanRunUnattended(loop: BranchLoop, options: LoopCanRunUnattendedOptions = {}): boolean {
  return loop.boundaryColor === 'green' && options.schedulingApproved === true;
}

export function loopRunMode(loop: BranchLoop): BranchLoopRunMode {
  if (loop.boundaryColor === 'green') return 'read-only';
  if (loop.boundaryColor === 'yellow') return 'approval-required';
  return 'never-alone';
}

export function deriveBranchLoopLibrary(stories: BranchStoryArc[]): BranchLoopLibrary {
  const rows = stories.flatMap((story) =>
    story.loops.map((loop) => ({
      loopId: loop.loopId,
      branchId: story.branchId,
      branchKind: story.branchKind,
      branchName: story.name,
      productId: story.productId,
      productName: story.name,
      title: loop.title,
      cadence: loop.cadence,
      objective: loop.objective,
      metric: loop.metric,
      boundaryColor: loop.boundaryColor,
      runMode: loopRunMode(loop),
      oneChangeRule: loop.oneChangeRule,
      stateFile: loop.stateFile,
      stopRule: loop.stopRule,
      modelRoute: loop.modelRoute,
      proofRequired: loop.proofRequired,
      promotionState: story.promotion.state,
      currentGate: story.promotion.currentGate,
      packetFile: story.source.packetFile,
    }))
  );

  let green = 0;
  let yellow = 0;
  let red = 0;

  for (const row of rows) {
    if (row.boundaryColor === 'green') green++;
    if (row.boundaryColor === 'yellow') yellow++;
    if (row.boundaryColor === 'red') red++;
  }

  return {
    source: 'product-branch-packets@v1',
    status: rows.length === 0 ? 'empty' : red > 0 ? 'blocked' : 'ready',
    total: rows.length,
    green,
    yellow,
    red,
    rows,
  };
}
