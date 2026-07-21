import type { TapestrySnapshot } from './constellation-layout.ts';
import { fixtureTapestry } from './fixture-tapestry.ts';

const TAPESTRY_URL = '/tapestry.json';
const FETCH_TIMEOUT_MS = 2000;

function isTapestrySnapshot(value: unknown): value is TapestrySnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TapestrySnapshot>;
  return (
    !!candidate.tenant &&
    typeof candidate.tenant.id === 'string' &&
    !!candidate.field &&
    typeof candidate.field.width === 'number' &&
    typeof candidate.field.depth === 'number' &&
    Array.isArray(candidate.nodes)
  );
}

export async function loadTapestrySnapshot(): Promise<TapestrySnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(TAPESTRY_URL, { signal: controller.signal });
    if (!response.ok) return fixtureTapestry;
    const data: unknown = await response.json();
    return isTapestrySnapshot(data) ? data : fixtureTapestry;
  } catch {
    return fixtureTapestry;
  } finally {
    clearTimeout(timeout);
  }
}
