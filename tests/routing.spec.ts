import { expect, test } from '@playwright/test';

test('broadcast bus is opt-in, independent of local volume and respects group mute', async ({ page }) => {
  await page.goto('/');
  const state = await page.evaluateHandle(async () => {
    const enginePath = '/src/audio/engine.ts';
    const demoPath = '/src/audio/demo.ts';
    const scenePath = '/src/domain/scene.ts';
    const { AudioEngine } = await import(enginePath);
    const { demoWav } = await import(demoPath);
    const { createScene } = await import(scenePath);
    const engine = new AudioEngine();
    const scene = createScene('Routing test');
    scene.masterGain = 0;
    scene.tracks.push({
      id: 'test',
      assetId: 'test',
      name: 'test',
      groupId: scene.groups[0].id,
      gain: 1,
      loop: true,
      muted: false,
      solo: false,
      duration: 12,
    });
    await engine.loadTrack('test', demoWav('drone'));
    engine.sync(scene);
    const receiver = new AudioContext();
    const analyser = receiver.createAnalyser();
    receiver.createMediaStreamSource(engine.getBroadcastStream()).connect(analyser);
    await receiver.resume();
    await engine.play(['test']);
    return { engine, scene, receiver, analyser };
  });
  const level = () =>
    state.evaluate(({ analyser }) => {
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      return Math.sqrt(samples.reduce((sum, n) => sum + n * n, 0) / samples.length);
    });
  try {
    expect(await level()).toBe(0);
    await state.evaluate(({ scene, engine }) => {
      scene.tracks[0].broadcast = true;
      engine.sync(scene);
    });
    await expect.poll(level).toBeGreaterThan(0.001);
    await expect.poll(() => state.evaluate(({ engine }) => engine.level())).toBeLessThan(0.0001);
    await state.evaluate(({ scene, engine }) => {
      scene.groups[0].muted = true;
      engine.sync(scene);
    });
    await expect.poll(level).toBeLessThan(0.0001);
    await state.evaluate(({ scene, engine }) => {
      scene.groups[0].muted = false;
      engine.sync(scene);
    });
    await expect.poll(level).toBeGreaterThan(0.001);
    await state.evaluate(({ engine }) => engine.stop());
    await expect.poll(level).toBeLessThan(0.0001);
  } finally {
    await state.evaluate(async ({ engine, receiver }) => {
      await engine.dispose();
      await receiver.close();
    });
    await state.dispose();
  }
});
