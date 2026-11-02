import { nameKeys, type NameKey } from '../messages';

export interface Group {
  id: string;
  name: string;
  nameKey?: NameKey;
  parentId: string | null;
  gain: number;
  muted: boolean;
  solo: boolean;
}
export interface Track {
  id: string;
  assetId: string;
  name: string;
  nameKey?: NameKey;
  groupId: string;
  gain: number;
  loop: boolean;
  muted: boolean;
  solo: boolean;
  duration: number;
  broadcast?: boolean;
}
export interface Scene {
  version: 1;
  id: string;
  name: string;
  nameKey?: NameKey;
  groups: Group[];
  tracks: Track[];
  masterGain: number;
  broadcastGain?: number;
  updatedAt: number;
}
export interface AudioAsset {
  id: string;
  name: string;
  blob: Blob;
  duration: number;
}

export function createScene(name: string, nameKey?: NameKey): Scene {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name,
    nameKey,
    masterGain: 0.8,
    updatedAt: Date.now(),
    tracks: [],
    groups: (['Окружение', 'Музыка', 'Эффекты'] as const).map((name) => ({
      id: crypto.randomUUID(),
      name,
      nameKey: name,
      parentId: null,
      gain: 1,
      muted: false,
      solo: false,
    })),
  };
}

export function ancestors(scene: Scene, groupId: string): Group[] {
  const path: Group[] = [];
  let group = scene.groups.find((g) => g.id === groupId);
  while (group && !path.some((g) => g.id === group!.id)) {
    path.push(group);
    group = scene.groups.find((g) => g.id === group!.parentId);
  }
  return path;
}

export function effectiveGain(scene: Scene, trackId: string): number {
  const track = scene.tracks.find((t) => t.id === trackId);
  if (!track || track.muted) return 0;
  const path = ancestors(scene, track.groupId);
  if (!path.length || path.some((g) => g.muted)) return 0;
  const soloExists = scene.groups.some((g) => g.solo) || scene.tracks.some((t) => t.solo);
  if (soloExists && !track.solo && !path.some((g) => g.solo)) return 0;
  return path.reduce((gain, group) => gain * group.gain, track.gain);
}

export function validateScene(value: unknown): Scene {
  const fail = (): never => {
    throw new Error('Повреждённый или неподдерживаемый формат сцены.');
  };
  if (!value || typeof value !== 'object') return fail();
  const s = value as Scene;
  const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 256;
  const gain = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  const bool = (v: unknown) => typeof v === 'boolean';
  const validNameKey = (v: unknown) => v === undefined || nameKeys.includes(v as NameKey);
  if (
    s.version !== 1 ||
    !text(s.id) ||
    !text(s.name) ||
    !validNameKey(s.nameKey) ||
    !gain(s.masterGain) ||
    (s.broadcastGain !== undefined && !gain(s.broadcastGain)) ||
    !Number.isFinite(s.updatedAt) ||
    !Array.isArray(s.groups) ||
    !Array.isArray(s.tracks) ||
    s.groups.length === 0 ||
    s.groups.length > 64 ||
    s.tracks.length > 128
  )
    return fail();
  const groups = new Set(s.groups.map((g) => g?.id));
  if (groups.size !== s.groups.length || new Set(s.tracks.map((t) => t?.id)).size !== s.tracks.length)
    return fail();
  for (const g of s.groups) {
    if (
      !g ||
      !text(g.id) ||
      !text(g.name) ||
      !validNameKey(g.nameKey) ||
      !gain(g.gain) ||
      !bool(g.muted) ||
      !bool(g.solo) ||
      (g.parentId !== null && !groups.has(g.parentId))
    )
      return fail();
    const visited = new Set<string>();
    let current: Group | undefined = g;
    while (current) {
      if (visited.has(current.id)) return fail();
      visited.add(current.id);
      current = s.groups.find((candidate) => candidate.id === current!.parentId);
    }
  }
  for (const t of s.tracks) {
    if (
      !t ||
      !text(t.id) ||
      !text(t.assetId) ||
      !text(t.name) ||
      !validNameKey(t.nameKey) ||
      !groups.has(t.groupId) ||
      !gain(t.gain) ||
      !bool(t.loop) ||
      !bool(t.muted) ||
      !bool(t.solo) ||
      (t.broadcast !== undefined && !bool(t.broadcast)) ||
      !Number.isFinite(t.duration) ||
      t.duration <= 0
    )
      return fail();
  }
  return structuredClone(s);
}

export function timeLabel(seconds: number): string {
  const n = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
}
