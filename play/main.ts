import type { CaptchaContext, CaptchaModule, CaptchaState, Capability, MountFn, Theme } from '../sdk/index.d.ts';
import { captureMessage, openStream, stopStream, type CaptureKind } from './media.ts';
import {
  CAPABILITIES,
  CAPTCHA_STATES,
  PROTOCOL_VERSION,
  clampHeight,
  parseParentMessage,
  parseTheme,
  type FrameMessage,
} from './protocol.ts';

interface RuntimeConfig {
  entry: string;
  capabilities: Capability[];
  layout: { minHeight?: number; maxHeight?: number; fullBleed?: boolean };
}

/** State owned by one mount attempt. Reset throws it away and starts a new one. */
interface Attempt {
  abort: AbortController;
  cleanup?: () => void;
  done: boolean;
  solved: boolean;
  streams: Set<MediaStream>;
  themeListeners: Set<(theme: Theme) => void>;
  muteListeners: Set<(muted: boolean) => void>;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.append(...children);
  return el;
}

function readConfig(): RuntimeConfig {
  const raw = JSON.parse(document.getElementById('cx-config')?.textContent ?? '{}');
  return {
    entry: typeof raw.entry === 'string' ? raw.entry : './entry.js',
    capabilities: Array.isArray(raw.capabilities)
      ? raw.capabilities.filter((c: unknown): c is Capability => CAPABILITIES.includes(c as Capability))
      : [],
    layout: typeof raw.layout === 'object' && raw.layout !== null ? raw.layout : {},
  };
}

const config = readConfig();
const { maxHeight, fullBleed } = config.layout;

let theme: Theme =
  parseTheme(new URLSearchParams(location.search).get('theme')) ??
  (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
let muted = false;
let attempt: Attempt | undefined;
let loadedMount: MountFn | undefined;
/** Rejections the runtime already explained to the visitor. Not shown a second time as crashes. */
const reported = new WeakSet<object>();

// --- shell ---------------------------------------------------------------

const continueButton = h('button', { class: 'cx-btn cx-primary', type: 'button', disabled: '' }, 'Continue');
const stage = h('div', { class: 'cx-stage' });
const noticeTitle = h('strong');
const noticeText = h('p');
const notice = h(
  'div',
  { class: 'cx-notice', role: 'alert', hidden: '' },
  noticeTitle,
  noticeText,
  h('button', { class: 'cx-btn', type: 'button', 'data-action': 'reset' }, 'Reset'),
);
const shell = h(
  'main',
  { class: 'cx-shell', 'data-view': 'playing' },
  h(
    'section',
    { class: 'cx-challenge' },
    h('header', { class: 'cx-head' }, h('h1', {}, 'Verify you are human'), h('p', {}, 'Complete the challenge below to continue.')),
    stage,
    notice,
    h('div', { class: 'cx-actions' }, continueButton),
  ),
  h(
    'section',
    { class: 'cx-success' },
    h('h2', {}, 'Verified'),
    h('p', {}, 'You completed the challenge.'),
    h('button', { class: 'cx-btn', type: 'button', 'data-action': 'reset' }, 'Reset'),
  ),
);
document.getElementById('app')?.replaceChildren(shell);
if (fullBleed) stage.dataset.fullBleed = '';

function applyTheme(): void {
  document.documentElement.dataset.theme = theme;
}

function setView(view: 'playing' | 'success' | 'error'): void {
  shell.dataset.view = view;
}

function showNotice(kind: 'error' | 'capability', title: string, text: string): void {
  notice.dataset.kind = kind;
  noticeTitle.textContent = title;
  noticeText.textContent = text;
  notice.hidden = false;
}

function post(message: FrameMessage): void {
  // The parent origin is unknown to the frame and no message carries anything private.
  if (window.parent !== window) window.parent.postMessage({ v: PROTOCOL_VERSION, ...message }, '*');
}

// --- attempt lifecycle ---------------------------------------------------

function teardown(a: Attempt | undefined): void {
  if (!a || a.done) return;
  a.done = true;
  a.abort.abort();
  try {
    a.cleanup?.();
  } catch (error) {
    console.error('[captchastrophe] cleanup threw', error);
  }
  for (const stream of a.streams) stopStream(stream);
  a.streams.clear();
  a.themeListeners.clear();
  a.muteListeners.clear();
}

function describe(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 300) || 'Unknown error';
}

/** Stop the current attempt and say so out loud. Never leaves a blank frame. */
function fail(title: string, error: unknown): void {
  console.error('[captchastrophe]', title, error);
  if (!attempt || attempt.done) return;
  teardown(attempt);
  stage.replaceChildren();
  showNotice('error', title, describe(error));
  setView('error');
}

function notify<T>(listeners: Set<(value: T) => void>, value: T): void {
  for (const listener of [...listeners]) {
    try {
      listener(value);
    } catch (error) {
      fail('This challenge stopped working', error);
    }
  }
}

async function capture(a: Attempt, kind: CaptureKind): Promise<MediaStream> {
  try {
    if (a.done) throw Object.assign(new Error('Attempt ended'), { name: 'AbortError' });
    const stream = await openStream(kind, navigator.mediaDevices);
    if (a.done) {
      stopStream(stream);
      throw Object.assign(new Error('Attempt ended'), { name: 'AbortError' });
    }
    a.streams.add(stream);
    return stream;
  } catch (error) {
    if (typeof error === 'object' && error !== null) reported.add(error);
    const reason = error instanceof Error ? error.name : '';
    if (!a.done && (reason === 'denied' || reason === 'unsupported' || reason === 'unavailable')) {
      post({ type: 'capability-denied', capability: kind, reason });
      showNotice('capability', 'This challenge needs your ' + kind, captureMessage(kind, reason));
    }
    throw error;
  }
}

function makeContext(a: Attempt, el: HTMLElement): CaptchaContext {
  const subscribe = <T>(set: Set<(value: T) => void>, callback: (value: T) => void) => {
    if (!a.done) set.add(callback);
    return () => void set.delete(callback);
  };
  const ctx: CaptchaContext = {
    get theme() {
      return theme;
    },
    get muted() {
      return muted;
    },
    capabilities: Object.freeze([...config.capabilities]),
    signal: a.abort.signal,
    onThemeChange: (callback) => subscribe(a.themeListeners, callback),
    onMuteChange: (callback) => subscribe(a.muteListeners, callback),
    setState(state: CaptchaState) {
      if (!a.done && CAPTCHA_STATES.includes(state)) post({ type: 'state', state });
    },
    succeed() {
      if (a.done || a.solved) return;
      a.solved = true;
      continueButton.disabled = false;
      post({ type: 'state', state: 'solved' });
    },
    requestLayout(layout) {
      const minHeight = clampHeight(layout?.minHeight, maxHeight);
      if (a.done || minHeight === undefined) return;
      el.style.minHeight = `${minHeight}px`;
      post({ type: 'layout', minHeight });
    },
  };
  if (config.capabilities.includes('camera')) ctx.requestCamera = () => capture(a, 'camera');
  if (config.capabilities.includes('microphone')) ctx.requestMicrophone = () => capture(a, 'microphone');
  return ctx;
}

async function loadMount(): Promise<MountFn> {
  if (loadedMount) return loadedMount;
  const mod: CaptchaModule = await import(/* @vite-ignore */ new URL(config.entry, location.href).href);
  const mount = typeof mod.default === 'function' ? mod.default : mod.mount;
  if (typeof mount !== 'function') {
    throw new Error('The entry module must default-export a function or export a function named "mount".');
  }
  return (loadedMount = mount);
}

async function start(): Promise<void> {
  const mine: Attempt = {
    abort: new AbortController(),
    done: false,
    solved: false,
    streams: new Set(),
    themeListeners: new Set(),
    muteListeners: new Set(),
  };
  attempt = mine;
  notice.hidden = true;
  continueButton.disabled = true;
  setView('playing');

  const el = h('div', { class: 'cx-mount' });
  const minHeight = clampHeight(config.layout.minHeight, maxHeight);
  if (minHeight !== undefined) el.style.minHeight = `${minHeight}px`;
  if (maxHeight !== undefined) el.style.maxHeight = `${clampHeight(maxHeight)}px`;
  stage.replaceChildren(el);
  post({ type: 'state', state: 'idle' });
  if (minHeight !== undefined) post({ type: 'layout', minHeight });

  let mount: MountFn;
  try {
    mount = await loadMount();
  } catch (error) {
    if (!mine.done) fail("This challenge couldn't load", error);
    return;
  }
  if (mine.done) return;
  try {
    const cleanup = await mount(el, makeContext(mine, el));
    if (typeof cleanup !== 'function') return;
    if (mine.done) cleanup();
    else mine.cleanup = cleanup;
  } catch (error) {
    if (!mine.done) fail('This challenge stopped working', error);
  }
}

function reset(): void {
  teardown(attempt);
  void start();
}

// --- wiring --------------------------------------------------------------

continueButton.addEventListener('click', () => {
  if (!attempt?.solved || attempt.done) return;
  teardown(attempt);
  stage.replaceChildren();
  setView('success');
  post({ type: 'success' });
});

shell.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-action="reset"]')) reset();
});

addEventListener('message', (event) => {
  if (window.parent === window || event.source !== window.parent) return;
  const message = parseParentMessage(event.data);
  if (!message) return;
  if (message.type === 'theme') {
    theme = message.theme;
    applyTheme();
    if (attempt) notify(attempt.themeListeners, theme);
  } else if (message.type === 'mute') {
    if (message.muted === muted) return;
    muted = message.muted;
    if (attempt) notify(attempt.muteListeners, muted);
  } else {
    reset();
  }
});

addEventListener('error', (event) => {
  if (/ResizeObserver loop/.test(event.message)) return;
  fail('This challenge stopped working', event.error ?? event.message);
});

addEventListener('unhandledrejection', (event) => {
  if (typeof event.reason === 'object' && event.reason !== null && reported.has(event.reason)) return;
  fail('This challenge stopped working', event.reason);
});

addEventListener('pagehide', () => teardown(attempt));

applyTheme();
post({ type: 'ready' });
void start();
