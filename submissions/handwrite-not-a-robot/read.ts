// A deliberately lenient "does this blob look like the phrase" reader.
// Both the handwriting and typeset candidates become column profiles
// (where the ink starts, ends and sits in each column), compared with DTW.

import { bbox, type Stroke } from './judge.ts';

const H = 24;
const N = 96;
const BAND = 22;

type Col = { ink: boolean; top: number; bot: number; z: [number, number, number] };
type Profile = { cols: Col[]; aspect: number };

const TARGETS = ["I'm not a robot", "i'm not a robot", 'Im not a robot', "I'M NOT A ROBOT", 'I am not a robot'];
const DECOYS: [text: string, said: string][] = [
  ["I'm a robot", "I'm a robot"],
  ['beep boop', 'beep boop'],
  ['hello', 'hello'],
  ['mmmmmmmmmm', 'mmmmmmmmmm'],
  ['llllllll', 'llllllll'],
  ['wwwwwww', 'wwwwwww'],
  ['asdfghjkl', 'asdfghjkl'],
  ['o o o o o', 'o o o o o'],
];
const FONTS = ['sans-serif', 'serif', 'cursive', '"Comic Sans MS", cursive', '"Bradley Hand", "Segoe Print", cursive', 'monospace'];

function columns(grid: Uint8Array, w: number): Col[] {
  const cols: Col[] = [];
  for (let k = 0; k < N; k++) {
    const from = Math.min(w - 1, Math.floor((k * w) / N));
    const to = Math.max(from + 1, Math.floor(((k + 1) * w) / N));
    const rows = new Array<boolean>(H).fill(false);
    for (let x = from; x < to; x++) for (let y = 0; y < H; y++) if (grid[y * w + x]) rows[y] = true;
    const top = rows.indexOf(true);
    if (top < 0) { cols.push({ ink: false, top: 0, bot: 0, z: [0, 0, 0] }); continue; }
    const bot = rows.lastIndexOf(true);
    const z: [number, number, number] = [0, 0, 0];
    rows.forEach((on, y) => { if (on) z[Math.min(2, Math.floor((y * 3) / H))] += 3 / H; });
    cols.push({ ink: true, top: top / (H - 1), bot: bot / (H - 1), z });
  }
  return cols;
}

function gridFrom(ctx: CanvasRenderingContext2D, w: number): Uint8Array {
  const data = ctx.getImageData(0, 0, w, H).data;
  const grid = new Uint8Array(w * H);
  for (let i = 0; i < grid.length; i++) grid[i] = data[i * 4 + 3] > 70 ? 1 : 0;
  return grid;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c.getContext('2d', { willReadFrequently: true })!;
}

function typeset(text: string, font: string): Profile {
  const big = canvas(1400, 200);
  big.font = `96px ${font}`;
  big.fillStyle = '#000';
  big.fillText(text, 20, 140);
  const d = big.getImageData(0, 0, 1400, 200).data;
  let x0 = 1400, y0 = 200, x1 = 0, y1 = 0;
  for (let y = 0; y < 200; y++) for (let x = 0; x < 1400; x++) if (d[(y * 1400 + x) * 4 + 3] > 70) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const w = Math.max(8, Math.round((bw / bh) * H));
  const small = canvas(w, H);
  small.drawImage(big.canvas, x0, y0, bw, bh, 0, 0, w, H);
  return { cols: columns(gridFrom(small, w), w), aspect: bw / bh };
}

function handwriting(strokes: Stroke[]): Profile {
  const b = bbox(strokes);
  const scale = (H - 2) / Math.max(b.h, b.w / 40, 1);
  const w = Math.max(8, Math.round(b.w * scale) + 2);
  const ctx = canvas(w, H);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';
  for (const s of strokes) {
    ctx.beginPath();
    s.forEach((p, i) => {
      const x = (p.x - b.x0) * scale + 1, y = (p.y - b.y0) * scale + 1;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    if (s.length === 1) ctx.lineTo((s[0].x - b.x0) * scale + 1.5, (s[0].y - b.y0) * scale + 1);
    ctx.stroke();
  }
  return { cols: columns(gridFrom(ctx, w), w), aspect: b.w / Math.max(b.h, 1) };
}

function colCost(a: Col, b: Col): number {
  if (a.ink !== b.ink) return 1;
  if (!a.ink) return 0;
  return 0.6 * (Math.abs(a.top - b.top) + Math.abs(a.bot - b.bot))
    + 0.25 * (Math.abs(a.z[0] - b.z[0]) + Math.abs(a.z[1] - b.z[1]) + Math.abs(a.z[2] - b.z[2]));
}

/** Column-profile DTW plus a penalty for being the wrong length for the text. */
function distance(p: Profile, q: Profile): number {
  return dtw(p.cols, q.cols) + Math.min(0.2, 0.12 * Math.abs(Math.log(p.aspect / q.aspect)));
}

function dtw(a: Col[], b: Col[]): number {
  const cost = new Float64Array((N + 1) * (N + 1)).fill(Infinity);
  const steps = new Float64Array((N + 1) * (N + 1));
  cost[0] = 0;
  for (let i = 1; i <= N; i++) {
    for (let j = Math.max(1, i - BAND); j <= Math.min(N, i + BAND); j++) {
      const opts = [(i - 1) * (N + 1) + j - 1, (i - 1) * (N + 1) + j, i * (N + 1) + j - 1];
      let best = opts[0];
      for (const o of opts) if (cost[o] < cost[best]) best = o;
      cost[i * (N + 1) + j] = cost[best] + colCost(a[i - 1], b[j - 1]);
      steps[i * (N + 1) + j] = steps[best] + 1;
    }
  }
  return cost[N * (N + 1) + N] / steps[N * (N + 1) + N];
}

let library: { profile: Profile; target: boolean; said: string }[] | undefined;
function getLibrary() {
  library ??= FONTS.flatMap((font) => [
    ...TARGETS.map((t) => ({ profile: typeset(t, font), target: true, said: "I'm not a robot" })),
    ...DECOYS.map(([t, said]) => ({ profile: typeset(t, font), target: false, said })),
  ]);
  return library;
}

/** Warm the template cache so the first verdict isn't slow. */
export function prepareReader() { getLibrary(); }

export interface Reading { said: string; legible: boolean; resemblance: number; distance: number }

/** Where 0 resembles a typeset target perfectly and ~0.5 is pure noise. */
const PASS_DISTANCE = 0.36;
const ZERO_DISTANCE = 0.5;
// Near ties go to the requested phrase; this is resemblance, not transcription.
const TARGET_TOLERANCE = 0.04;

export function readHandwriting(strokes: Stroke[]): Reading {
  const mine = handwriting(strokes);
  let bestTarget = Infinity, bestDecoy = Infinity, decoySaid = '';
  for (const t of getLibrary()) {
    const d = distance(mine, t.profile);
    if (t.target) bestTarget = Math.min(bestTarget, d);
    else if (d < bestDecoy) { bestDecoy = d; decoySaid = t.said; }
  }
  const wins = bestTarget <= bestDecoy + TARGET_TOLERANCE;
  return {
    said: wins ? "I'm not a robot" : decoySaid,
    legible: wins && bestTarget <= PASS_DISTANCE,
    resemblance: Math.max(0, Math.min(1, 1 - bestTarget / ZERO_DISTANCE)),
    distance: bestTarget,
  };
}
