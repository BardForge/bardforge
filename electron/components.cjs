const fs = require('node:fs/promises');
const { createReadStream, createWriteStream } = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const yauzl = require('yauzl');
const catalog = require('./catalog.json');

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function downloadVerified(item, file, signal, progress, request = fetch) {
  let received = await fs.stat(file).then(
    (s) => s.size,
    () => 0,
  );
  if (received > item.bytes) {
    await fs.unlink(file);
    received = 0;
  }
  if (received < item.bytes) {
    const response = await request(item.url, {
      headers: received
        ? { Range: `bytes=${received}-`, 'Accept-Encoding': 'identity' }
        : { 'Accept-Encoding': 'identity' },
      signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
      redirect: 'error',
    });
    if (response.status !== 200 && response.status !== 206) throw new Error(`HTTP ${response.status}`);
    if (response.status === 206) {
      const range = response.headers.get('content-range');
      if (range !== `bytes ${received}-${item.bytes - 1}/${item.bytes}`)
        throw new Error('Invalid download range');
    } else received = 0;
    const handle = await fs.open(file, received ? 'a' : 'w');
    try {
      for await (const chunk of response.body) {
        signal.throwIfAborted();
        if (received + chunk.length > item.bytes) throw new Error('Download size exceeds manifest');
        await handle.writeFile(chunk);
        received += chunk.length;
        progress(received);
      }
    } finally {
      await handle.close();
    }
  }
  signal.throwIfAborted();
  if (received !== item.bytes) throw new Error('Incomplete download');
  if ((await digest(file)) !== item.sha256) {
    await fs.unlink(file);
    throw new Error('Download checksum mismatch');
  }
}

function safeEntry(entry) {
  const name = entry.fileName;
  const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
  if (
    !name ||
    name.includes('\\') ||
    name.includes(':') ||
    name.startsWith('/') ||
    name
      .replace(/\/$/, '')
      .split('/')
      .some(
        (part) =>
          !part ||
          part === '.' ||
          part === '..' ||
          /[. ]$/.test(part) ||
          /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part),
      ) ||
    (mode && mode !== 0o100000 && mode !== 0o040000)
  )
    throw new Error('Unsafe archive entry');
  return name;
}

async function extractVerified(file, directory, signal) {
  const zip = await promisify(yauzl.open)(file, { lazyEntries: true });
  let count = 0;
  let total = 0;
  await new Promise((resolve, reject) => {
    const fail = (error) => {
      zip.close();
      reject(error);
    };
    zip.on('error', fail);
    zip.on('end', resolve);
    zip.on('entry', async (entry) => {
      try {
        signal.throwIfAborted();
        const name = safeEntry(entry);
        total += entry.uncompressedSize;
        if (++count > 4000 || total > 512 * 1024 * 1024) throw new Error('Archive exceeds extraction limits');
        const target = path.resolve(directory, name);
        if (!target.startsWith(directory + path.sep)) throw new Error('Unsafe archive target');
        if (name.endsWith('/')) await fs.mkdir(target, { recursive: true });
        else {
          await fs.mkdir(path.dirname(target), { recursive: true });
          const stream = await promisify(zip.openReadStream.bind(zip))(entry);
          await pipeline(stream, createWriteStream(target, { flags: 'wx' }), { signal });
        }
        zip.readEntry();
      } catch (error) {
        fail(error);
      }
    });
    zip.readEntry();
  });
}

class ComponentManager {
  constructor(root) {
    this.root = path.resolve(root, 'components');
    this.states = new Map();
    this.active = new Map();
  }
  directory(item) {
    return path.join(this.root, `${item.id}-${item.version}`);
  }
  async installed(item) {
    try {
      const marker = JSON.parse(
        await fs.readFile(path.join(this.directory(item), '.installed.json'), 'utf8'),
      );
      await fs.access(path.join(this.directory(item), item.entrypoint));
      return marker.sha256 === item.sha256;
    } catch {
      return false;
    }
  }
  async list() {
    return Promise.all(
      catalog.map(async (item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        bytes: item.bytes,
        version: item.version,
        status: (await this.installed(item)) ? 'installed' : 'available',
        received: 0,
        ...this.states.get(item.id),
      })),
    );
  }
  cancel(id) {
    this.active.get(id)?.abort();
  }
  async ensureInstalled(id) {
    const item = catalog.find((entry) => entry.id === id);
    if (!item || item.platform !== process.platform || item.arch !== process.arch)
      throw new Error('Unsupported component');
    if (this.active.has(id)) return;
    const controller = new AbortController();
    this.active.set(id, controller);
    const state = (status, extra = {}) => this.states.set(id, { status, ...extra });
    let staging;
    try {
      if (await this.installed(item)) {
        state('installed', { received: item.bytes });
        return this.directory(item);
      }
      state('downloading', { received: 0 });
      await fs.mkdir(this.root, { recursive: true });
      const space = await fs.statfs(this.root);
      if (space.bavail * space.bsize < item.bytes * 5) throw new Error('Недостаточно места на диске');
      const archive = path.join(this.root, `${id}-${item.version}.part`);
      await downloadVerified(item, archive, controller.signal, (received) =>
        state('downloading', { received }),
      );
      state('installing', { received: item.bytes });
      staging = await fs.mkdtemp(path.join(this.root, `${id}-staging-`));
      await extractVerified(archive, staging, controller.signal);
      controller.signal.throwIfAborted();
      // Execute only the pinned, verified runtime, never renderer-supplied commands.
      if (id === 'python') {
        const { stdout } = await promisify(execFile)(
          path.join(staging, item.entrypoint),
          ['-I', '-c', 'import sys; print(sys.version.split()[0])'],
          { windowsHide: true, timeout: 15_000 },
        );
        if (stdout.trim() !== item.version) throw new Error('Runtime verification failed');
      }
      controller.signal.throwIfAborted();
      await fs.writeFile(path.join(staging, '.installed.json'), JSON.stringify({ sha256: item.sha256 }));
      // An existing invalid installation is retained for diagnosis, never overwritten.
      const destination = this.directory(item);
      if (
        await fs.stat(destination).then(
          () => true,
          () => false,
        )
      ) {
        await fs.rename(destination, `${destination}-previous-${Date.now()}`);
      }
      await fs.rename(staging, destination);
      staging = undefined;
      await fs.unlink(archive).catch(() => {});
      state('installed', { received: item.bytes });
      return destination;
    } catch (error) {
      state(controller.signal.aborted ? 'paused' : 'error', {
        message: controller.signal.aborted
          ? 'Загрузка приостановлена. Можно продолжить.'
          : `Не удалось подготовить компонент. Проверьте сеть и место на диске, затем повторите. (${error.message})`,
      });
    } finally {
      if (staging && path.dirname(staging) === this.root)
        await fs.rm(staging, { recursive: true, force: true });
      this.active.delete(id);
    }
  }
}

module.exports = { ComponentManager, downloadVerified, safeEntry, extractVerified };
