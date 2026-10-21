// The gallery's rules for a PR, as pure functions over data: the PR's files
// (as the GitHub API lists them, with their bytes at the PR's head) and the
// gallery as it is on the base branch. Nothing here runs or reads the PR's code.
//
// A gallery theme is themes/<GitHub login>/<id>.json: one theme's v1 document,
// the file named after the theme's id. The directory records the one account
// that may change the theme.

import { MIN_CONTRAST, THEME_ID, contrastRatio, nameKey, validateThemeBytes } from './theme-format.js';

/**
 * Where [path] puts a theme, or the rule it breaks: {id} or {rule}.
 * [author] is the login of the PR's author.
 */
function placeOf(path, author) {
  const parts = path.split('/');
  if (parts.length < 3 || parts[0] !== 'themes') return { rule: 'outsideThemes' };
  if (parts[1] !== author) return { rule: 'notOwnDirectory' };
  const id = parts.length === 3 && parts[2].endsWith('.json') ? parts[2].slice(0, -'.json'.length) : '';
  if (!THEME_ID.test(id)) return { rule: 'badFileName' };
  return { id };
}

/** ajv's errors as lines: `/themes/0/name must NOT have more than 40 characters`. */
function schemaErrors(errors) {
  return errors.map((e) => `${e.instancePath || '/'} ${e.message}`);
}

/**
 * The theme of a file's [bytes], or the rule it breaks: {theme} or
 * {rule, ...detail}. The app's rules first (they say which field, as the app
 * does), then the published schema over the same parsed document.
 */
function readThemeFile(bytes, validateSchema) {
  const checked = validateThemeBytes(bytes);
  if (!checked.ok) return { rule: 'invalidTheme', ...checked.problems[0] };
  if (!validateSchema(checked.doc)) return { rule: 'schema', errors: schemaErrors(validateSchema.errors) };
  if (checked.themes.length !== 1) return { rule: 'notOneTheme' };
  return { theme: checked.themes[0] };
}

/** The theme in a gallery file's [bytes] as the app reads it, or null. */
function galleryTheme(bytes) {
  const checked = validateThemeBytes(bytes);
  return checked.ok && checked.themes.length === 1 ? checked.themes[0] : null;
}

/**
 * The problems of a PR. [files]: [{path, status, previousPath?, bytes?}] with
 * the GitHub API's status ('added', 'modified', 'removed', 'renamed', …) and
 * the bytes at the PR's head. [base]: the gallery's files on the base branch,
 * [{path, bytes}]. [validateSchema]: the published JSON Schema, compiled
 * (ajv: returns a boolean and sets .errors).
 * Returns {ok, problems: [{path, rule, ...detail}]}.
 */
export function checkPullRequest({ author, files, base, validateSchema }) {
  const problems = [];
  const fail = (path, rule, detail = {}) => problems.push({ path, rule, ...detail });

  // The gallery as the PR would leave it, the PR's own themes added as they
  // pass: [{path, theme}]. A file the PR changes is there only as the PR has it.
  const changed = new Set(files.flatMap((f) => [f.path, f.previousPath]));
  const gallery = base
    .filter((f) => !changed.has(f.path))
    .map((f) => ({ path: f.path, theme: galleryTheme(f.bytes) }))
    .filter((f) => f.theme);

  for (const file of files) {
    if (file.status === 'removed') {
      fail(file.path, 'removed');
      continue;
    }
    if (file.status === 'renamed') fail(file.previousPath, 'removed');
    else if (!['added', 'modified', 'copied'].includes(file.status)) {
      fail(file.path, 'unsupportedChange', { status: file.status });
      continue;
    }
    const place = placeOf(file.path, author);
    if (place.rule) {
      fail(file.path, place.rule);
      continue;
    }
    const read = readThemeFile(file.bytes, validateSchema);
    if (read.rule) {
      const { rule, ...detail } = read;
      fail(file.path, rule, detail);
      continue;
    }
    const { theme } = read;
    if (theme.id !== place.id) {
      fail(file.path, 'idMismatch', { id: theme.id });
      continue;
    }
    // The rest are each worth knowing, so a theme gets all of them.
    const sameId = gallery.find((f) => f.theme.id === theme.id);
    if (sameId) fail(file.path, 'idTaken', { by: sameId.path });
    const key = nameKey(theme.name);
    const sameName = gallery.find((f) => nameKey(f.theme.name) === key);
    if (sameName) fail(file.path, 'nameTaken', { name: theme.name, by: sameName.path });
    const ratio = contrastRatio(theme.colors.foreground, theme.colors.background);
    if (ratio < MIN_CONTRAST) fail(file.path, 'lowContrast', { ratio });
    gallery.push({ path: file.path, theme });
  }
  return { ok: problems.length === 0, problems };
}
