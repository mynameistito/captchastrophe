import type { Theme } from './types.ts';

/** The only thing this site keeps in localStorage. */
export const THEME_KEY = 'captchastrophe-theme';

export interface ThemeController {
  current(): Theme;
  toggle(): void;
  subscribe(cb: (theme: Theme) => void): () => void;
}

function readOverride(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Follows the system until the user picks one with the toggle; the pick is stored locally. */
export function createTheme(): ThemeController {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const listeners = new Set<(theme: Theme) => void>();
  let override = readOverride();
  const resolve = (): Theme => override ?? (media.matches ? 'dark' : 'light');
  let theme = resolve();

  const apply = () => {
    const next = resolve();
    document.documentElement.dataset.theme = next;
    if (next === theme) return;
    theme = next;
    listeners.forEach((cb) => cb(next));
  };
  document.documentElement.dataset.theme = theme;
  media.addEventListener('change', apply);

  return {
    current: () => theme,
    toggle() {
      override = theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, override);
      } catch {
        // Storage can be blocked. The choice still applies for this visit.
      }
      apply();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
