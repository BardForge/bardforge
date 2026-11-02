import { useEffect, useRef, useState } from 'react';
import { AudioEngine, inspectAudio } from './audio/engine';
import { demoWav } from './audio/demo';
import { createScene, type Group, type Scene, type Track } from './domain/scene';
import { Repository } from './storage/repository';
import { archiveFileName, exportSceneArchive, readSceneArchive } from './storage/archive';
import { errorText, nameOf, t, UserError } from './i18n';

export function useStudio() {
  const [repository] = useState(() => new Repository());
  const [engine] = useState(() => new AudioEngine());
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scene, setScene] = useState<Scene | null>(null);
  const current = useRef<Scene | null>(null);
  const [busy, setBusy] = useState(true);
  const locked = useRef(true);
  const [error, setError] = useState<unknown>('');
  const [notice, setNotice] = useState<'Сцена экспортирована.' | 'Сцена импортирована как новая.' | ''>('');
  const [saved, setSaved] = useState(true);
  const [playback, setPlayback] = useState(engine.snapshot());
  const [level, setLevel] = useState(0);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);

  const report = (value: unknown) => setError(value);
  const assign = (value: Scene) => {
    current.current = value;
    setScene(value);
    engine.sync(value);
    setScenes((items) =>
      items.some((s) => s.id === value.id)
        ? items.map((s) => (s.id === value.id ? value : s))
        : [...items, value],
    );
  };
  const persist = (value: Scene) => {
    pending.current++;
    setSaved(false);
    const task = queue.current.catch(() => {}).then(() => repository.saveScene(value));
    queue.current = task.catch(() => {});
    void task
      .then(() => {
        if (current.current === value) setSaved(true);
      }, report)
      .finally(() => {
        pending.current--;
      });
    return task;
  };
  const change = (edit: (scene: Scene) => Scene) => {
    if (!current.current || locked.current) return;
    const next = { ...edit(current.current), updatedAt: Date.now() };
    if (next.name !== current.current.name) next.nameKey = undefined;
    assign(next);
    void persist(next).catch(() => {});
  };
  const activate = async (next: Scene, signal?: AbortSignal) => {
    signal?.throwIfAborted();
    engine.clear();
    assign(next);
    setSaved(true);
    const missing: Track[] = [];
    for (const track of next.tracks) {
      const asset = await repository.getAsset(track.assetId);
      signal?.throwIfAborted();
      if (asset) await engine.loadTrack(track.id, asset.blob);
      else missing.push(track);
    }
    engine.sync(next);
    setPlayback(engine.snapshot());
    if (missing.length)
      setError(
        new UserError(
          'Не найдены аудиофайлы: {files}. Удалите эти дорожки и импортируйте файлы повторно.',
          () => ({
            files: missing.map(nameOf).join(', '),
          }),
        ),
      );
    return missing.length === 0;
  };
  const run = async (action: () => Promise<void>) => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      return true;
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) report(e);
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
      setPlayback(engine.snapshot());
    }
  };

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        let items = await repository.listScenes();
        if (!items.length) {
          const fresh = createScene('Новая сцена', 'Новая сцена');
          await repository.saveScene(fresh);
          items = [fresh];
        }
        if (disposed) return;
        setScenes(items);
        await activate(items[0]);
      } catch (e) {
        if (!disposed) report(e);
      } finally {
        if (!disposed) {
          locked.current = false;
          setBusy(false);
        }
      }
    })();
    const timer = window.setInterval(() => {
      setPlayback(engine.snapshot());
      setLevel(engine.level());
    }, 100);
    const unload = (event: BeforeUnloadEvent) => {
      if (pending.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('beforeunload', unload);
      void engine.dispose();
      void queue.current.finally(() => repository.close());
    };
    // The repository and engine are owned by this mounted studio instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectScene = (id: string) =>
    run(async () => {
      if (!saved && current.current) await persist(current.current);
      await queue.current;
      const next = scenes.find((s) => s.id === id);
      if (next) await activate(next);
    });
  const activateSequenceScene = (id: string, autoplay: boolean, signal: AbortSignal) =>
    run(async () => {
      signal.throwIfAborted();
      if (!saved && current.current) await persist(current.current);
      await queue.current;
      const next = (await repository.listScenes()).find((item) => item.id === id);
      signal.throwIfAborted();
      if (!next) throw new Error('Сцена этапа удалена.');
      if (!(await activate(next, signal))) throw new Error('Не удалось запустить этап последовательности.');
      signal.throwIfAborted();
      if (!autoplay) return;
      const abortPlayback = () => engine.stop();
      signal.addEventListener('abort', abortPlayback, { once: true });
      try {
        await engine.play(next.tracks.map((track) => track.id));
        signal.throwIfAborted();
      } finally {
        signal.removeEventListener('abort', abortPlayback);
      }
    });
  const newScene = () =>
    run(async () => {
      if (!saved && current.current) await persist(current.current);
      await queue.current;
      const next = createScene('Новая сцена', 'Новая сцена');
      await repository.saveScene(next);
      await activate(next);
    });
  const duplicateScene = () =>
    run(async () => {
      if (!current.current) return;
      const next = {
        ...structuredClone(current.current),
        id: crypto.randomUUID(),
        name: t('{name} — копия', { name: nameOf(current.current).slice(0, 230) }),
        nameKey: undefined,
        updatedAt: Date.now(),
      };
      await repository.saveScene(next);
      await activate(next);
    });
  const deleteScene = () =>
    run(async () => {
      if (!current.current) return;
      await queue.current;
      const id = current.current.id;
      const remaining = scenes.filter((s) => s.id !== id);
      // Create the replacement first so deleting the last scene cannot leave an unusable library.
      const next = remaining[0] ?? createScene('Новая сцена', 'Новая сцена');
      if (!remaining.length) await repository.saveScene(next);
      await repository.deleteScene(id);
      setScenes(remaining.length ? remaining : [next]);
      await activate(next);
    });
  const importFiles = (files: File[], groupId?: string) =>
    run(async () => {
      if (!current.current) return;
      const target = current.current;
      const tracks: Track[] = [];
      const failures: { file: string; error: unknown }[] = [];
      for (const file of files) {
        try {
          if (target.tracks.length + tracks.length >= 128)
            throw new Error('В сцене может быть не больше 128 дорожек.');
          const duration = await inspectAudio(file);
          const assetId = crypto.randomUUID();
          await repository.saveAsset({ id: assetId, name: file.name, blob: file, duration });
          const track: Track = {
            id: crypto.randomUUID(),
            assetId,
            name: file.name.replace(/\.[^.]+$/, '').slice(0, 256) || 'Аудио',
            nameKey: file.name.replace(/\.[^.]+$/, '') ? undefined : 'Аудио',
            groupId: groupId ?? target.groups[0].id,
            gain: 0.7,
            loop: true,
            muted: false,
            solo: false,
            duration,
          };
          tracks.push(track);
          await engine.loadTrack(track.id, file);
        } catch (e) {
          failures.push({ file: file.name, error: e });
        }
      }
      if (tracks.length) {
        const next = { ...target, tracks: [...target.tracks, ...tracks], updatedAt: Date.now() };
        assign(next);
        await persist(next);
      }
      if (failures.length) setError(failures);
    });
  const exportScene = () =>
    run(async () => {
      if (!current.current) return;
      await persist(current.current);
      const blob = await exportSceneArchive(current.current, (id) => repository.getAsset(id));
      if (window.bardforge?.saveSceneArchive) {
        if (
          await window.bardforge.saveSceneArchive(
            new Uint8Array(await blob.arrayBuffer()),
            archiveFileName(nameOf(current.current)),
          )
        )
          setNotice('Сцена экспортирована.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = archiveFileName(nameOf(current.current));
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setNotice('Сцена экспортирована.');
    });
  const importScene = (file: File) =>
    run(async () => {
      if (!saved && current.current) await persist(current.current);
      await queue.current;
      const bundle = await readSceneArchive(file, inspectAudio);
      await repository.importScene(bundle.scene, bundle.assets);
      await activate(bundle.scene);
      setNotice('Сцена импортирована как новая.');
    });
  const loadDemo = () =>
    run(async () => {
      if (!saved && current.current) await persist(current.current);
      await queue.current;
      const next = createScene('Ночной лес', 'Ночной лес');
      const entries = [
        ['rain', 'Лесной дождь'],
        ['drone', 'Далёкий гул'],
        ['bell', 'Колокол'],
      ] as const;
      for (const [index, [kind, name]] of entries.entries()) {
        const blob = demoWav(kind);
        const duration = kind === 'bell' ? 4 : 12;
        const id = crypto.randomUUID();
        await repository.saveAsset({ id, name: `${name}.wav`, blob, duration });
        next.tracks.push({
          id: crypto.randomUUID(),
          assetId: id,
          name,
          nameKey: name,
          groupId: next.groups[index].id,
          gain: 0.7,
          loop: kind !== 'bell',
          muted: false,
          solo: false,
          duration,
        });
      }
      await repository.saveScene(next);
      await activate(next);
    });
  const play = async (ids: string[]) => {
    if (locked.current) return;
    try {
      setError('');
      await engine.play(ids);
    } catch (e) {
      report(e);
    }
    setPlayback(engine.snapshot());
  };
  const pause = (ids?: string[]) => {
    engine.pause(ids);
    setPlayback(engine.snapshot());
  };
  const stop = (ids?: string[]) => {
    engine.stop(ids);
    setPlayback(engine.snapshot());
  };
  const trackChange = (id: string, patch: Partial<Track>) =>
    change((s) => ({
      ...s,
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, ...patch, ...(patch.name !== undefined ? { nameKey: undefined } : {}) } : t,
      ),
    }));
  const groupChange = (id: string, patch: Partial<Group>) =>
    change((s) => ({
      ...s,
      groups: s.groups.map((g) =>
        g.id === id ? { ...g, ...patch, ...(patch.name !== undefined ? { nameKey: undefined } : {}) } : g,
      ),
    }));
  const addGroup = (parentId: string | null = null) =>
    change((s) => {
      if (s.groups.length >= 64) {
        setError('В сцене может быть не больше 64 групп.');
        return s;
      }
      return {
        ...s,
        groups: [
          ...s.groups,
          {
            id: crypto.randomUUID(),
            name: parentId ? 'Подгруппа' : 'Новая группа',
            nameKey: parentId ? 'Подгруппа' : 'Новая группа',
            parentId,
            gain: 1,
            muted: false,
            solo: false,
          },
        ],
      };
    });
  return {
    scene,
    scenes,
    busy,
    error: errorText(error),
    notice: notice ? t(notice) : '',
    saved,
    playback,
    level,
    broadcastStream: () => engine.getBroadcastStream(),
    change,
    trackChange,
    groupChange,
    addGroup,
    selectScene,
    activateAndPlay: (id: string, signal: AbortSignal) => activateSequenceScene(id, true, signal),
    restoreSequenceScene: (id: string, signal: AbortSignal) => activateSequenceScene(id, false, signal),
    newScene,
    duplicateScene,
    deleteScene,
    importFiles,
    importScene,
    exportScene,
    loadDemo,
    play,
    pause,
    stop,
    clearError: () => setError(''),
    save: () =>
      run(async () => {
        if (current.current) await persist(current.current);
      }),
    removeTrack: (id: string) => change((s) => ({ ...s, tracks: s.tracks.filter((t) => t.id !== id) })),
    seek: (id: string, value: number) => {
      engine.seek(id, value);
      setPlayback(engine.snapshot());
    },
  };
}

export type Studio = ReturnType<typeof useStudio>;
