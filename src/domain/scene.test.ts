import { describe, expect, it } from 'vitest';
import { createScene, effectiveGain, validateScene, type Track } from './scene';

describe('scene mixing', () => {
  it('multiplies ancestor gains and silences descendants of muted groups', () => {
    const scene = createScene('Forest');
    scene.groups[0].gain = 0.5;
    scene.groups.push({
      id: 'child',
      name: 'Rain',
      parentId: scene.groups[0].id,
      gain: 0.4,
      muted: false,
      solo: false,
    });
    scene.tracks.push({
      id: 'rain',
      assetId: 'asset',
      name: 'Rain',
      groupId: 'child',
      gain: 0.5,
      loop: true,
      muted: false,
      solo: false,
      duration: 10,
    });
    expect(effectiveGain(scene, 'rain')).toBeCloseTo(0.1);
    scene.groups[0].muted = true;
    expect(effectiveGain(scene, 'rain')).toBe(0);
  });
  it('solo keeps only selected tracks or the selected group subtree audible', () => {
    const scene = createScene('Forest');
    const track: Track = {
      id: 'a',
      assetId: 'a',
      name: 'A',
      groupId: scene.groups[0].id,
      gain: 0.8,
      loop: true,
      muted: false,
      solo: false,
      duration: 10,
    };
    scene.tracks = [track, { ...track, id: 'b', groupId: scene.groups[1].id }];
    scene.groups[0].solo = true;
    expect(effectiveGain(scene, 'a')).toBe(0.8);
    expect(effectiveGain(scene, 'b')).toBe(0);
    scene.groups[0].solo = false;
    scene.tracks[1].solo = true;
    expect(effectiveGain(scene, 'a')).toBe(0);
    expect(effectiveGain(scene, 'b')).toBe(0.8);
  });
  it('rejects corrupt values, dangling assets/group references, and cycles', () => {
    const scene = createScene('Forest');
    expect(validateScene(scene)).toEqual(scene);
    expect(() => validateScene({ ...scene, masterGain: Infinity })).toThrow();
    scene.groups[0].parentId = scene.groups[0].id;
    expect(() => validateScene(scene)).toThrow();
    expect(() => validateScene({ version: 999 })).toThrow();
  });
});
