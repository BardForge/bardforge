const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

async function saveSceneArchive(bytes, name, choosePath) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength < 15 ||
    bytes.byteLength > 256 * 1024 * 1024 ||
    Buffer.from(bytes.subarray(0, 11)).toString() !== 'BARDFORGE1\n'
  )
    throw new Error('Invalid archive');
  if (
    typeof name !== 'string' ||
    name.length > 120 ||
    path.basename(name) !== name ||
    !name.endsWith('.bardforge') ||
    /[<>:"/\\|?*]/.test(name) ||
    [...name].some((char) => char.charCodeAt(0) < 32)
  )
    throw new Error('Invalid filename');
  const { canceled, filePath } = await choosePath(name);
  if (canceled || !filePath) return false;
  const temporary = path.join(path.dirname(filePath), `.bardforge-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, bytes, { flag: 'wx' });
    await fs.rename(temporary, filePath);
    return true;
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
module.exports = { saveSceneArchive };
