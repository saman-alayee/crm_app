const THEME_KEY = 'hr-theme';

/**
 * Default brand for پنل — soft corporate ocean blue
 * (readable on white cards, calm for long admin sessions)
 */
export const DEFAULT_PRIMARY = '#0b6e99';
const LEGACY_PRIMARIES = new Set([
  '#6f5644',
  '#6F5644',
  '#2563eb',
  '#2563EB',
  '#1d4ed8',
  '#1D4ED8',
]);

type ThemeState = {
  primary: string;
  accent: string;
  dark: boolean;
};

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function shade(hex: string, percent: number) {
  const { r, g, b } = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = Math.round((t - r) * p + r);
  const G = Math.round((t - g) * p + g);
  const B = Math.round((t - b) * p + b);
  return `#${[R, G, B].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** Soft companion tone derived from the single primary color */
export function deriveAccent(primary: string) {
  return shade(primary, 48);
}

function applyCss(state: ThemeState) {
  if (!import.meta.client) return;
  const root = document.documentElement;
  const accent = state.accent || deriveAccent(state.primary);

  root.style.setProperty('--hr-primary', state.primary);
  root.style.setProperty('--hr-accent', accent);
  root.style.setProperty('--hr-primary-200', shade(state.primary, state.dark ? -42 : 58));

  if (state.dark) {
    root.style.setProperty('--hr-primary-50', shade(state.primary, -78));
    root.style.setProperty('--hr-primary-100', shade(state.primary, -65));
    root.style.setProperty('--hr-btn', shade(state.primary, 28));
    root.style.setProperty('--hr-btn-hover', shade(state.primary, 38));
    root.style.setProperty('--hr-on-btn', '#071018');
    root.style.setProperty('--hr-link', shade(state.primary, 55));
    root.style.setProperty('--hr-primary-600', shade(state.primary, 28));
    root.style.setProperty('--hr-primary-700', shade(state.primary, 48));
    root.style.setProperty('--hr-primary-800', shade(state.primary, 60));
  } else {
    root.style.setProperty('--hr-primary-50', shade(state.primary, 92));
    root.style.setProperty('--hr-primary-100', shade(state.primary, 82));
    root.style.setProperty('--hr-btn', state.primary);
    root.style.setProperty('--hr-btn-hover', shade(state.primary, -14));
    root.style.setProperty('--hr-on-btn', '#ffffff');
    root.style.setProperty('--hr-link', shade(state.primary, -8));
    root.style.setProperty('--hr-primary-600', state.primary);
    root.style.setProperty('--hr-primary-700', shade(state.primary, -12));
    root.style.setProperty('--hr-primary-800', shade(state.primary, -22));
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', state.dark ? shade(state.primary, -68) : state.primary);

  root.classList.toggle('dark', state.dark);
  root.dataset.theme = state.dark ? 'dark' : 'light';
}

export function useTheme() {
  const state = useState<ThemeState>('hr-theme-state', () => ({
    primary: DEFAULT_PRIMARY,
    accent: deriveAccent(DEFAULT_PRIMARY),
    dark: false,
  }));

  function loadLocal() {
    if (!import.meta.client) return;
    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ThemeState;
        let primary = parsed.primary || DEFAULT_PRIMARY;
        if (LEGACY_PRIMARIES.has(primary)) primary = DEFAULT_PRIMARY;
        state.value = {
          primary,
          accent: deriveAccent(primary),
          dark: !!parsed.dark,
        };
      }
    } catch {
      /* ignore */
    }
    applyCss(state.value);
  }

  function persist() {
    if (!import.meta.client) return;
    state.value.accent = deriveAccent(state.value.primary);
    localStorage.setItem(THEME_KEY, JSON.stringify(state.value));
    applyCss(state.value);
  }

  function setPrimary(color: string) {
    state.value.primary = color;
    state.value.accent = deriveAccent(color);
    persist();
  }

  function setAccent(_color: string) {
    state.value.accent = deriveAccent(state.value.primary);
    persist();
  }

  function toggleDark(force?: boolean) {
    state.value.dark = force ?? !state.value.dark;
    persist();
  }

  async function syncFromServer() {
    try {
      const config = useRuntimeConfig();
      const auth = useAuthStore();
      if (!auth.accessToken) return;
      const base = resolveApiBase(String(config.public.apiBase || ''));
      const res = await $fetch<{
        success: boolean;
        data: { themePrimary: string; themeAccent: string; darkModeDefault: boolean };
      }>(`${base}/settings/theme`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      if (!localStorage.getItem(THEME_KEY)) {
        let primary = res.data.themePrimary || DEFAULT_PRIMARY;
        if (LEGACY_PRIMARIES.has(primary)) primary = DEFAULT_PRIMARY;
        state.value.primary = primary;
        state.value.accent = deriveAccent(primary);
        state.value.dark = !!res.data.darkModeDefault;
        persist();
      } else {
        applyCss(state.value);
      }
    } catch {
      applyCss(state.value);
    }
  }

  return {
    state,
    loadLocal,
    persist,
    setPrimary,
    setAccent,
    toggleDark,
    syncFromServer,
  };
}
