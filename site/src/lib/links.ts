import type { Capability, Entry } from './types.ts';

export const REPO = 'https://github.com/pc-style/captchastrophe';
export const RULES_URL = `${REPO}/blob/main/docs/rules.md`;
export const SUBMIT_URL = `${REPO}/blob/main/CONTRIBUTING.md`;
export const LICENSE_URL = `${REPO}/blob/main/LICENSE`;

export function reportUrl(entry: Pick<Entry, 'id'>): string {
  return `${REPO}/issues/new?template=report.yml&title=${encodeURIComponent(`Report: ${entry.id}`)}`;
}

export function prUrl(prNumber: number): string {
  return `${REPO}/pull/${prNumber}`;
}

export function profileUrl(login: string): string {
  return `https://github.com/${encodeURIComponent(login)}`;
}

/** Permissions Policy tokens delegated to the frame, from the entry's declared capabilities only. */
const ALLOW: Record<Capability, readonly string[]> = {
  camera: ['camera'],
  microphone: ['microphone'],
  fullscreen: ['fullscreen'],
  motion: ['accelerometer', 'gyroscope', 'magnetometer'],
  audio: ['autoplay'],
};

export function allowAttribute(capabilities: readonly Capability[]): string {
  const tokens = new Set<string>();
  for (const capability of capabilities) for (const token of ALLOW[capability] ?? []) tokens.add(token);
  return [...tokens].join('; ');
}

export function frameSrc(playOrigin: string, id: string, theme: 'light' | 'dark'): string {
  return `${playOrigin}/${encodeURIComponent(id)}/?theme=${theme}`;
}

/** Returns a bare origin (no path, no trailing slash) or null when the value is not usable. */
export function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const CAPABILITY_LABEL: Record<Capability, string> = {
  camera: 'camera',
  microphone: 'microphone',
  motion: 'motion sensors',
  fullscreen: 'fullscreen',
  audio: 'sound',
};

export function describeCapabilities(capabilities: readonly Capability[]): string {
  const labels = capabilities.map((c) => CAPABILITY_LABEL[c]);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
