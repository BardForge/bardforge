import { validateScene, type AudioAsset, type Scene } from '../domain/scene';

// Uncompressed binary format: magic, little-endian manifest length, UTF-8 JSON,
// then original audio bytes in manifest order. No paths or executable content.
const MAGIC = new TextEncoder().encode('BARDFORGE1\n');
export const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_ASSET_BYTES = 100 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 256 * 1024;
const invalid = () => new Error('Архив сцены повреждён или имеет неподдерживаемую версию.');
const references = () => new Error('В архиве отсутствует аудиофайл или нарушены связи сцены.');
export interface SceneBundle {
  scene: Scene;
  assets: AudioAsset[];
}
interface AssetEntry {
  id: string;
  name: string;
  size: number;
  type: string;
  duration: number;
  sha256: string;
}

async function checksum(blob: Blob): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function exportSceneArchive(
  value: Scene,
  getAsset: (id: string) => Promise<AudioAsset | undefined>,
): Promise<Blob> {
  const scene = validateScene(value);
  const assets: Blob[] = [];
  const entries: AssetEntry[] = [];
  let total = MAGIC.length + 4;
  for (const id of new Set(scene.tracks.map((track) => track.assetId))) {
    const asset = await getAsset(id);
    if (!asset) throw new Error('Не удалось экспортировать сцену: аудиофайл отсутствует в библиотеке.');
    if (!asset.blob.size || asset.blob.size > MAX_ASSET_BYTES) throw invalid();
    total += asset.blob.size;
    if (total > MAX_ARCHIVE_BYTES) throw new Error('Архив сцены превышает 256 МБ.');
    entries.push({
      id,
      name: asset.name,
      size: asset.blob.size,
      type: asset.blob.type,
      duration: asset.duration,
      sha256: await checksum(asset.blob),
    });
    assets.push(asset.blob);
  }
  const manifest = new TextEncoder().encode(
    JSON.stringify({ format: 'bardforge-scene', version: 1, scene, assets: entries }),
  );
  if (manifest.length > MAX_MANIFEST_BYTES) throw invalid();
  if (total + manifest.length > MAX_ARCHIVE_BYTES) throw new Error('Архив сцены превышает 256 МБ.');
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, manifest.length, true);
  return new Blob([MAGIC, length, manifest, ...assets], { type: 'application/octet-stream' });
}

export async function readSceneArchive(
  file: Blob,
  inspectAudio: (blob: Blob) => Promise<number>,
): Promise<SceneBundle> {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('Архив сцены превышает 256 МБ.');
  const headerSize = MAGIC.length + 4;
  if (file.size < headerSize) throw invalid();
  const header = new Uint8Array(await file.slice(0, headerSize).arrayBuffer());
  if (!MAGIC.every((b, i) => header[i] === b)) throw invalid();
  const length = new DataView(header.buffer).getUint32(MAGIC.length, true);
  if (!length || length > MAX_MANIFEST_BYTES || headerSize + length > file.size) throw invalid();
  let manifest;
  try {
    manifest = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        await file.slice(headerSize, headerSize + length).arrayBuffer(),
      ),
    );
  } catch {
    throw invalid();
  }
  if (
    !manifest ||
    manifest.format !== 'bardforge-scene' ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length > 128
  )
    throw invalid();
  const scene = validateScene(manifest.scene);
  const required = new Set(scene.tracks.map((track) => track.assetId));
  const seen = new Set<string>();
  let offset = headerSize + length;
  const entries: AssetEntry[] = manifest.assets;
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || !required.has(entry.id) || seen.has(entry.id))
      throw references();
    if (
      typeof entry.name !== 'string' ||
      !entry.name.trim() ||
      entry.name.length > 256 ||
      typeof entry.type !== 'string' ||
      entry.type.length > 256 ||
      !Number.isSafeInteger(entry.size) ||
      entry.size <= 0 ||
      entry.size > MAX_ASSET_BYTES ||
      !Number.isFinite(entry.duration) ||
      entry.duration <= 0 ||
      typeof entry.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(entry.sha256)
    )
      throw invalid();
    seen.add(entry.id);
    offset += entry.size;
    if (offset > file.size) throw invalid();
  }
  if (seen.size !== required.size) throw references();
  if (offset !== file.size) throw invalid();
  // Validate every audio file before opening a write transaction. Serialized durations
  // are never trusted: use the actual playable media duration for both asset and track.
  offset = headerSize + length;
  const assets: AudioAsset[] = [];
  const assetMap = new Map<string, AudioAsset>();
  for (const entry of entries) {
    const blob = file.slice(offset, offset + entry.size, entry.type);
    offset += entry.size;
    if ((await checksum(blob)) !== entry.sha256) throw new Error('Аудиофайл в архиве повреждён.');
    const duration = await inspectAudio(blob);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Аудиофайл в архиве повреждён.');
    const asset = { id: crypto.randomUUID(), name: entry.name, blob, duration };
    assets.push(asset);
    assetMap.set(entry.id, asset);
  }
  const groups = new Map(scene.groups.map((group) => [group.id, crypto.randomUUID()]));
  const fresh = validateScene({
    ...scene,
    id: crypto.randomUUID(),
    updatedAt: Date.now(),
    groups: scene.groups.map((group) => ({
      ...group,
      id: groups.get(group.id)!,
      parentId: group.parentId === null ? null : groups.get(group.parentId)!,
    })),
    tracks: scene.tracks.map((track) => ({
      ...track,
      broadcast: false,
      id: crypto.randomUUID(),
      groupId: groups.get(track.groupId)!,
      assetId: assetMap.get(track.assetId)!.id,
      duration: assetMap.get(track.assetId)!.duration,
    })),
  });
  return { scene: fresh, assets };
}

export function archiveFileName(name: string): string {
  return `${
    Array.from(name, (char) => (char.charCodeAt(0) < 32 ? '_' : char))
      .join('')
      .replace(/[<>:"/\\|?*]/g, '_')
      .trim()
      .slice(0, 100) || 'scene'
  }.bardforge`;
}
