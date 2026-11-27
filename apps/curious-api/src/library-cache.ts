import { findSensitive } from "./sensitive.ts";

export interface QueueItem {
  id: string;
  op: "put" | "tombstone";
  publicBody?: unknown;
  personal?: unknown;
  enqueuedAt: string;
}

export function enqueue(queue: QueueItem[], item: QueueItem): { queue: QueueItem[] } | { error: "sensitive_rejected" } {
  if (findSensitive(item)) return { error: "sensitive_rejected" };
  return { queue: [...queue, item] };
}
