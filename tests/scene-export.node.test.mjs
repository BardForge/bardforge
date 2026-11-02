import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { saveSceneArchive } = createRequire(import.meta.url)('../electron/scene-export.cjs');
const bytes = Buffer.from('BARDFORGE1\n0000test');

test('native scene export writes exact bytes and atomically replaces the chosen file', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'bardforge-export-'));
  try {
    const filePath = path.join(dir, 'scene.bardforge');
    await writeFile(filePath, 'old');
    assert.equal(
      await saveSceneArchive(bytes, 'scene.bardforge', async () => ({ canceled: false, filePath })),
      true,
    );
    assert.deepEqual(await readFile(filePath), bytes);
    assert.deepEqual(await readdir(dir), ['scene.bardforge']);
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    assert.ok(path.basename(dir).startsWith('bardforge-export-'));
    await rm(dir, { recursive: true, force: true });
  }
});

test('canceling native export does not write or report success', async () => {
  assert.equal(await saveSceneArchive(bytes, 'scene.bardforge', async () => ({ canceled: true })), false);
});

test('invalid export data and path-like default names never open the picker', async () => {
  let calls = 0;
  const picker = async () => {
    calls++;
    return { canceled: true };
  };
  await assert.rejects(saveSceneArchive(bytes, '../scene.bardforge', picker));
  await assert.rejects(saveSceneArchive(Buffer.from('not an archive'), 'scene.bardforge', picker));
  await assert.rejects(saveSceneArchive('raw string', 'scene.bardforge', picker));
  assert.equal(calls, 0);
});
