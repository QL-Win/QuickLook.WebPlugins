/**
 * Theme preference: auto (follow system) | light | dark.
 * Persists to localStorage and applies data-theme on <html>.
 */

export type ThemePreference = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'adoc-theme';

const listeners = new Set<(resolved: ResolvedTheme, preference: ThemePreference) => void>();

let mediaQuery: MediaQueryList | null = null;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'auto') return getSystemTheme();
  return preference;
}

export function getStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'auto';
}

export function getPreference(): ThemePreference {
  const fromDom = document.documentElement.dataset.themePref;
  if (isThemePreference(fromDom)) return fromDom;
  return getStoredPreference();
}

export function getResolvedTheme(): ResolvedTheme {
  const fromDom = document.documentElement.dataset.theme;
  if (fromDom === 'dark' || fromDom === 'light') return fromDom;
  return resolveTheme(getPreference());
}

function ensureSystemListener(): void {
  if (mediaQuery || typeof matchMedia !== 'function') return;
  mediaQuery = matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (getPreference() === 'auto') {
      applyTheme('auto', { persist: false });
    }
  };
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onChange);
  } else {
    // Safari < 14
    (mediaQuery as MediaQueryList & { addListener: (cb: () => void) => void }).addListener(onChange);
  }
}

export function applyTheme(
  preference: ThemePreference,
  options?: { persist?: boolean },
): ResolvedTheme {
  const persist = options?.persist !== false;
  const resolved = resolveTheme(preference);

  document.documentElement.dataset.themePref = preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      /* ignore */
    }
  }

  ensureSystemListener();

  for (const listener of listeners) {
    listener(resolved, preference);
  }

  return resolved;
}

export function onThemeChange(
  listener: (resolved: ResolvedTheme, preference: ThemePreference) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Toggle light ↔ dark (like iconfont). Locks preference away from auto. */
export function toggleTheme(): ResolvedTheme {
  const next: ResolvedTheme = getResolvedTheme() === 'dark' ? 'light' : 'dark';
  return applyTheme(next);
}

/** Initialize from storage / query string; call once at startup. */
export function initTheme(urlParams?: URLSearchParams): ThemePreference {
  let preference = getStoredPreference();
  const fromQuery = urlParams?.get('theme');
  if (isThemePreference(fromQuery)) {
    preference = fromQuery;
  }
  applyTheme(preference);
  return preference;
}
