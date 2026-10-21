// A fake of the parts of the GitHub REST API the check uses, behind a fetch,
// and the published schema at its URL. It records every request.

import { schema } from './helpers.js';

export const SCHEMA_URL = 'https://sshterm.example/themes/schema/v1.json';
const API = 'https://api.github.test';
const BOT = 'github-actions[bot]';

/**
 * [repo] the gallery ('obutora/sshterm-themes'); [head] the fork's
 * full name; [files]: [{path, status, previousPath?, text?}] as the PR has
 * them; [comments]: the PR's comments, [{id, body, login}].
 */
export function fakeGitHub({ repo = 'obutora/sshterm-themes', head = 'alice/sshterm-themes', number = 7, sha = 'abc123', files = [], comments = [] } = {}) {
  const requests = [];
  let nextId = 1000;
  const json = (body, status = 200, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

  async function fetch(input, init = {}) {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ method, url: url.href, headers: init.headers ?? {}, body });
    if (url.href === SCHEMA_URL) return json(schema);
    if (url.origin !== API) throw new Error(`unexpected request: ${url.href}`);

    const path = url.pathname;
    if (method === 'GET' && path === `/repos/${repo}/pulls/${number}/files`) {
      const page = Number(url.searchParams.get('page') ?? 1);
      const perPage = Number(url.searchParams.get('per_page') ?? 30);
      const slice = files.slice((page - 1) * perPage, page * perPage);
      return json(slice.map((f) => ({
        filename: f.path,
        status: f.status,
        ...(f.previousPath ? { previous_filename: f.previousPath } : {}),
      })));
    }
    const contents = `/repos/${head}/contents/`;
    if (method === 'GET' && path.startsWith(contents)) {
      const file = files.find((f) => f.path === decodeURIComponent(path.slice(contents.length)));
      if (!file || file.status === 'removed' || url.searchParams.get('ref') !== sha) {
        return json({ message: 'Not Found' }, 404);
      }
      return new Response(file.text, { headers: { 'content-type': 'application/vnd.github.raw' } });
    }
    if (path === `/repos/${repo}/issues/${number}/comments`) {
      if (method === 'GET') {
        return json(comments.map((c) => ({ id: c.id, body: c.body, user: { login: c.login } })));
      }
      if (method === 'POST') {
        const comment = { id: nextId++, body: body.body, login: BOT };
        comments.push(comment);
        return json({ id: comment.id }, 201);
      }
    }
    const edit = path.match(new RegExp(`^/repos/${repo}/issues/comments/(\\d+)$`));
    if (method === 'PATCH' && edit) {
      const comment = comments.find((c) => c.id === Number(edit[1]));
      if (!comment || comment.login !== BOT) return json({ message: 'Forbidden' }, 403);
      comment.body = body.body;
      return json({ id: comment.id });
    }
    throw new Error(`unexpected request: ${method} ${url.href}`);
  }

  const event = {
    number,
    repository: { full_name: repo },
    pull_request: {
      number,
      user: { login: 'alice' },
      head: { sha, repo: { full_name: head } },
    },
  };
  return { fetch, requests, comments, event, api: API, bot: BOT };
}
