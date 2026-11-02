import { useLayoutEffect, useSyncExternalStore } from 'react';

export const workspaceKey = 'bardforge.workspace.v1';
export const themes = ['dark', 'light', 'system'] as const;
export const accents = ['amber', 'violet', 'teal', 'blue'] as const;
export type WorkspacePreferences = {
  theme: (typeof themes)[number];
  accent: (typeof accents)[number];
  compact: boolean;
};
export const defaultWorkspace: WorkspacePreferences = {
  theme: 'dark',
  accent: 'amber',
  compact: false,
};
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
type ThemeMedia = Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;

export function normalizeWorkspace(value: unknown): WorkspacePreferences {
  const input = value && typeof value === 'object' ? (value as Partial<WorkspacePreferences>) : {};
  return {
    theme: themes.includes(input.theme!) ? input.theme! : defaultWorkspace.theme,
    accent: accents.includes(input.accent!) ? input.accent! : defaultWorkspace.accent,
    compact: typeof input.compact === 'boolean' ? input.compact : defaultWorkspace.compact,
  };
}

export function readWorkspace(storage?: Pick<Storage, 'getItem'>): WorkspacePreferences {
  try {
    return normalizeWorkspace(JSON.parse(storage?.getItem(workspaceKey) ?? 'null'));
  } catch {
    return { ...defaultWorkspace };
  }
}

export function createWorkspaceStore(storage?: PreferenceStorage, media?: ThemeMedia) {
  let preferences = readWorkspace(storage);
  let saved = true;
  const resolveTheme = () =>
    preferences.theme === 'system'
      ? media?.matches
        ? ('dark' as const)
        : ('light' as const)
      : preferences.theme;
  let snapshot = { ...preferences, resolvedTheme: resolveTheme(), saved };
  const listeners = new Set<() => void>();
  const notify = () => {
    snapshot = { ...preferences, resolvedTheme: resolveTheme(), saved };
    listeners.forEach((listener) => listener());
  };
  const onSystemTheme = () => {
    if (preferences.theme === 'system') notify();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (listeners.size === 0) {
        media?.addEventListener('change', onSystemTheme);
        // The OS theme may have changed while no component was subscribed.
        if (snapshot.resolvedTheme !== resolveTheme()) notify();
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) media?.removeEventListener('change', onSystemTheme);
      };
    },
    update(patch: Partial<WorkspacePreferences>) {
      preferences = normalizeWorkspace({ ...preferences, ...patch });
      try {
        if (!storage) throw new Error('Storage unavailable');
        storage.setItem(workspaceKey, JSON.stringify(preferences));
        saved = true;
      } catch {
        // Keep this session usable even if browser storage is blocked or full.
        saved = false;
      }
      notify();
    },
  };
}

let browserStore: ReturnType<typeof createWorkspaceStore> | undefined;
function getWorkspaceStore() {
  if (!browserStore) {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      // Preferences still work until the application is closed.
    }
    const media =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : undefined;
    browserStore = createWorkspaceStore(storage, media);
  }
  return browserStore;
}

export function useWorkspacePreferences() {
  const store = getWorkspaceStore();
  const preferences = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...preferences, update: store.update };
}

/** Mount once in App so changes and OS-theme updates apply even with settings closed. */
export function useWorkspaceAppearance() {
  const preferences = useWorkspacePreferences();
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preferences.resolvedTheme;
    root.dataset.accent = preferences.accent;
    root.dataset.density = preferences.compact ? 'compact' : 'comfortable';
  }, [preferences.resolvedTheme, preferences.accent, preferences.compact]);
}
