/**
 * Public types for a captchastrophe submission.
 *
 * A submission's entry module default-exports a {@link MountFn} (or exports it
 * as a named `mount`). The play runtime calls it once per attempt.
 */

/** A browser capability a submission may declare in `manifest.json`. */
export type Capability = 'camera' | 'microphone' | 'motion' | 'fullscreen' | 'audio';

export type Theme = 'light' | 'dark';

/** Informational state reported to the gallery. Only `succeed()` enables Continue. */
export type CaptchaState = 'idle' | 'active' | 'solved';

/** Error `name` values produced by `requestCamera()` / `requestMicrophone()`. */
export type CaptureErrorName = 'denied' | 'unsupported' | 'unavailable';

export interface CaptchaContext {
  /** Current theme. Read it again after `onThemeChange` fires. */
  readonly theme: Theme;
  /** The capabilities declared in the manifest. Nothing else is available. */
  readonly capabilities: readonly Capability[];
  /** Aborts on reset and exit. Pass it to `addEventListener`, `fetch`, timers, etc. */
  readonly signal: AbortSignal;
  /** Cooperative mute. Honour it for any audio you make. Exit is the hard stop. */
  readonly muted: boolean;
  /** Subscribe to theme changes. Returns an unsubscribe function. */
  onThemeChange(callback: (theme: Theme) => void): () => void;
  /** Subscribe to mute changes. Returns an unsubscribe function. */
  onMuteChange(callback: (muted: boolean) => void): () => void;
  /** Tell the gallery roughly where the visitor is. Does not enable Continue. */
  setState(state: CaptchaState): void;
  /** The visitor passed. Enables the Continue button. Calling it again is a no-op. */
  succeed(): void;
  /** Ask for a taller mount area. Clamped to 160-900 px by the runtime. */
  requestLayout(layout: { minHeight?: number }): void;
  /**
   * Only present if `camera` is declared. Resolves with a stream the runtime
   * stops on reset/exit. Rejects with an error whose `name` is a {@link CaptureErrorName}.
   */
  requestCamera?(): Promise<MediaStream>;
  /** Same as `requestCamera`, for `microphone`. */
  requestMicrophone?(): Promise<MediaStream>;
}

/** Return a cleanup function to release anything the signal does not cover. */
export type MountFn = (
  el: HTMLElement,
  ctx: CaptchaContext,
) => void | (() => void) | Promise<void | (() => void)>;

/** Shape of a submission's entry module. Export `default` or `mount`. */
export interface CaptchaModule {
  default?: MountFn;
  mount?: MountFn;
}
