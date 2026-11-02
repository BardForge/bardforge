import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceStore, defaultWorkspace, readWorkspace, workspaceKey } from './workspace';
import { workspaceEn } from './workspace-messages';

describe('workspace appearance preferences', () => {
  it('restores valid preferences and independently rejects invalid fields', () => {
    expect(readWorkspace({ getItem: () => '{broken' })).toEqual(defaultWorkspace);
    expect(readWorkspace({ getItem: () => 'null' })).toEqual(defaultWorkspace);
    expect(
      readWorkspace({ getItem: () => JSON.stringify({ theme: 'light', accent: 'red', compact: 'yes' }) }),
    ).toEqual({ theme: 'light', accent: 'amber', compact: false });
    expect(
      readWorkspace({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toEqual(defaultWorkspace);
  });

  it('persists all controls across reload without writing scene or language data', () => {
    const values = new Map([
      ['bardforge.language', 'en'],
      ['scene', 'My authored scene'],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const store = createWorkspaceStore(storage);
    store.update({ theme: 'light' });
    store.update({ accent: 'teal' });
    store.update({ compact: true });
    expect(createWorkspaceStore(storage).getSnapshot()).toEqual({
      theme: 'light',
      accent: 'teal',
      compact: true,
      resolvedTheme: 'light',
      saved: true,
    });
    expect([...values.keys()]).toEqual(['bardforge.language', 'scene', workspaceKey]);
    expect(values.get('scene')).toBe('My authored scene');
    expect(values.get('bardforge.language')).toBe('en');
  });

  it('applies blocked writes for this session and recovers after a successful save', () => {
    const setItem = vi.fn().mockImplementationOnce(() => {
      throw new Error('quota');
    });
    const store = createWorkspaceStore({ getItem: () => null, setItem });
    store.update({ theme: 'light' });
    expect(store.getSnapshot()).toMatchObject({ theme: 'light', resolvedTheme: 'light', saved: false });
    store.update({ compact: true });
    expect(store.getSnapshot()).toMatchObject({ compact: true, saved: true });
  });

  it('tracks OS changes only in system mode and removes its listener on unmount', () => {
    const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const store = createWorkspaceStore({ getItem: () => null, setItem: vi.fn() }, media);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.update({ theme: 'system' });
    expect(store.getSnapshot().resolvedTheme).toBe('light');
    const changed = media.addEventListener.mock.calls[0][1] as () => void;
    media.matches = true;
    changed();
    expect(store.getSnapshot()).toMatchObject({ theme: 'system', resolvedTheme: 'dark' });
    store.update({ theme: 'light' });
    const stable = store.getSnapshot();
    changed();
    expect(store.getSnapshot()).toBe(stable);
    unsubscribe();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', changed);
  });

  it('provides complete, nonempty English labels for the settings', () => {
    for (const english of Object.values(workspaceEn)) {
      expect(english.trim()).not.toBe('');
      expect(english).not.toMatch(/[А-Яа-яЁё]/);
    }
  });
});
