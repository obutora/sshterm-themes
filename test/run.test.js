// The check of a PR end to end (check/run.js), against a fake GitHub API: it
// takes the PR's files as data over the API, the gallery from the base
// branch's checkout, and leaves its verdict in one comment.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCheck, MARKER } from '../check/run.js';
import { fakeGitHub, SCHEMA_URL } from './fake-github.js';
import { ALICE_ID, BOB_ID, themeDoc } from './helpers.js';

const OWN = `themes/alice/${ALICE_ID}.json`;
const text = (doc) => JSON.stringify(doc, null, 2);

/** A base branch's checkout with [files]: {path: text}. */
function baseCheckout(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sshterm-themes-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

const run = (gh, baseDir = baseCheckout()) =>
  runCheck({ event: gh.event, fetch: gh.fetch, token: 'tkn', apiUrl: gh.api, schemaUrl: SCHEMA_URL, baseDir });

test('a valid theme passes, read from the fork at the PR\'s head, and leaves no comment', async () => {
  const gh = fakeGitHub({ files: [{ path: OWN, status: 'added', text: text(themeDoc()) }] });
  const result = await run(gh);
  assert.equal(result.ok, true);
  assert.deepEqual(gh.comments, []);
  const read = gh.requests.find((r) => r.url.includes('/contents/'));
  assert.equal(read.url, `${gh.api}/repos/alice/sshterm-themes/contents/${OWN}?ref=abc123`);
  assert.equal(read.headers.authorization, 'Bearer tkn');
});

const badFiles = () => [
  { path: OWN, status: 'added', text: text(themeDoc({ colors: { foreground: '#737373', background: '#000000' } })) },
  { path: '.github/workflows/check.yml', status: 'modified', text: 'on: push' },
];

test('a failing PR gets one comment saying which file broke which rule', async () => {
  const gh = fakeGitHub({ files: badFiles() });
  const result = await run(gh);
  assert.equal(result.ok, false);
  assert.equal(gh.comments.length, 1);
  const { body } = gh.comments[0];
  assert.ok(body.startsWith(MARKER));
  assert.match(body, new RegExp(`\`${OWN}\`.*4\\.42:1`));
  assert.match(body, /`\.github\/workflows\/check\.yml`.*only themes\//);
  // The workflow's file was never read: only the theme's.
  const reads = gh.requests.filter((r) => r.url.includes('/contents/'));
  assert.deepEqual(reads.map((r) => new URL(r.url).pathname), [`/repos/alice/sshterm-themes/contents/${OWN}`]);
});

test('failing again edits the check\'s comment instead of adding one', async () => {
  const gh = fakeGitHub({
    files: badFiles(),
    comments: [
      { id: 1, login: 'alice', body: `${MARKER}\nnot the bot` },
      { id: 2, login: 'github-actions[bot]', body: `${MARKER}\nold` },
    ],
  });
  await run(gh);
  assert.deepEqual(gh.comments.map((c) => c.id), [1, 2]);
  assert.equal(gh.comments[0].body, `${MARKER}\nnot the bot`);
  assert.match(gh.comments[1].body, /4\.42:1/);
});

test('passing after a failure edits the comment to say it passes', async () => {
  const gh = fakeGitHub({
    files: [{ path: OWN, status: 'added', text: text(themeDoc()) }],
    comments: [{ id: 2, login: 'github-actions[bot]', body: `${MARKER}\nold` }],
  });
  assert.equal((await run(gh)).ok, true);
  assert.equal(gh.comments.length, 1);
  assert.match(gh.comments[0].body, /passed/);
});

test('the gallery is read from the base checkout', async () => {
  const bobs = `themes/bob/${BOB_ID}.json`;
  const gh = fakeGitHub({ files: [{ path: OWN, status: 'added', text: text(themeDoc({ name: 'TIDE' })) }] });
  const result = await run(gh, baseCheckout({ [bobs]: text(themeDoc({ id: BOB_ID, author: 'Bob' })) }));
  assert.deepEqual(result.problems.map((p) => [p.rule, p.by]), [['nameTaken', bobs]]);
  assert.match(gh.comments[0].body, new RegExp(`TIDE.*\`${bobs}\``));
});

test('all pages of a large PR\'s files are checked', async () => {
  const files = Array.from({ length: 150 }, (_, i) => ({ path: `docs/${i}.md`, status: 'added', text: 'x' }));
  const result = await run(fakeGitHub({ files }));
  assert.equal(result.problems.length, 150);
});

test('a file far over 64 KB is read only as far as the limit', async () => {
  const gh = fakeGitHub({ files: [{ path: OWN, status: 'added', text: ' '.repeat(10 * 1024 * 1024) }] });
  const result = await run(gh);
  assert.deepEqual(result.problems.map((p) => p.reason), ['tooLarge']);
});

test('a file name cannot break out of the comment\'s code spans', async () => {
  const path = 'docs/a`@obutora [x](https://evil.test)\n# b.md';
  const gh = fakeGitHub({ files: [{ path, status: 'added', text: 'x' }] });
  await run(gh);
  const line = gh.comments[0].body.split('\n').find((l) => l.startsWith('- '));
  assert.equal(line.split('`').length, 3, line);
  assert.ok(line.includes("a'@obutora [x](https://evil.test) # b.md"), line);
});
