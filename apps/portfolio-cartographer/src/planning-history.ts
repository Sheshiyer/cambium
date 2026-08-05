import type { WorkPlan } from './domain.ts'

export interface QuickUndoEntry {
  id: string
  prior: WorkPlan | null
  label: string
}

export type BulkUndoSnapshot = Record<string, WorkPlan | null>

export interface PlanningHistory {
  quick: QuickUndoEntry[]
  bulk: BulkUndoSnapshot | null
}

export function emptyPlanningHistory(): PlanningHistory {
  return { quick: [], bulk: null }
}

export function recordQuickUndo(history: PlanningHistory, entry: QuickUndoEntry): PlanningHistory {
  return { quick: [...history.quick, entry].slice(-50), bulk: null }
}

export function popQuickUndo(history: PlanningHistory): PlanningHistory {
  return { quick: history.quick.slice(0, -1), bulk: null }
}

export function recordBulkUndo(snapshot: BulkUndoSnapshot): PlanningHistory {
  return { quick: [], bulk: snapshot }
}

export function discardBulkUndo(history: PlanningHistory): PlanningHistory {
  return { quick: history.quick, bulk: null }
}
