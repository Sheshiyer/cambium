/** Local reading preference only; never an operational receipt. */
export const ONBOARDING_VERSION = 1;
export const ONBOARDING_STORAGE_KEY = 'cambium.onboarding.v1';
export interface TourStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function browserTourStorage(): TourStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; }
  catch { return undefined; }
}
export function hasCompletedTour(storage?: TourStorage): boolean {
  try {
    const value: unknown = JSON.parse(storage?.getItem(ONBOARDING_STORAGE_KEY) ?? 'null');
    return typeof value === 'object' && value !== null &&
      'version' in value && value.version === ONBOARDING_VERSION &&
      'completed' in value && value.completed === true;
  } catch { return false; }
}
export function recordTourCompletion(storage?: TourStorage): boolean {
  try {
    if (!storage) return false;
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ version: ONBOARDING_VERSION, completed: true }));
    return true;
  } catch { return false; }
}
export function tourIndex(index: number, total: number): number {
  return Math.min(Math.max(Number.isFinite(index) ? Math.trunc(index) : 0, 0), Math.max(total - 1, 0));
}
