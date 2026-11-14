import type { CaptureErrorName } from '../sdk/index.d.ts';

export type CaptureKind = 'camera' | 'microphone';

const CONSTRAINTS: Record<CaptureKind, MediaStreamConstraints> = {
  camera: { video: true },
  microphone: { audio: true },
};

export function captureErrorName(error: unknown): CaptureErrorName {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'TypeError' || name === 'NotSupportedError') return 'unsupported';
  return 'unavailable';
}

/** Open a stream. Rejects with an Error whose `name` is a CaptureErrorName. */
export async function openStream(
  kind: CaptureKind,
  devices: Pick<MediaDevices, 'getUserMedia'> | undefined,
): Promise<MediaStream> {
  try {
    if (!devices?.getUserMedia) throw new TypeError('getUserMedia is not available');
    return await devices.getUserMedia(CONSTRAINTS[kind]);
  } catch (cause) {
    const name = captureErrorName(cause);
    throw Object.assign(new Error(`${kind} ${name}`, { cause }), { name });
  }
}

export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

/** Plain-language explanation shown to the visitor. */
export function captureMessage(kind: CaptureKind, name: CaptureErrorName): string {
  switch (name) {
    case 'denied':
      return `Access to the ${kind} was blocked, and this challenge can't continue without it. Allow it in your browser's site settings, then reset.`;
    case 'unsupported':
      return `This browser or page can't use the ${kind}, so this challenge can't run here.`;
    case 'unavailable':
      return `No usable ${kind} was found, or another app is using it. Check your device, then reset.`;
  }
}
