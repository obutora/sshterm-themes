// The few GitHub REST API calls the check makes, over a given fetch.

import { MAX_BYTES } from './theme-format.js';

const PER_PAGE = 100;
// GitHub lists at most 3000 files of a PR.
const MAX_PAGES = 30;

export function gitHub({ fetch, token, apiUrl = 'https://api.github.com' }) {
  const headers = (accept = 'application/vnd.github+json') => ({
    accept,
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2022-11-28',
  });

  async function call(method, path, body) {
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: { ...headers(), ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
    return response.json();
  }

  async function paged(path) {
    const all = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const items = await call('GET', `${path}?per_page=${PER_PAGE}&page=${page}`);
      all.push(...items);
      if (items.length < PER_PAGE) break;
    }
    return all;
  }

  return {
    /** The PR's files: [{path, status, previousPath?}]. */
    async pullFiles(repo, number) {
      const files = await paged(`/repos/${repo}/pulls/${number}/files`);
      return files.map((f) => ({
        path: f.filename,
        status: f.status,
        ...(f.previous_filename ? { previousPath: f.previous_filename } : {}),
      }));
    },

    /**
     * A file's bytes in [repo] at [ref], read no further than MAX_BYTES + 1
     * (enough to know it is too large).
     */
    async fileAt(repo, path, ref) {
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(
        `${apiUrl}/repos/${repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`,
        { headers: headers('application/vnd.github.raw+json') },
      );
      if (!response.ok) throw new Error(`GET ${path} at ${ref}: ${response.status} ${await response.text()}`);
      return readLimited(response.body, MAX_BYTES + 1);
    },

    /** The PR's comments: [{id, body, login}]. */
    async comments(repo, number) {
      const comments = await paged(`/repos/${repo}/issues/${number}/comments`);
      return comments.map((c) => ({ id: c.id, body: c.body, login: c.user?.login }));
    },

    createComment: (repo, number, body) => call('POST', `/repos/${repo}/issues/${number}/comments`, { body }),
    updateComment: (repo, id, body) => call('PATCH', `/repos/${repo}/issues/comments/${id}`, { body }),
  };
}

/** The first [limit] bytes of a stream, then stops reading it. */
async function readLimited(stream, limit) {
  const chunks = [];
  let total = 0;
  const reader = stream.getReader();
  while (total < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  reader.cancel().catch(() => {});
  const bytes = new Uint8Array(Math.min(total, limit));
  let at = 0;
  for (const c of chunks) {
    const part = c.subarray(0, bytes.length - at);
    bytes.set(part, at);
    at += part.length;
  }
  return bytes;
}
