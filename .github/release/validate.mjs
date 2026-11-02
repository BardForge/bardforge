// Fail closed unless the owner dispatches an immutable, tested stable main commit.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const OWNER = 'ShinozakiAichi';
const REPOSITORY = `${OWNER}/BardForge-Studio`;
const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const input = event.inputs ?? {};
assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
assert.equal(process.env.GITHUB_REPOSITORY, REPOSITORY);
assert.equal(process.env.GITHUB_ACTOR, OWNER);
assert.equal(process.env.GITHUB_TRIGGERING_ACTOR, OWNER);
assert.equal(event.sender?.login, OWNER);
const sha = process.env.GITHUB_SHA;
assert.match(sha, /^[a-f0-9]{40}$/);
assert.equal(process.env.RELEASE_WORKFLOW_SHA, sha);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sha);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
assert.match(
  pkg.version,
  stable,
  'package.json must contain stable X.Y.Z, without prerelease/build metadata',
);
assert.equal(input.version, pkg.version, 'Dispatch version must equal the immutable commit package version');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages?.['']?.version, pkg.version);
assert.equal(input.qa_commit, sha, 'Human QA must refer to this exact commit');
assert.equal(String(input.audio_qa_passed), 'true', 'Real listening must be confirmed by the owner');
assert.equal(
  String(input.foundry_qa_passed),
  'true',
  'Real remote Foundry QA must be confirmed by the owner',
);
assert.ok(
  typeof input.qa_notes === 'string' && input.qa_notes.trim().length >= 20 && input.qa_notes.length <= 4000,
  'Supply a short QA evidence description/link without credentials or personal data',
);
const changelog = execFileSync('git', ['show', `${sha}:CHANGELOG.md`], { encoding: 'utf8' });
const heading = new RegExp(`^## \\[${pkg.version.replaceAll('.', '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm');
assert.match(changelog, heading, 'CHANGELOG.md needs a dated ## [X.Y.Z] - YYYY-MM-DD entry');
const notes = execFileSync('git', ['show', `${sha}:docs/releases/${pkg.version}.md`], { encoding: 'utf8' });
assert.ok(notes.trim().length >= 80, 'Commit meaningful versioned release notes before dispatch');
fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${pkg.version}\ncommit=${sha}\n`);
console.log(
  `Validated stable ${pkg.version} at ${sha}; human QA declarations are not automated test results.`,
);
