import { isHuman, judgeStrokes, type Stroke } from './judge.ts';
import { prepareReader, readHandwriting } from './read.ts';

const CSS = `
.hw { display: flex; flex-direction: column; gap: 10px; padding: 14px; font: 14px/1.45 system-ui, sans-serif; color: var(--ink); }
.hw-prompt { margin: 0; }
.hw-prompt b { font-family: "Bradley Hand", "Segoe Print", cursive; font-size: 1.15em; }
.hw-paper { position: relative; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: var(--hw-paper); }
.hw-paper canvas { display: block; width: 100%; touch-action: none; cursor: crosshair; }
.hw-seis { display: flex; align-items: center; gap: 8px; font: 11px/1 ui-monospace, monospace; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
.hw-seis canvas { flex: 1; height: 28px; min-width: 0; }
.hw-row { display: flex; gap: 8px; flex-wrap: wrap; }
.hw button { font: inherit; padding: 8px 14px; border-radius: 6px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
.hw button.hw-go { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.hw button:disabled { opacity: .45; cursor: not-allowed; }
.hw-report { display: flex; flex-direction: column; gap: 8px; }
.hw-report h3 { margin: 0; font-size: .95rem; }
.hw-read { margin: 0; }
.hw-read q { font-family: "Bradley Hand", "Segoe Print", cursive; font-size: 1.2em; }
.hw-checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.hw-checks li { display: grid; grid-template-columns: 20px 1fr; gap: 6px; opacity: 0; transform: translateY(3px); transition: opacity .2s, transform .2s; }
.hw-checks li.on { opacity: 1; transform: none; }
.hw-checks .mark { font-weight: 700; }
.hw-checks .ok { color: var(--hw-ok); }
.hw-checks .no { color: var(--hw-no); }
.hw-checks small { display: block; color: var(--muted); }
.hw-verdict { margin: 0; font-weight: 600; }
.hw-legend { font: 11px/1 ui-monospace, monospace; color: var(--muted); }
`;

const palette = (theme: string) => theme === 'dark'
  ? { paper: '#1b1d22', rule: '#2c3a4d', margin: '#5a2d33', ink: '#d9e3ff', ok: '#7fd18b', no: '#ff8a7a' }
  : { paper: '#fdfcf7', rule: '#c9dcf0', margin: '#f0b9b9', ink: '#1b2a6b', ok: '#2f7d3b', no: '#b3261e' };

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, ...kids: (Node | string)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) el.setAttribute(k, v);
  el.append(...kids);
  return el;
}

interface Ctx {
  readonly theme: 'light' | 'dark';
  readonly signal: AbortSignal;
  onThemeChange(cb: (theme: 'light' | 'dark') => void): () => void;
  setState(state: 'idle' | 'active' | 'solved'): void;
  succeed(): void;
  requestLayout(layout: { minHeight?: number }): void;
}

export default function mount(root: HTMLElement, ctx: Ctx) {
  const { signal } = ctx;
  const on = <E extends Event>(t: EventTarget, type: string, fn: (e: E) => void) =>
    t.addEventListener(type, fn as EventListener, { signal });
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  let raf = 0;

  const style = h('style', {}, CSS);
  const paperCanvas = h('canvas', { 'aria-label': 'Writing area. Write I\u2019m not a robot here.', role: 'img' });
  const paper = h('div', { class: 'hw-paper' }, paperCanvas);
  const seisCanvas = h('canvas', { 'aria-hidden': 'true' });
  const seis = h('div', { class: 'hw-seis' }, h('span', {}, 'pen velocity'), seisCanvas);
  const clear = h('button', { type: 'button' }, 'Clear');
  const submit = h('button', { type: 'button', class: 'hw-go', disabled: '' }, 'Submit handwriting');
  const controls = h('div', { class: 'hw-row' }, clear, submit);
  const report = h('section', { class: 'hw-report', hidden: '', 'aria-live': 'polite' });
  const writer = h('div', {}, h('p', { class: 'hw-prompt' }, 'Handwrite ', h('b', {}, 'I\u2019m not a robot'), ' below. Neatness optional. Being a person is not.'), paper, seis, controls);
  const wrap = h('div', { class: 'hw' }, style, writer, report);
  writer.style.cssText = 'display:flex;flex-direction:column;gap:10px';
  root.append(wrap);
  ctx.requestLayout({ minHeight: 520 });
  ctx.setState('idle');

  let colors = palette(ctx.theme);
  const applyTheme = () => {
    colors = palette(ctx.theme);
    wrap.style.setProperty('--hw-paper', colors.paper);
    wrap.style.setProperty('--hw-ok', colors.ok);
    wrap.style.setProperty('--hw-no', colors.no);
    redraw();
  };
  const unTheme = ctx.onThemeChange(applyTheme);

  let strokes: Stroke[] = [];
  let untrusted = 0;
  let active: Stroke | null = null;
  let activePointer: number | null = null;
  const pctx = paperCanvas.getContext('2d')!;
  let cssW = 0, cssH = 0;

  function drawRules() {
    pctx.fillStyle = colors.paper;
    pctx.fillRect(0, 0, cssW, cssH);
    pctx.strokeStyle = colors.rule;
    pctx.lineWidth = 1;
    const base = cssH * 0.72, mid = cssH * 0.47, top = cssH * 0.22;
    for (const [y, dash] of [[top, []], [mid, [4, 5]], [base, []]] as [number, number[]][]) {
      pctx.setLineDash(dash);
      pctx.beginPath(); pctx.moveTo(0, y); pctx.lineTo(cssW, y); pctx.stroke();
    }
    pctx.setLineDash([]);
    pctx.strokeStyle = colors.margin;
    pctx.beginPath(); pctx.moveTo(28, 0); pctx.lineTo(28, cssH); pctx.stroke();
  }

  function inkStroke(s: Stroke) {
    pctx.strokeStyle = colors.ink;
    pctx.lineWidth = 2.6;
    pctx.lineCap = 'round';
    pctx.lineJoin = 'round';
    pctx.beginPath();
    s.forEach((p, i) => (i ? pctx.lineTo(p.x, p.y) : pctx.moveTo(p.x, p.y)));
    if (s.length === 1) pctx.lineTo(s[0].x + 0.5, s[0].y);
    pctx.stroke();
  }

  function redraw() {
    drawRules();
    strokes.forEach(inkStroke);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = paper.clientWidth;
    if (!w) return;
    const newH = Math.round(Math.min(230, Math.max(140, w * 0.32)));
    if (w === cssW && newH === cssH) return;
    const sx = cssW ? w / cssW : 1;
    const sy = cssH ? newH / cssH : 1;
    for (const s of strokes) for (const p of s) { p.x *= sx; p.y *= sy; }
    lastPt = null;
    cssW = w; cssH = newH;
    paperCanvas.width = Math.round(w * dpr); paperCanvas.height = Math.round(newH * dpr);
    paperCanvas.style.height = `${newH}px`;
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seisCanvas.width = Math.round(seisCanvas.clientWidth * dpr); seisCanvas.height = Math.round(28 * dpr);
    redraw();
    drawSeis(performance.now());
  }
  const ro = new ResizeObserver(resize);
  ro.observe(paper);

  // Live "pen velocity" trace. Purely there so you know you're being watched.
  const trace: { t: number; v: number }[] = [];
  let lastPt: { x: number; y: number; t: number } | null = null;
  let ema = 0;
  const sctx = seisCanvas.getContext('2d')!;
  function drawSeis(now: number) {
    const dpr = window.devicePixelRatio || 1;
    const w = seisCanvas.width / dpr, hh = 28;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, w, hh);
    sctx.strokeStyle = colors.rule;
    sctx.beginPath(); sctx.moveTo(0, hh - 2); sctx.lineTo(w, hh - 2); sctx.stroke();
    sctx.strokeStyle = colors.ink;
    sctx.lineWidth = 1.5;
    sctx.beginPath();
    const span = 4000;
    const peak = Math.max(1.5, ...trace.map((s) => s.v));
    trace.forEach((s, i) => {
      const x = w - ((now - s.t) / span) * w;
      const y = hh - 2 - (s.v / peak) * (hh - 6);
      if (i) sctx.lineTo(x, y); else sctx.moveTo(x, y);
    });
    sctx.stroke();
  }
  function tick(now: number) {
    while (trace.length && now - trace[0].t > 4200) trace.shift();
    drawSeis(now);
    raf = trace.length || active ? requestAnimationFrame(tick) : 0;
  }
  function record(x: number, y: number, t: number) {
    if (lastPt && t > lastPt.t) {
      const v = Math.hypot(x - lastPt.x, y - lastPt.y) / (t - lastPt.t);
      ema = ema * 0.7 + v * 0.3;
      trace.push({ t: performance.now(), v: ema });
    }
    lastPt = { x, y, t };
    if (!raf) raf = requestAnimationFrame(tick);
  }

  const point = (e: PointerEvent) => {
    const r = paperCanvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp };
  };

  on<PointerEvent>(paperCanvas, 'pointerdown', (e) => {
    if (!report.hidden || active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    if (!e.isTrusted) untrusted++;
    try { paperCanvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer ids can't be captured */ }
    const p = point(e);
    active = [p];
    activePointer = e.pointerId;
    submit.disabled = true;
    strokes.push(active);
    lastPt = null;
    record(p.x, p.y, p.t);
    inkStroke(active);
    ctx.setState('active');
  });
  on<PointerEvent>(paperCanvas, 'pointermove', (e) => {
    if (!active || e.pointerId !== activePointer) return;
    if (!e.isTrusted) untrusted++;
    const events = typeof e.getCoalescedEvents === 'function' && e.isTrusted ? e.getCoalescedEvents() : [];
    for (const c of events.length ? events : [e]) {
      const p = point(c);
      const prev = active.at(-1)!;
      if (p.t < prev.t || (p.x === prev.x && p.y === prev.y)) continue;
      active.push(p);
      record(p.x, p.y, p.t);
    }
    inkStroke(active.slice(-events.length - 2));
  });
  const end = (e: PointerEvent) => {
    if (!active || e.pointerId !== activePointer) return;
    if (!e.isTrusted) untrusted++;
    active = null;
    activePointer = null;
    submit.disabled = strokes.flat().length < 20;
  };
  on(paperCanvas, 'pointerup', end);
  on(paperCanvas, 'pointercancel', end);
  on(paperCanvas, 'lostpointercapture', end);

  function reset() {
    strokes = []; untrusted = 0; active = null; activePointer = null;
    lastPt = null; ema = 0; trace.length = 0;
    cancelAnimationFrame(raf); raf = 0;
    drawSeis(performance.now());
    submit.disabled = true;
    report.hidden = true; report.replaceChildren();
    writer.hidden = false;
    redraw();
    ctx.setState('idle');
  }
  on(clear, 'click', reset);

  // The verdict: replay the evidence, colour-coded by speed, then reveal each test.
  on(submit, 'click', () => {
    if (active || !report.hidden || strokes.flat().length < 20) return;
    const evidence = strokes.map((s) => s.map((p) => ({ ...p })));
    const checks = judgeStrokes(evidence, untrusted);
    const reading = readHandwriting(evidence);
    const human = isHuman(checks);

    writer.hidden = true;
    report.hidden = false;
    const replay = h('canvas', { 'aria-hidden': 'true' });
    replay.style.cssText = `width:100%;height:${cssH}px;border:1px solid var(--line);border-radius:6px;display:block`;
    const legend = h('div', { class: 'hw-legend' }, 'replaying your evidence \u00b7 blue = slow, red = fast');
    const read = h('p', { class: 'hw-read' });
    const list = h('ul', { class: 'hw-checks' });
    const verdict = h('p', { class: 'hw-verdict' });
    const again = h('button', { type: 'button', hidden: '' }, 'Try again');
    on(again, 'click', reset);
    report.append(h('h3', {}, 'Handwriting forensics'), replay, legend, read, list, verdict, again);

    const rows: { pass: boolean; label: string; detail: string }[] = [
      {
        pass: reading.legible,
        label: 'Resemblance',
        detail: reading.said !== "I'm not a robot"
          ? reading.said === "I'm a robot"
            ? 'That reads as \u201cI\u2019m a robot.\u201d Thank you for your honesty.'
            : `Looks more like \u201c${reading.said}\u201d than the phrase.`
          : reading.legible
            ? `${Math.round(reading.resemblance * 100)}% match. Ugly, but legible enough.`
            : `${Math.round(reading.resemblance * 100)}% match. We squinted. It didn\u2019t help.`,
      },
      ...checks,
    ];
    read.append('We read: ', h('q', {}, reading.said));
    for (const r of rows) {
      list.append(h('li', {},
        h('span', { class: `mark ${r.pass ? 'ok' : 'no'}`, 'aria-label': r.pass ? 'passed' : 'failed' }, r.pass ? '\u2713' : '\u2717'),
        h('span', {}, r.label, h('small', {}, r.detail))));
    }

    const ok = human && reading.legible;
    const dpr = window.devicePixelRatio || 1;
    replay.width = Math.round(cssW * dpr); replay.height = Math.round(cssH * dpr);
    const rctx = replay.getContext('2d')!;
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rctx.fillStyle = colors.paper; rctx.fillRect(0, 0, cssW, cssH);
    rctx.lineCap = 'round'; rctx.lineWidth = 3;

    const segs: { a: { x: number; y: number }; b: { x: number; y: number }; t: number; v: number }[] = [];
    for (const s of evidence) for (let i = 1; i < s.length; i++) {
      const dt = Math.max(1, s[i].t - s[i - 1].t);
      segs.push({ a: s[i - 1], b: s[i], t: s[i].t, v: Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y) / dt });
    }
    const sorted = segs.map((s) => s.v).sort((a, b) => a - b);
    const vMax = sorted[Math.floor(sorted.length * 0.95)] || 1;
    const t0 = evidence[0][0].t, tEnd = evidence.at(-1)!.at(-1)!.t;
    const speedUp = Math.max(1, (tEnd - t0) / 2200);
    const start = performance.now();
    let drawn = 0;
    const play = (now: number) => {
      const until = t0 + (now - start) * speedUp;
      for (; drawn < segs.length && segs[drawn].t <= until; drawn++) {
        const s = segs[drawn];
        rctx.strokeStyle = `hsl(${Math.round(220 - Math.min(1, s.v / vMax) * 220)} 80% ${ctx.theme === 'dark' ? 62 : 46}%)`;
        rctx.beginPath(); rctx.moveTo(s.a.x, s.a.y); rctx.lineTo(s.b.x, s.b.y); rctx.stroke();
      }
      if (drawn < segs.length) { raf = requestAnimationFrame(play); return; }
      raf = 0;
      [...list.children].forEach((li, i) => later(() => li.classList.add('on'), 180 * i));
      later(() => {
        verdict.textContent = ok
          ? 'Verdict: human. Probably. You may continue.'
          : human
            ? 'Verdict: a human, but we couldn\u2019t read it. Write the actual phrase.'
            : 'Verdict: robot. Or a human impersonating one, which is worse.';
        if (ok) { ctx.setState('solved'); ctx.succeed(); } else again.hidden = false;
      }, 180 * rows.length + 200);
    };
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(play);
  });

  applyTheme();
  resize();
  // Typesetting the reference phrases takes a moment; do it before anyone submits.
  later(prepareReader, 50);

  return () => {
    unTheme();
    ro.disconnect();
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    wrap.remove();
  };
}
