// Building blocks for the tests: theme files as a PR would bring them.

import { readFileSync } from 'node:fs';
import Ajv2020Module from 'ajv/dist/2020.js';

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;

/** The published schema, as vendored from sshterm-open for the tests. */
export const schema = JSON.parse(
  readFileSync(new URL('./fixtures/schema-v1.json', import.meta.url), 'utf8'),
);
export const validateSchema = new Ajv2020({ allErrors: true }).compile(schema);

export const ALICE_ID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427';
export const BOB_ID = '6fa459ea-ee8a-4ca4-894e-db77e160355e';
export const CAROL_ID = '16fd2706-8baf-433b-82eb-8c7fada847da';

const COLORS = {
  foreground: '#F8F8F2',
  background: '#1E1F29',
  black: '#21222C', red: '#FF5555', green: '#50FA7B', yellow: '#F1FA8C',
  blue: '#BD93F9', magenta: '#FF79C6', cyan: '#8BE9FD', white: '#F8F8F2',
  brightBlack: '#6272A4', brightRed: '#FF6E6E', brightGreen: '#69FF94',
  brightYellow: '#FFFFA5', brightBlue: '#D6ACFF', brightMagenta: '#FF92DF',
  brightCyan: '#A4FFFF', brightWhite: '#FFFFFF',
};

/** One theme's v1 document, with [changes] over a valid theme. */
export function themeDoc({ id = ALICE_ID, name = 'Tide', author = 'Alice', colors = {}, ...rest } = {}) {
  return {
    format: 'ssh-term-theme',
    formatVersion: 1,
    themes: [{ id, name, author, license: 'CC-BY-4.0', colors: { ...COLORS, ...colors }, ...rest }],
  };
}

export const bytesOf = (doc) =>
  new TextEncoder().encode(typeof doc === 'string' ? doc : JSON.stringify(doc, null, 2));

/** A file the PR adds (or [status]s). */
export function prFile(path, doc, status = 'added') {
  return { path, status, bytes: doc === undefined ? undefined : bytesOf(doc) };
}

/** A file already in the gallery. */
export function baseFile(path, doc) {
  return { path, bytes: bytesOf(doc) };
}
