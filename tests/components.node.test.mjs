import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { downloadVerified, safeEntry } from '../electron/components.cjs';

const bytes = Buffer.from('a verified component archive');
const item = {
  url: 'https://example.com/component.zip',
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
test('resumes a partial download and verifies its digest', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'bardforge-download-'));
  const file = path.join(dir, 'component.part');
  await writeFile(file, bytes.subarray(0, 8));
  await downloadVerified(
    item,
    file,
    new AbortController().signal,
    () => {},
    async (_url, options) => {
      assert.equal(options.headers.Range, 'bytes=8-');
      return new Response(bytes.subarray(8), {
        status: 206,
        headers: { 'Content-Range': `bytes 8-${bytes.length - 1}/${bytes.length}` },
      });
    },
  );
  assert.deepEqual(await readFile(file), bytes);
});
test('server ignoring Range restarts cleanly; corrupt archives are discarded', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'bardforge-download-'));
  const file = path.join(dir, 'component.part');
  await writeFile(file, bytes.subarray(0, 3));
  await downloadVerified(
    item,
    file,
    new AbortController().signal,
    () => {},
    async () => new Response(bytes),
  );
  assert.deepEqual(await readFile(file), bytes);
  await assert.rejects(
    downloadVerified({ ...item, sha256: '0'.repeat(64) }, file, new AbortController().signal, () => {}),
    /checksum/,
  );
  await assert.rejects(stat(file), { code: 'ENOENT' });
});
test('rejects archive traversal, ADS, symlinks and special device filenames', () => {
  for (const name of ['../bad', '/bad', 'C:/bad', 'test:stream', 'foo/CON', 'a\\b', 'name.']) {
    assert.throws(() => safeEntry({ fileName: name, externalFileAttributes: 0 }), /Unsafe/);
  }
  assert.throws(() => safeEntry({ fileName: 'link', externalFileAttributes: 0o120777 << 16 }), /Unsafe/);
  assert.equal(safeEntry({ fileName: 'Lib/hello.py', externalFileAttributes: 0 }), 'Lib/hello.py');
});

test('cancelling a download retains partial bytes that a retry can resume', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'bardforge-download-'));
  const file = path.join(dir, 'component.part');
  const controller = new AbortController();
  const response = new Response(
    new ReadableStream({
      start(stream) {
        stream.enqueue(bytes.subarray(0, 8));
        stream.enqueue(bytes.subarray(8));
        stream.close();
      },
    }),
  );
  await assert.rejects(
    downloadVerified(
      item,
      file,
      controller.signal,
      () => controller.abort(),
      async () => response,
    ),
    { name: 'AbortError' },
  );
  assert.deepEqual(await readFile(file), bytes.subarray(0, 8));
  await downloadVerified(
    item,
    file,
    new AbortController().signal,
    () => {},
    async (_url, options) => {
      assert.equal(options.headers.Range, 'bytes=8-');
      return new Response(bytes.subarray(8), {
        status: 206,
        headers: { 'Content-Range': `bytes 8-${bytes.length - 1}/${bytes.length}` },
      });
    },
  );
  assert.deepEqual(await readFile(file), bytes);
});
