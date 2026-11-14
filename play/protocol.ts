import type { Capability, CaptchaState, Theme } from '../sdk/index.d.ts';

export const PROTOCOL_VERSION = 1;

export const CAPABILITIES = ['camera', 'microphone', 'motion', 'fullscreen', 'audio'] as const satisfies readonly Capability[];
export const CAPTCHA_STATES = ['idle', 'active', 'solved'] as const satisfies readonly CaptchaState[];

export const LAYOUT_MIN_HEIGHT = 160;
export const LAYOUT_MAX_HEIGHT = 900;

export type FrameMessage =
  | { type: 'ready' }
  | { type: 'state'; state: CaptchaState }
  | { type: 'success' }
  | { type: 'layout'; minHeight?: number; maxHeight?: number; fullBleed?: boolean }
  | {
      type: 'capability-denied';
      capability: 'camera' | 'microphone';
      reason: 'denied' | 'unsupported' | 'unavailable';
    };

export type ParentMessage =
  | { type: 'theme'; theme: Theme }
  | { type: 'mute'; muted: boolean }
  | { type: 'reset' };

/** Clamp a requested height into the allowed range. Returns undefined for non-numbers. */
export function clampHeight(value: unknown, max: number = LAYOUT_MAX_HEIGHT): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const upper = Math.max(LAYOUT_MIN_HEIGHT, Math.min(max, LAYOUT_MAX_HEIGHT));
  return Math.round(Math.min(Math.max(value, LAYOUT_MIN_HEIGHT), upper));
}

export function parseTheme(value: unknown): Theme | undefined {
  return value === 'light' || value === 'dark' ? value : undefined;
}

/** Validate an untrusted parent message. Anything unexpected returns undefined. */
export function parseParentMessage(data: unknown): ParentMessage | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const message = data as Record<string, unknown>;
  if (message.v !== PROTOCOL_VERSION) return undefined;
  switch (message.type) {
    case 'theme': {
      const theme = parseTheme(message.theme);
      return theme ? { type: 'theme', theme } : undefined;
    }
    case 'mute':
      return typeof message.muted === 'boolean' ? { type: 'mute', muted: message.muted } : undefined;
    case 'reset':
      return { type: 'reset' };
    default:
      return undefined;
  }
}
