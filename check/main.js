// The workflow's entry (.github/workflows/check.yml): `node check/main.js` in
// the base branch's checkout, on pull_request_target.
//
// GITHUB_EVENT_PATH, GITHUB_TOKEN and GITHUB_API_URL come from Actions;
// THEME_SCHEMA_URL may point at another copy of the schema (by default the
// published one). Fails (exit code 1) when the PR breaks a rule.

import { readFileSync } from 'node:fs';
import { runCheck } from './run.js';
import { SCHEMA_URL } from './theme-format.js';

const { GITHUB_EVENT_PATH, GITHUB_TOKEN, GITHUB_API_URL, THEME_SCHEMA_URL } = process.env;
if (!GITHUB_EVENT_PATH || !GITHUB_TOKEN) {
  console.error('GITHUB_EVENT_PATH and GITHUB_TOKEN are needed (the check runs in GitHub Actions).');
  process.exit(2);
}

const result = await runCheck({
  event: JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf8')),
  fetch: globalThis.fetch,
  token: GITHUB_TOKEN,
  apiUrl: GITHUB_API_URL || undefined,
  schemaUrl: THEME_SCHEMA_URL || SCHEMA_URL,
  baseDir: process.cwd(),
});

// One JSON line per problem: a path from the PR cannot start a line, so it
// cannot be read as a workflow command (`::…`).
for (const problem of result.problems) console.log(JSON.stringify(problem));
console.log(result.ok ? 'The theme check passed.' : `The theme check failed: ${result.problems.length} problem(s).`);
process.exitCode = result.ok ? 0 : 1;
