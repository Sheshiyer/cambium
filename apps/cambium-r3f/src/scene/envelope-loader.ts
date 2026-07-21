import type { MiniAppMapSubsection, MiniAppSurfaceSection } from '../../../../shared/mini-app-surface-contract.ts';
import { identityToPrincipalHeader, type Identity } from './identity-model.ts';
import type { AppSettings } from './settings-model.ts';

export interface QuestEnvelopeSurface {
  sections?: readonly MiniAppSurfaceSection[];
  subsections?: readonly MiniAppMapSubsection[];
}

export interface QuestEnvelope {
  surface?: QuestEnvelopeSurface;
  [key: string]: unknown;
}

export type EnvelopeLoadResult =
  | { ok: true; envelope: QuestEnvelope }
  | { ok: false; reason: 'unconfigured' | 'offline' | 'bad-status' };

export const ENVELOPE_TIMEOUT_MS = 2500;

export async function loadEnvelope(settings: AppSettings, identity: Identity | null): Promise<EnvelopeLoadResult> {
  const base = settings.workerBaseUrl.trim().replace(/\/+$/, '');
  if (!base) return { ok: false, reason: 'unconfigured' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENVELOPE_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {};
    if (identity) headers['x-principal'] = identityToPrincipalHeader(identity);
    const response = await fetch(`${base}/api/quests/${encodeURIComponent(settings.tenant)}`, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, reason: 'bad-status' };
    const envelope = (await response.json()) as QuestEnvelope;
    return { ok: true, envelope };
  } catch {
    return { ok: false, reason: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
