// The gallery's rules for a PR (check/rules.js): what the CI lets in.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPullRequest } from '../check/rules.js';
import { ALICE_ID, BOB_ID, CAROL_ID, themeDoc, prFile, baseFile, validateSchema } from './helpers.js';

const check = ({ author = 'alice', files, base = [] }) =>
  checkPullRequest({ author, files, base, validateSchema });

test('a valid theme added in the author\'s own directory passes', () => {
  const result = check({ files: [prFile(`themes/alice/${ALICE_ID}.json`, themeDoc())] });
  assert.deepEqual(result, { ok: true, problems: [] });
});

/** The rules a result broke, as [path, rule] pairs. */
const broken = (result) => result.problems.map((p) => [p.path, p.rule]);

test('a theme in another user\'s directory fails', () => {
  const path = `themes/bob/${ALICE_ID}.json`;
  const result = check({ files: [prFile(path, themeDoc())] });
  assert.equal(result.ok, false);
  assert.deepEqual(broken(result), [[path, 'notOwnDirectory']]);
});

test('the directory must be the login exactly, not another case of it', () => {
  const path = `themes/Alice/${ALICE_ID}.json`;
  assert.deepEqual(broken(check({ files: [prFile(path, themeDoc())] })), [[path, 'notOwnDirectory']]);
});

test('a file outside themes/ fails', () => {
  for (const path of ['README.md', `${ALICE_ID}.json`, 'check/rules.js', 'themesx/alice/a.json']) {
    assert.deepEqual(broken(check({ files: [prFile(path, 'x', 'modified')] })), [[path, 'outsideThemes']], path);
  }
});

test('a change to .github/ fails', () => {
  const path = '.github/workflows/check.yml';
  assert.deepEqual(broken(check({ files: [prFile(path, 'on: push', 'modified')] })), [[path, 'outsideThemes']]);
});

test('removing a theme fails, even the author\'s own', () => {
  const path = `themes/alice/${ALICE_ID}.json`;
  assert.deepEqual(broken(check({ files: [prFile(path, undefined, 'removed')] })), [[path, 'removed']]);
});

test('renaming a theme fails as the removal of the old path', () => {
  const path = `themes/alice/${ALICE_ID}.json`;
  const file = { ...prFile(path, themeDoc(), 'renamed'), previousPath: `themes/bob/${ALICE_ID}.json` };
  assert.deepEqual(broken(check({ files: [file] })), [[`themes/bob/${ALICE_ID}.json`, 'removed']]);
});

test('a file name that is not a lowercase UUID v4 with .json fails', () => {
  for (const name of [
    'tide.json',
    `${ALICE_ID.toUpperCase()}.json`,
    `${ALICE_ID}.JSON`,
    `${ALICE_ID}.json5`,
    ALICE_ID,
    '1b4e28ba-2fa1-11d2-883f-0016d3cca427.json', // v1
    `nested/${ALICE_ID}.json`,
  ]) {
    const path = `themes/alice/${name}`;
    assert.deepEqual(broken(check({ files: [prFile(path, themeDoc())] })), [[path, 'badFileName']], name);
  }
});

test('changing the author\'s own theme passes', () => {
  const path = `themes/alice/${ALICE_ID}.json`;
  assert.equal(check({ files: [prFile(path, themeDoc({ name: 'Tide 2' }), 'modified')] }).ok, true);
});

const OWN = `themes/alice/${ALICE_ID}.json`;

test('a file whose name is not the id inside fails', () => {
  const result = check({ files: [prFile(OWN, themeDoc({ id: BOB_ID }))] });
  assert.deepEqual(broken(result), [[OWN, 'idMismatch']]);
  assert.equal(result.problems[0].id, BOB_ID);
});

test('a file that is not a valid v1 document fails with the app\'s reason', () => {
  for (const [doc, reason, field] of [
    ['{"format": ', 'notJson', null],
    [{ ...themeDoc(), extra: 1 }, 'unknownField', 'extra'],
    [themeDoc({ colors: { red: 'red' } }), 'badColor', 'colors.red'],
    [themeDoc({ name: 'a\u202Eb' }), 'badText', 'name'],
    [{ ...themeDoc(), formatVersion: 2 }, 'newerVersion', 'formatVersion'],
  ]) {
    const result = check({ files: [prFile(OWN, doc)] });
    assert.deepEqual(broken(result), [[OWN, 'invalidTheme']], reason);
    assert.equal(result.problems[0].reason, reason);
    assert.equal(result.problems[0].field, field);
  }
});

test('a file over 64 KB fails', () => {
  const doc = JSON.stringify(themeDoc()) + ' '.repeat(64 * 1024);
  const result = check({ files: [prFile(OWN, doc)] });
  assert.deepEqual(broken(result), [[OWN, 'invalidTheme']]);
  assert.equal(result.problems[0].reason, 'tooLarge');
});

test('a document the app takes but the schema does not fails on the schema', () => {
  // Trimmed, the name is 40 code points (the app takes it); the schema counts
  // the spaces too.
  const result = check({ files: [prFile(OWN, themeDoc({ name: ` ${'a'.repeat(40)} ` }))] });
  assert.deepEqual(broken(result), [[OWN, 'schema']]);
  assert.match(result.problems[0].errors.join('\n'), /\/themes\/0\/name/);
});

test('a file with more than one theme fails', () => {
  const doc = themeDoc();
  doc.themes.push({ ...doc.themes[0], id: BOB_ID, name: 'Other' });
  assert.deepEqual(broken(check({ files: [prFile(OWN, doc)] })), [[OWN, 'notOneTheme']]);
});

const BOBS = `themes/bob/${BOB_ID}.json`;
const bobsTheme = (name) => baseFile(BOBS, themeDoc({ id: BOB_ID, name, author: 'Bob' }));

test('a name already in the gallery fails, compared after NFKC and case folding', () => {
  for (const [theirs, mine] of [
    ['Tide', 'Tide'],
    ['Tide', 'tIDE'],
    ['Tide', '  TIDE '],
    ['Tide', 'Ｔｉｄｅ'], // fullwidth
    ['Straße', 'STRASSE'],
    ['ﬁre', 'Fire'], // the ligature ﬁ
  ]) {
    const result = check({ files: [prFile(OWN, themeDoc({ name: mine }))], base: [bobsTheme(theirs)] });
    assert.deepEqual(broken(result), [[OWN, 'nameTaken']], `${theirs} / ${mine}`);
    assert.equal(result.problems[0].by, BOBS);
  }
});

test('names that differ beyond case and width are different', () => {
  for (const [theirs, mine] of [['Tide', 'Tides'], ['Tide', 'Tïde'], ['Tide', 'Ti de']]) {
    const result = check({ files: [prFile(OWN, themeDoc({ name: mine }))], base: [bobsTheme(theirs)] });
    assert.equal(result.ok, true, `${theirs} / ${mine}`);
  }
});

test('two themes in one PR with the same name fail', () => {
  const other = `themes/alice/${CAROL_ID}.json`;
  const result = check({
    files: [prFile(OWN, themeDoc()), prFile(other, themeDoc({ id: CAROL_ID, name: 'TIDE' }))],
  });
  assert.deepEqual(broken(result), [[other, 'nameTaken']]);
  assert.equal(result.problems[0].by, OWN);
});

test('changing a theme may keep its own name, and frees its old one', () => {
  const mine = baseFile(OWN, themeDoc({ name: 'Tide' }));
  assert.equal(check({ files: [prFile(OWN, themeDoc(), 'modified')], base: [mine] }).ok, true);
  const other = `themes/alice/${CAROL_ID}.json`;
  const result = check({
    files: [prFile(OWN, themeDoc({ name: 'Ebb' }), 'modified'), prFile(other, themeDoc({ id: CAROL_ID }))],
    base: [mine],
  });
  assert.equal(result.ok, true);
});

test('an id another account already has in the gallery fails', () => {
  const bobs = baseFile(`themes/bob/${ALICE_ID}.json`, themeDoc({ name: 'Other', author: 'Bob' }));
  const result = check({ files: [prFile(OWN, themeDoc())], base: [bobs] });
  assert.deepEqual(broken(result), [[OWN, 'idTaken']]);
  assert.equal(result.problems[0].by, `themes/bob/${ALICE_ID}.json`);
});

test('a 前景 and 背景 under 4.5:1 (WCAG contrast) fail', () => {
  for (const [foreground, background, ratio] of [
    ['#737373', '#000000', '4.43'], // 4.4:1
    ['#747474', '#000000', '4.49'],
    ['#777777', '#FFFFFF', '4.48'],
    ['#000000', '#000000', '1.00'],
    ['#FFFFFF00', '#000000', '1.00'], // a transparent 前景 shows the 背景
  ]) {
    const result = check({ files: [prFile(OWN, themeDoc({ colors: { foreground, background } }))] });
    assert.deepEqual(broken(result), [[OWN, 'lowContrast']], `${foreground} on ${background}`);
    assert.equal(result.problems[0].ratio.toFixed(2), ratio);
  }
});

test('a 前景 and 背景 at 4.5:1 or more pass', () => {
  for (const [foreground, background] of [
    ['#757575', '#000000'], // 4.56:1
    ['#767676', '#FFFFFF'], // 4.54:1
    ['#FFFFFF', '#000000'],
    ['#000000', '#FFFFFF'],
  ]) {
    const result = check({ files: [prFile(OWN, themeDoc({ colors: { foreground, background } }))] });
    assert.equal(result.ok, true, `${foreground} on ${background}`);
  }
});
