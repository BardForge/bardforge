// Runs only after every required check succeeds; uses Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const version = process.env.RELEASE_VERSION;
const sha = process.env.RELEASE_COMMIT;
assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
assert.match(sha, /^[a-f0-9]{40}$/);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sha);
assert.equal(
  execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  '',
  'Checks changed tracked/source files',
);
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
assert.equal(event.inputs.qa_commit, sha);
assert.equal(String(event.inputs.audio_qa_passed), 'true');
assert.equal(String(event.inputs.foundry_qa_passed), 'true');
const installer = `BardForge-Studio-Setup-${version}.exe`;
const target = path.resolve('release-bundle');
assert.ok(!fs.existsSync(target), 'Refuse to mix new artifacts with an existing bundle');
fs.mkdirSync(target);
const hash = (bytes, algorithm = 'sha256', encoding = 'hex') =>
  createHash(algorithm).update(bytes).digest(encoding);
const exe = fs.readFileSync(path.join('build', installer));
assert.ok(exe.length > 1_000_000 && exe.length < 1024 * 1024 * 1024, 'Unexpected installer size');
assert.equal(exe.subarray(0, 2).toString(), 'MZ');
const metadata = fs.readFileSync('build/latest.yml', 'utf8');
const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sha512 = hash(exe, 'sha512', 'base64');
// Intentionally strict for the current full NSIS installer (no differential package).
// If electron-builder changes this schema, review and update this validator explicitly.
const expected = new RegExp(
  `^version: ${escaped(version)}\nfiles:\n  - url: ${escaped(installer)}\n    sha512: ${escaped(sha512)}\n(?:    size: ${exe.length}\n)?path: ${escaped(installer)}\nsha512: ${escaped(sha512)}\nreleaseDate: '[0-9T:.Z-]+'\n?$`,
);
assert.match(
  metadata.replaceAll('\r\n', '\n'),
  expected,
  'latest.yml must describe exactly this installer, version and SHA-512',
);
const committedNotes = execFileSync('git', ['show', `${sha}:docs/releases/${version}.md`], {
  encoding: 'utf8',
});
const notes = `${committedNotes.trim()}\n\nSource commit: ${sha}\nBuild: https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}\n\nHuman QA was declared by ${process.env.GITHUB_ACTOR} for this commit. The environment reviewer must inspect the evidence before publication.\n`;
const manifest = {
  schema: 1,
  repository: process.env.GITHUB_REPOSITORY,
  version,
  commit: sha,
  workflowSha: process.env.RELEASE_WORKFLOW_SHA,
  runId: process.env.GITHUB_RUN_ID,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  actor: process.env.GITHUB_ACTOR,
  node: process.version,
  humanQa: {
    commit: event.inputs.qa_commit,
    audio: true,
    foundryRemotePlayer: true,
    evidence: event.inputs.qa_notes,
  },
  automatedChecks: [
    'lint',
    'format',
    'typecheck/build',
    'unit',
    'public-paths/secrets',
    'dependency-audit',
    'licenses',
    'browser',
    'two-context-transport',
    'packaged-desktop',
    'NSIS-install-launch-uninstall',
  ],
};
const content = new Map([
  [installer, exe],
  ['latest.yml', Buffer.from(metadata)],
  ['RELEASE_NOTES.md', Buffer.from(notes)],
  ['release-manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)],
]);
for (const [name, bytes] of content) fs.writeFileSync(path.join(target, name), bytes, { flag: 'wx' });
const sums = [...content].map(([name, bytes]) => `${hash(bytes)}  ${name}\n`).join('');
fs.writeFileSync(path.join(target, 'SHA256SUMS.txt'), sums, { flag: 'wx' });
fs.appendFileSync(process.env.GITHUB_OUTPUT, `checksum_manifest_sha256=${hash(sums)}\n`);
fs.appendFileSync(
  process.env.GITHUB_STEP_SUMMARY,
  `## Candidate release ${version}\n\nCommit: \`${sha}\`\n\nSHA256SUMS.txt: \`${hash(sums)}\`\n\nAll automated checks passed. Publication still requires the owner's review in environment \`release\`.\n`,
);
