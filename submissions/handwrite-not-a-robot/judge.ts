// Stroke forensics. Pure functions over recorded pointer samples.

export interface Pt { x: number; y: number; t: number }
export type Stroke = Pt[];

export interface Check {
  label: string;
  pass: boolean;
  critical: boolean;
  detail: string;
}

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const std = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const cv = (a: number[]) => std(a) / Math.max(1e-9, mean(a));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const fixed = (v: number, d = 2) => v.toFixed(d);

export function bbox(strokes: Stroke[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) for (const p of s) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/** Spatially resample a stroke every `step` px, interpolating timestamps. */
function resample(stroke: Stroke, step: number): Pt[] {
  const out: Pt[] = [stroke[0]];
  let carry = 0;
  for (let i = 1; i < stroke.length; i++) {
    const a = stroke[i - 1], b = stroke[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = step - carry;
    while (d <= len) {
      const k = d / len;
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, t: a.t + (b.t - a.t) * k });
      d += step;
    }
    carry = len - (d - step);
  }
  return out;
}

function smooth(a: number[], r: number): number[] {
  return a.map((_, i) => mean(a.slice(Math.max(0, i - r), i + r + 1)));
}

interface Kinematics { speeds: number[]; logV: number[]; logR: number[] }

/** Speed (letter heights per second) and radius of curvature along every stroke. */
function kinematics(strokes: Stroke[], h: number): Kinematics {
  const step = h / 20;
  const speeds: number[] = [], logV: number[] = [], logR: number[] = [];
  for (const stroke of strokes) {
    const raw = resample(stroke, step);
    if (raw.length < 9) continue;
    // Smooth positions so sensor jitter doesn't read as curvature.
    const xs = smooth(raw.map((p) => p.x), 2), ys = smooth(raw.map((p) => p.y), 2);
    const r = raw.map((p, i) => ({ x: xs[i], y: ys[i], t: p.t }));
    const v: number[] = [];
    for (let i = 1; i < r.length - 1; i++) {
      const dt = raw[i + 1].t - raw[i - 1].t;
      v.push(dt > 0 ? (2 * step) / dt / h * 1000 : NaN);
    }
    const finite = v.filter(Number.isFinite);
    if (finite.length < 5) continue;
    const vs = smooth(v.map((x) => (Number.isFinite(x) ? x : Math.max(...finite))), 2);
    speeds.push(...vs);
    const lv: number[] = [], lr: number[] = [];
    const k = 3;
    for (let i = k; i < r.length - k; i++) {
      const ax = r[i].x - r[i - k].x, ay = r[i].y - r[i - k].y;
      const bx = r[i + k].x - r[i].x, by = r[i + k].y - r[i].y;
      const angle = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
      const speed = vs[i - 1];
      if (angle < 0.04 || !(speed > 0)) continue;
      lv.push(Math.log(speed));
      lr.push(Math.log((k * step) / angle / h));
    }
    if (lv.length < 4) continue;
    // Demean per stroke so each stroke's own speed gain doesn't masquerade as a slope.
    const mv = mean(lv), mr = mean(lr);
    logV.push(...lv.map((x) => x - mv));
    logR.push(...lr.map((x) => x - mr));
  }
  return { speeds, logV, logR };
}

function regress(x: number[], y: number[]) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2;
  }
  return { slope: sxy / Math.max(1e-9, sxx), r: sxy / Math.max(1e-9, Math.sqrt(sxx * syy)) };
}

/** Share of raw samples where the pen's turning direction flips: the hand's own noise. */
function tremor(strokes: Stroke[], h: number): number {
  let flips = 0, total = 0;
  const minSeg = h / 200;
  for (const s of strokes) {
    const pts = s.filter((p, i) => i === 0 || Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) > minSeg);
    let prev = 0;
    for (let i = 2; i < pts.length; i++) {
      const c = (pts[i - 1].x - pts[i - 2].x) * (pts[i].y - pts[i - 1].y) - (pts[i - 1].y - pts[i - 2].y) * (pts[i].x - pts[i - 1].x);
      const sign = Math.sign(c);
      if (sign === 0) continue;
      if (prev !== 0) { total++; if (sign !== prev) flips++; }
      prev = sign;
    }
  }
  return total ? flips / total : 0;
}

/** Longest run that is ruler-straight and drawn at constant speed, in letter heights. */
function rulerRun(strokes: Stroke[], h: number): number {
  let best = 0;
  const tol = h * 0.02;
  for (const s of strokes) {
    for (let i = 0; i < s.length - 7; i++) {
      let j = i + 2;
      let lastGood = -1;
      for (; j < s.length; j++) {
        const a = s[i], b = s[j];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len === 0) continue;
        let ok = true;
        for (let k = i + 1; k < j && ok; k++) {
          const d = Math.abs((b.x - a.x) * (a.y - s[k].y) - (a.x - s[k].x) * (b.y - a.y)) / len;
          ok = d <= tol;
        }
        if (!ok) break;
        lastGood = j;
      }
      if (lastGood < i + 7) continue;
      const run = s.slice(i, lastGood + 1);
      const v: number[] = [];
      for (let k = 1; k < run.length; k++) {
        const dt = run[k].t - run[k - 1].t;
        if (dt > 0) v.push(Math.hypot(run[k].x - run[k - 1].x, run[k].y - run[k - 1].y) / dt);
      }
      const len = Math.hypot(run.at(-1)!.x - run[0].x, run.at(-1)!.y - run[0].y) / h;
      if (v.length >= 6 && cv(v) < 0.12) best = Math.max(best, len);
      i = lastGood - 1;
    }
  }
  return best;
}

export function judgeStrokes(strokes: Stroke[], untrusted: number): Check[] {
  const all = strokes.flat();
  const { h: rawH, w } = bbox(strokes);
  const h = Math.max(rawH, w / 12, 4);
  const duration = all.at(-1)!.t - all[0].t;
  const kin = kinematics(strokes, h);
  const checks: Check[] = [];

  checks.push(untrusted === 0
    ? { label: 'Real input device', pass: true, critical: true, detail: 'Every stroke came from actual hardware.' }
    : { label: 'Real input device', pass: false, critical: true, detail: `${untrusted} of your pen events were synthesized by a script. Nice try, toaster.` });

  const secs = duration / 1000;
  checks.push(secs < 1.5
    ? { label: 'Writing time', pass: false, critical: true, detail: `Took ${fixed(secs, 1)} s. Fifteen characters in that time is not a wrist, it's a printer.` }
    : secs > 120
      ? { label: 'Writing time', pass: false, critical: true, detail: `Took ${Math.round(secs)} s. Either you're carving it in stone or something is replaying a recording very slowly.` }
      : { label: 'Writing time', pass: true, critical: true, detail: `Took ${fixed(secs, 1)} s. A plausible amount of effort.` });

  const speedCv = kin.speeds.length > 10 ? cv(kin.speeds) : 0;
  checks.push(speedCv >= 0.3
    ? { label: 'Speed fluctuation', pass: true, critical: true, detail: `Your pen speed swung ±${pct(speedCv)} while writing. Messy. Human.` }
    : { label: 'Speed fluctuation', pass: false, critical: true, detail: `Speed varied only ±${pct(speedCv)}. You write like a conveyor belt.` });

  const { slope, r } = kin.logV.length >= 30 ? regress(kin.logR, kin.logV) : { slope: 0, r: 0 };
  checks.push(kin.logV.length < 30
    ? { label: 'Two-thirds power law', pass: false, critical: true, detail: 'Not enough curves to measure. Letters have curves. Write letters.' }
    : slope < 0.1 || r < 0.15
      ? { label: 'Two-thirds power law', pass: false, critical: true, detail: `You didn't slow down in the curves (β = ${fixed(slope)}, humans ≈ 0.33). Machines don't know this law exists.` }
      : slope > 0.85
        ? { label: 'Two-thirds power law', pass: false, critical: true, detail: `β = ${fixed(slope)}. You nearly stopped dead at every bend. Overacting.` }
        : { label: 'Two-thirds power law', pass: true, critical: true, detail: `You slowed into curves like a primate should (β = ${fixed(slope)}, humans ≈ 0.33).` });

  const gaps: number[] = [];
  for (let i = 1; i < strokes.length; i++) gaps.push(strokes[i][0].t - strokes[i - 1].at(-1)!.t);
  const gapCv = gaps.length >= 3 ? cv(gaps) : 1;
  checks.push(strokes.length < 2
    ? { label: 'Pen lifts', pass: false, critical: false, detail: 'One unbroken stroke, no apostrophe lift, no t-cross. Plotter behaviour.' }
    : gapCv < 0.15
      ? { label: 'Pen lifts', pass: false, critical: false, detail: `Your pen lifted ${gaps.length} times at metronome intervals (±${pct(gapCv)}).` }
      : { label: 'Pen lifts', pass: true, critical: false, detail: `${strokes.length} strokes with irregular pauses between them.` });

  const shake = tremor(strokes, h);
  checks.push(shake >= 0.06
    ? { label: 'Micro-tremor', pass: true, critical: false, detail: `Your line wobbles in ${pct(shake)} of samples. Your hand shakes, as hands do.` }
    : { label: 'Micro-tremor', pass: false, critical: false, detail: `Wobble in only ${pct(shake)} of samples. That line was smoothed by something with no pulse.` });

  const ruler = rulerRun(strokes, h);
  checks.push(ruler >= 1.2
    ? { label: 'Ruler lines', pass: false, critical: false, detail: `A line ran ${fixed(ruler, 1)} letter-heights dead straight at constant speed.` }
    : { label: 'Ruler lines', pass: true, critical: false, detail: 'No suspiciously perfect lines.' });

  return checks;
}

export function isHuman(checks: Check[]): boolean {
  return checks.every((c) => c.pass || !c.critical) && checks.filter((c) => !c.pass).length <= 1;
}
