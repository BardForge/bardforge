import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createScene, type AudioAsset } from '../domain/scene';
import { archiveFileName, exportSceneArchive, MAX_ARCHIVE_BYTES, readSceneArchive } from './archive';
import { Repository } from './repository';

function fixture() {
  const scene = createScene('Custom scene');
  scene.groups[1].parentId = scene.groups[0].id;
  scene.groups[1].gain = 0.4;
  const asset: AudioAsset = {
    id: 'shared',
    name: 'tone.wav',
    blob: new Blob(['original bytes'], { type: 'audio/wav' }),
    duration: 12,
  };
  scene.tracks = [0, 1].map((index) => ({
    id: `track-${index}`,
    assetId: asset.id,
    name: `Custom ${index}`,
    groupId: scene.groups[1].id,
    gain: 0.3,
    muted: false,
    solo: index === 0,
    loop: true,
    duration: 12,
  }));
  return { scene, asset };
}

async function editManifest(blob: Blob, edit: (manifest: Record<string, unknown>) => void) {
  const header = new Uint8Array(await blob.slice(0, 15).arrayBuffer());
  const length = new DataView(header.buffer).getUint32(11, true);
  const manifest = JSON.parse(await blob.slice(15, 15 + length).text());
  edit(manifest);
  const bytes = new TextEncoder().encode(JSON.stringify(manifest));
  new DataView(header.buffer).setUint32(11, bytes.length, true);
  return new Blob([header, bytes, blob.slice(15 + length)]);
}

describe('portable scene archives', () => {
  it('preserves bytes, nested settings and shared assets while assigning fresh IDs on every import', async () => {
    const { scene, asset } = fixture();
    scene.tracks[0].broadcast = true;
    const archive = await exportSceneArchive(scene, async () => asset);
    const imported = await readSceneArchive(archive, async () => 11.9);
    const again = await readSceneArchive(archive, async () => 11.9);
    expect(imported.scene.id).not.toBe(scene.id);
    expect(again.scene.id).not.toBe(imported.scene.id);
    expect(imported.assets).toHaveLength(1);
    expect(await imported.assets[0].blob.text()).toBe('original bytes');
    expect(imported.scene.name).toBe('Custom scene');
    expect(imported.scene.groups[1].parentId).toBe(imported.scene.groups[0].id);
    expect(imported.scene.groups[1].gain).toBe(0.4);
    expect(imported.scene.tracks[0]).toMatchObject({
      name: 'Custom 0',
      gain: 0.3,
      solo: true,
      duration: 11.9,
    });
    expect(imported.scene.tracks[0].id).not.toBe(scene.tracks[0].id);
    expect(imported.scene.tracks[0].broadcast).toBe(false);
    expect(imported.scene.tracks.every((track) => track.assetId === imported.assets[0].id)).toBe(true);
  });
  it('supports an empty scene and refuses missing source audio', async () => {
    const empty = createScene('Empty');
    const archive = await exportSceneArchive(empty, async () => undefined);
    expect((await readSceneArchive(archive, async () => 1)).scene.tracks).toHaveLength(0);
    await expect(exportSceneArchive(fixture().scene, async () => undefined)).rejects.toThrow('отсутствует');
  });
  it('rejects oversized input before reading any bytes', async () => {
    const oversized = new Blob();
    Object.defineProperty(oversized, 'size', { value: MAX_ARCHIVE_BYTES + 1 });
    await expect(readSceneArchive(oversized, async () => 1)).rejects.toThrow('256');
  });
  it('rejects unsupported versions, invalid references, duplicate assets and truncated or appended bytes', async () => {
    const { scene, asset } = fixture();
    const archive = await exportSceneArchive(scene, async () => asset);
    const wrongVersion = await editManifest(archive, (m) => {
      m.version = 99;
    });
    const missing = await editManifest(archive, (m) => {
      m.assets = [];
    });
    const duplicates = await editManifest(archive, (m) => {
      m.assets = [...(m.assets as unknown[]), ...(m.assets as unknown[])];
    });
    for (const bad of [
      wrongVersion,
      missing,
      duplicates,
      archive.slice(0, archive.size - 1),
      new Blob([archive, 'x']),
      new Blob(['garbage']),
    ]) {
      await expect(readSceneArchive(bad, async () => 1)).rejects.toThrow();
    }
  });
  it('rejects tampered audio checksums and unplayable audio before writing anything', async () => {
    const { scene, asset } = fixture();
    const archive = await exportSceneArchive(scene, async () => asset);
    const tampered = new Blob([archive.slice(0, archive.size - 1), 'X']);
    await expect(readSceneArchive(tampered, async () => 1)).rejects.toThrow('повреждён');
    await expect(
      readSceneArchive(archive, async () => {
        throw new Error('unplayable');
      }),
    ).rejects.toThrow('unplayable');
  });
  it('rolls back earlier asset writes if any later add collides', async () => {
    const repo = new Repository(crypto.randomUUID());
    const { scene, asset } = fixture();
    await repo.saveScene(scene);
    const newAsset = { ...asset, id: 'new-asset' };
    const collidingScene = {
      ...scene,
      tracks: scene.tracks.map((track) => ({ ...track, assetId: newAsset.id })),
    };
    await expect(repo.importScene(collidingScene, [newAsset])).rejects.toThrow();
    expect(await repo.getAsset(newAsset.id)).toBeUndefined();
    expect((await repo.listScenes())[0].tracks[0].assetId).toBe(asset.id);
    await repo.close();
  });
  it('does not overwrite an existing asset and commits a fresh bundle durably', async () => {
    const repo = new Repository(crypto.randomUUID());
    const { scene, asset } = fixture();
    await repo.saveAsset(asset);
    await expect(repo.importScene(scene, [{ ...asset, blob: new Blob(['replacement']) }])).rejects.toThrow();
    expect(await repo.listScenes()).toHaveLength(0);
    expect(await (await repo.getAsset(asset.id))!.blob.text()).toBe('original bytes');
    const bundle = await readSceneArchive(await exportSceneArchive(scene, async () => asset), async () => 12);
    await repo.importScene(bundle.scene, bundle.assets);
    expect((await repo.listScenes())[0].id).toBe(bundle.scene.id);
    expect(await (await repo.getAsset(bundle.assets[0].id))!.blob.text()).toBe('original bytes');
    await repo.close();
  });
  it('sanitizes download filenames', () => {
    expect(archiveFileName('a/b:c?')).toBe('a_b_c_.bardforge');
  });
});
