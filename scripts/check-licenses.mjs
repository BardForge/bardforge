import { readFileSync } from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const allowed = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'CC0-1.0']);
let failed = false;
for (const name of [...Object.keys(pkg.dependencies), 'electron']) {
  const dependency = JSON.parse(readFileSync(path.join('node_modules', name, 'package.json'), 'utf8'));
  console.log(`${name}@${dependency.version}: ${dependency.license ?? 'UNKNOWN'}`);
  if (!allowed.has(dependency.license)) failed = true;
}
if (failed) {
  console.error('A distributed direct dependency needs a manual license review.');
  process.exitCode = 1;
} else
  console.log(
    'PASS: distributed direct dependencies declare permitted license identifiers. Transitive notices remain in the Electron distribution.',
  );
