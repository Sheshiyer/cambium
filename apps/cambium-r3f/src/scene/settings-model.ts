export interface AppSettings {
  reducedMotion: 'system' | 'on' | 'off';
  defaultCamera: 'overview' | 'node' | 'flat';
  tenant: string;
  workerBaseUrl: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  reducedMotion: 'system',
  defaultCamera: 'overview',
  tenant: 'demo-org',
  workerBaseUrl: '',
};

export const SETTINGS_STORAGE_KEY = 'cambium.settings.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function normalizeTenant(raw: string): string {
  return raw.trim().toLowerCase();
}

export function loadSettings(storage?: StorageLike): AppSettings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_SETTINGS };
    return {
      reducedMotion: ['system', 'on', 'off'].includes(parsed.reducedMotion) ? parsed.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
      defaultCamera: ['overview', 'node', 'flat'].includes(parsed.defaultCamera) ? parsed.defaultCamera : DEFAULT_SETTINGS.defaultCamera,
      tenant: typeof parsed.tenant === 'string' && normalizeTenant(parsed.tenant) ? normalizeTenant(parsed.tenant) : DEFAULT_SETTINGS.tenant,
      workerBaseUrl: typeof parsed.workerBaseUrl === 'string' ? parsed.workerBaseUrl : DEFAULT_SETTINGS.workerBaseUrl,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings, storage?: StorageLike): void {
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage full or blocked — settings stay in memory */
  }
}

export function settingsToRows(settings: AppSettings): readonly { id: string; label: string; value: string; tone?: string }[] {
  return [
    { id: 'reduced-motion', label: 'REDUCED MOTION', value: settings.reducedMotion, tone: settings.reducedMotion === 'off' ? 'signal' : 'mist' },
    { id: 'default-camera', label: 'DEFAULT CAMERA', value: settings.defaultCamera, tone: 'mist' },
    { id: 'tenant', label: 'TENANT', value: settings.tenant, tone: 'depth' },
    { id: 'worker-url', label: 'WORKER URL', value: settings.workerBaseUrl || 'not configured', tone: settings.workerBaseUrl ? 'signal' : 'depth' },
  ];
}
