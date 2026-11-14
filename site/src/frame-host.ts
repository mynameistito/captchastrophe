// Parent side of the gallery <-> captcha-frame protocol (docs/architecture.md, "Parent <-> frame messages").
//
// frame -> parent, each `{ v: 1, type, ... }` with exactly these keys and no others:
//   ready
//   state              state: 'idle' | 'active' | 'solved'
//   success
//   layout             height?: number, minHeight?: number   (at least one; clamped to 240..900)
//   capability-denied  capability: camera | microphone | motion | fullscreen | audio, reason?: denied | unsupported | unavailable | error
// parent -> frame, the only three things this file can send:
//   theme  { theme: 'light' | 'dark' }
//   mute   { muted: boolean }
//   reset
// There is no vote, token, navigation or auth message in either direction. Anything else is ignored.

import { CAPABILITIES, type Capability, type Theme } from './lib/types.ts';

export const PROTOCOL_VERSION = 1;
export const MIN_FRAME_HEIGHT = 240;
export const MAX_FRAME_HEIGHT = 900;

export type FrameState = 'idle' | 'active' | 'solved';
export type DeniedReason = 'denied' | 'unsupported' | 'unavailable' | 'error';

export type FrameMessage =
  | { type: 'ready' }
  | { type: 'state'; state: FrameState }
  | { type: 'success' }
  | { type: 'layout'; height: number }
  | { type: 'capability-denied'; capability: Capability; reason?: DeniedReason };

const STATES: readonly string[] = ['idle', 'active', 'solved'];
const REASONS: readonly string[] = ['denied', 'unsupported', 'unavailable', 'error'];

export function clampHeight(value: number): number {
  return Math.min(MAX_FRAME_HEIGHT, Math.max(MIN_FRAME_HEIGHT, Math.round(value)));
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.prototype.toString.call(value) === '[object Object]';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function onlyKeys(data: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(data).every((key) => allowed.includes(key));
}

/** Strict shape check. Returns null for anything that is not exactly a documented v1 message. */
export function parseFrameMessage(data: unknown): FrameMessage | null {
  if (!isPlainObject(data) || data.v !== PROTOCOL_VERSION || typeof data.type !== 'string') return null;
  switch (data.type) {
    case 'ready':
      return onlyKeys(data, ['v', 'type']) ? { type: 'ready' } : null;
    case 'success':
      return onlyKeys(data, ['v', 'type']) ? { type: 'success' } : null;
    case 'state':
      return onlyKeys(data, ['v', 'type', 'state']) && typeof data.state === 'string' && STATES.includes(data.state)
        ? { type: 'state', state: data.state as FrameState }
        : null;
    case 'layout': {
      if (!onlyKeys(data, ['v', 'type', 'height', 'minHeight'])) return null;
      const { height, minHeight } = data;
      if (height !== undefined && !finite(height)) return null;
      if (minHeight !== undefined && !finite(minHeight)) return null;
      if (height === undefined && minHeight === undefined) return null;
      return { type: 'layout', height: clampHeight(Math.max((height as number | undefined) ?? 0, (minHeight as number | undefined) ?? 0)) };
    }
    case 'capability-denied': {
      if (!onlyKeys(data, ['v', 'type', 'capability', 'reason'])) return null;
      if (typeof data.capability !== 'string' || !(CAPABILITIES as readonly string[]).includes(data.capability)) return null;
      if (data.reason !== undefined && (typeof data.reason !== 'string' || !REASONS.includes(data.reason))) return null;
      const message: FrameMessage = { type: 'capability-denied', capability: data.capability as Capability };
      if (data.reason !== undefined) message.reason = data.reason as DeniedReason;
      return message;
    }
    default:
      return null;
  }
}

export interface IncomingMessage {
  source: unknown;
  origin: string;
  data: unknown;
}

export interface FrameLike {
  contentWindow: { postMessage(message: unknown, targetOrigin: string): void } | null;
}

export interface FrameHostOptions {
  /** Bare origin of the play host, e.g. https://play.example.workers.dev */
  playOrigin: string;
  onMessage(message: FrameMessage): void;
  /** Injection point for tests. Defaults to the window "message" event. */
  listen?: (handler: (event: IncomingMessage) => void) => () => void;
}

export interface FrameHost {
  attach(frame: FrameLike): void;
  /** Forget the frame. Later messages from it are ignored. Removing the element is the caller's job. */
  detach(): void;
  sendTheme(theme: Theme): void;
  sendMute(muted: boolean): void;
  sendReset(): void;
  dispose(): void;
}

function windowListen(handler: (event: IncomingMessage) => void): () => void {
  const listener = (event: MessageEvent) => handler({ source: event.source, origin: event.origin, data: event.data });
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

export function createFrameHost(options: FrameHostOptions): FrameHost {
  let frame: FrameLike | null = null;

  const stop = (options.listen ?? windowListen)((event) => {
    const target = frame?.contentWindow;
    if (!target) return;
    if (event.source !== target) return;
    if (event.origin !== options.playOrigin) return;
    const message = parseFrameMessage(event.data);
    if (message) options.onMessage(message);
  });

  const post = (message: { v: 1; type: 'theme'; theme: Theme } | { v: 1; type: 'mute'; muted: boolean } | { v: 1; type: 'reset' }) => {
    try {
      frame?.contentWindow?.postMessage(message, options.playOrigin);
    } catch {
      // A frame that is gone or hung cannot be messaged. Exit is the hard stop.
    }
  };

  return {
    attach(next) {
      frame = next;
    },
    detach() {
      frame = null;
    },
    sendTheme: (theme) => post({ v: PROTOCOL_VERSION, type: 'theme', theme }),
    sendMute: (muted) => post({ v: PROTOCOL_VERSION, type: 'mute', muted: muted === true }),
    sendReset: () => post({ v: PROTOCOL_VERSION, type: 'reset' }),
    dispose() {
      frame = null;
      stop();
    },
  };
}
