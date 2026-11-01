import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createScene } from '../domain/scene';
import { Repository } from './repository';

describe('local library', () => {
  it('restores scene settings and original audio after reopening', async () => {
    const name = crypto.randomUUID();
    const first = new Repository(name);
    const scene = createScene('Ночной лес');
    const bytes = new Uint8Array([82, 73, 70, 70]);
    await first.saveAsset({ id: 'rain', name: 'Дождь.wav', blob: new Blob([bytes]), duration: 12 });
    scene.tracks.push({
      id: 'track',
      assetId: 'rain',
      name: 'Дождь',
      groupId: scene.groups[0].id,
      gain: 0.3,
      loop: true,
      muted: false,
      solo: false,
      duration: 12,
    });
    await first.saveScene(scene);
    await first.close();
    const second = new Repository(name);
    expect((await second.listScenes())[0].tracks[0].gain).toBe(0.3);
    expect(new Uint8Array(await (await second.getAsset('rain'))!.blob.arrayBuffer())).toEqual(bytes);
    await second.close();
  });
  it('deletes a scene without deleting audio still referenced by another scene', async () => {
    const repo = new Repository(crypto.randomUUID());
    await repo.saveAsset({ id: 'shared', name: 'Shared', blob: new Blob(['audio']), duration: 2 });
    const scene = createScene('One');
    scene.tracks = [
      {
        id: 't',
        assetId: 'shared',
        name: 'T',
        groupId: scene.groups[0].id,
        gain: 1,
        loop: false,
        muted: false,
        solo: false,
        duration: 2,
      },
    ];
    await repo.saveScene(scene);
    await repo.saveScene({ ...scene, id: 'two', name: 'Two' });
    await repo.deleteScene(scene.id);
    expect((await repo.listScenes()).map((s) => s.name)).toEqual(['Two']);
    expect(await repo.getAsset('shared')).toBeDefined();
    await repo.close();
  });
  it('rejects invalid scenes before overwriting saved data', async () => {
    const repo = new Repository(crypto.randomUUID());
    const scene = createScene('Saved');
    await repo.saveScene(scene);
    await expect(repo.saveScene({ ...scene, masterGain: NaN })).rejects.toThrow();
    expect((await repo.listScenes())[0].name).toBe('Saved');
    await repo.close();
  });
});
