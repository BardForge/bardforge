import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs
  .readFileSync(new URL('../.github/release/validate.mjs', import.meta.url), 'utf8')
  .replace(/^import .+;\r?\n/gm, '');
const sha = 'a'.repeat(40);

function validate({ version = '0.1.0', input = {}, env = {}, lockVersion = version, changelog = true } = {}) {
  const writes = [];
  const event = {
    sender: { login: 'ShinozakiAichi' },
    inputs: {
      version,
      qa_commit: sha,
      audio_qa_passed: 'true',
      foundry_qa_passed: 'true',
      qa_notes: 'Owner listened to exact build and verified a remote player.',
      ...input,
    },
  };
  const files = {
    event: JSON.stringify(event),
    'package.json': JSON.stringify({ version }),
    'package-lock.json': JSON.stringify({ version: lockVersion, packages: { '': { version: lockVersion } } }),
  };
  vm.runInNewContext(source, {
    assert,
    fs: {
      readFileSync: (name) => {
        assert.ok(Object.hasOwn(files, name), `Unexpected read: ${name}`);
        return files[name];
      },
      appendFileSync: (name, value) => writes.push([name, value]),
    },
    execFileSync: (command, args) => {
      assert.equal(command, 'git');
      if (args.join(' ') === 'rev-parse HEAD') return sha;
      if (args[1] === `${sha}:CHANGELOG.md`) return changelog ? `## [${version}] - 2026-11-02\n` : '';
      if (args[1] === `${sha}:docs/releases/${version}.md`) return 'Meaningful release notes. '.repeat(5);
      throw new Error('Unexpected command');
    },
    console: { log() {} },
    process: {
      env: {
        GITHUB_EVENT_PATH: 'event',
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_REF: 'refs/heads/main',
        GITHUB_REPOSITORY: 'ShinozakiAichi/BardForge-Studio',
        GITHUB_ACTOR: 'ShinozakiAichi',
        GITHUB_TRIGGERING_ACTOR: 'ShinozakiAichi',
        GITHUB_SHA: sha,
        RELEASE_WORKFLOW_SHA: sha,
        GITHUB_OUTPUT: 'output',
        ...env,
      },
    },
  });
  return writes;
}

test('release gate accepts matching stable commit and explicit owner QA', () => {
  assert.deepEqual(validate(), [['output', `version=0.1.0\ncommit=${sha}\n`]]);
});

test('release gate rejects development builds, lockfile drift and absent release notes entry', () => {
  for (const options of [{ version: '0.1.0-dev.3' }, { lockVersion: '0.0.9' }, { changelog: false }]) {
    assert.throws(() => validate(options));
  }
});

test('release gate rejects other actors, branches and triggering workflows', () => {
  for (const env of [
    { GITHUB_ACTOR: 'contributor' },
    { GITHUB_TRIGGERING_ACTOR: 'contributor' },
    { GITHUB_REF: 'refs/heads/dev' },
    { GITHUB_EVENT_NAME: 'push' },
    { RELEASE_WORKFLOW_SHA: 'b'.repeat(40) },
  ]) {
    assert.throws(() => validate({ env }));
  }
});

test('release gate rejects missing human QA or evidence for a different commit', () => {
  for (const input of [
    { audio_qa_passed: 'false' },
    { foundry_qa_passed: 'false' },
    { qa_commit: 'b'.repeat(40) },
    { qa_notes: '' },
    { version: '0.2.0' },
  ]) {
    assert.throws(() => validate({ input }));
  }
});
