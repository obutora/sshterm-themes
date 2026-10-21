// The check of a PR to the gallery, as the workflow runs it (on
// pull_request_target, from the base branch's checkout). The PR's files are
// only read as data over the API; nothing of the PR is checked out or run.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020Module from 'ajv/dist/2020.js';
import { checkPullRequest } from './rules.js';
import { gitHub } from './github.js';
import { commentBody } from './comment.js';

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;

/** Marks the check's own comment on a PR (the one it keeps up to date). */
export const MARKER = '<!-- sshterm-themes-check -->';
/** The account GITHUB_TOKEN comments as. */
export const BOT_LOGIN = 'github-actions[bot]';

/** The gallery's files in a checkout: [{path, bytes}] for themes/<dir>/<file>. */
export function galleryFiles(dir) {
  const root = join(dir, 'themes');
  if (!existsSync(root)) return [];
  const files = [];
  for (const owner of readdirSync(root, { withFileTypes: true })) {
    if (!owner.isDirectory()) continue;
    for (const file of readdirSync(join(root, owner.name), { withFileTypes: true })) {
      if (!file.isFile()) continue;
      const path = `themes/${owner.name}/${file.name}`;
      files.push({ path, bytes: new Uint8Array(readFileSync(join(dir, path))) });
    }
  }
  return files;
}

/** The published JSON Schema at [url], compiled. */
async function loadSchema(fetch, url) {
  const response = await fetch(url, { headers: { accept: 'application/schema+json, application/json' } });
  if (!response.ok) throw new Error(`GET ${url}: ${response.status}`);
  return new Ajv2020({ allErrors: true }).compile(await response.json());
}

/**
 * Checks the PR of a pull_request_target [event] and leaves the verdict on
 * it: a failing PR gets one comment (the check's earlier comment, edited, if
 * there is one); a passing PR edits that comment to say so, if there is one.
 * [baseDir] is the base branch's checkout. Returns {ok, problems}.
 */
export async function runCheck({ event, fetch, token, apiUrl, schemaUrl, baseDir }) {
  const api = gitHub({ fetch, token, apiUrl });
  const repo = event.repository.full_name;
  const pr = event.pull_request;
  const author = pr.user.login;
  // A deleted fork leaves no head repository; its commits are still in ours.
  const headRepo = pr.head.repo?.full_name ?? repo;

  const validateSchema = await loadSchema(fetch, schemaUrl);
  const listed = await api.pullFiles(repo, pr.number);
  const files = [];
  for (const file of listed) {
    const wanted = file.status !== 'removed' && file.path.startsWith(`themes/${author}/`);
    files.push(wanted ? { ...file, bytes: await api.fileAt(headRepo, file.path, pr.head.sha) } : file);
  }
  const result = checkPullRequest({ author, files, base: galleryFiles(baseDir), validateSchema });

  const ours = (await api.comments(repo, pr.number))
    .find((c) => c.login === BOT_LOGIN && c.body?.includes(MARKER));
  const body = `${MARKER}\n${commentBody(result, { author, repo })}`;
  if (ours) await api.updateComment(repo, ours.id, body);
  else if (!result.ok) await api.createComment(repo, pr.number, body);
  return result;
}
