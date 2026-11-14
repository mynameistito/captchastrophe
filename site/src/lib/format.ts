const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function parseTime(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** "3 days ago". Falls back to a plain dash for dates we cannot read. */
export function formatAdded(iso: string, now = Date.now()): string {
  const t = parseTime(iso);
  if (!t) return '—';
  const seconds = Math.round((t - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour');
  const days = Math.round(seconds / 86_400);
  if (Math.abs(days) < 14) return rtf.format(days, 'day');
  if (Math.abs(days) < 60) return rtf.format(Math.round(days / 7), 'week');
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), 'month');
  return rtf.format(Math.round(days / 365), 'year');
}

export function formatDate(iso: string): string {
  const t = parseTime(iso);
  if (!t) return iso;
  return new Date(t).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatPercent(up: number, down: number): string | null {
  const total = up + down;
  return total > 0 ? `${Math.round((100 * up) / total)}%` : null;
}

/** "12 seconds" / "2 minutes" for retry hints. */
export function formatWait(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 90) return plural(seconds, 'second');
  return plural(Math.ceil(seconds / 60), 'minute');
}
