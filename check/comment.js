// The check's comment on a PR: what broke which rule, in English and Japanese.

import { MIN_CONTRAST } from './theme-format.js';

// The app's reasons a document is not a theme (ThemeFormatProblem).
const REASONS = {
  tooLarge: ['is over 64 KB', '64KB を超えています'],
  notJson: ['is not UTF-8 JSON', 'UTF-8 の JSON ではありません'],
  notThemeFile: ['is not an SSH Term theme file ("format": "ssh-term-theme")', 'SSH Term のテーマのファイル（"format": "ssh-term-theme"）ではありません'],
  newerVersion: ['is of a newer format version than 1', '形式の版が 1 より新しいです'],
  badVersion: ['has a broken formatVersion', 'formatVersion が壊れています'],
  themeCount: ['must hold one theme', 'テーマは 1 つにしてください'],
  unknownField: ['has a field the format does not have', '形式に無い項目があります'],
  missingField: ['lacks a field', '項目がありません'],
  wrongType: ['has a field of the wrong type', '項目の型が違います'],
  badId: ['has an id that is not a lowercase UUID v4', 'id が小文字の UUID v4 ではありません'],
  duplicateId: ['has the same id twice', '同じ id が 2 つあります'],
  badText: ['has a name or author the app does not take', 'アプリが受け付けない名前か作者です'],
  badLicense: ['has a license other than CC0-1.0, CC-BY-4.0 and MIT', 'ライセンスが CC0-1.0・CC-BY-4.0・MIT のどれでもありません'],
  badColor: ['has a colour that is not #RRGGBB or #RRGGBBAA', '色が #RRGGBB か #RRGGBBAA ではありません'],
  missingColor: ['lacks a colour it must have', '必須の色がありません'],
  badSchema: ['has a "$schema" other than the format\'s', '"$schema" が形式の URL ではありません'],
};
const TEXT_PROBLEMS = {
  empty: ['empty', '空'],
  tooLong: ['over 40 characters', '40 文字を超える'],
  forbiddenCharacter: ['a control character or one that turns the text\'s direction', '制御文字か文字の向きを変える文字を含む'],
};

/** A ratio as shown: cut, not rounded, so 4.499 is not "4.50". */
export const showRatio = (ratio) => `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;

/**
 * [text] (a path or name from the PR) as an inline code span it cannot leave:
 * no backticks, no line breaks. Markdown, links and @mentions stay inert.
 */
const code = (text) => `\`${String(text).replace(/`/g, "'").replace(/[\r\n]+/g, ' ')}\``;

/** [en, ja, more lines?] for a problem. */
function explain(p, author) {
  const own = `themes/${author}/`;
  switch (p.rule) {
    case 'outsideThemes':
      return [
        `a PR to the gallery may change only themes/<your login>/<id>.json files (${own}).`,
        `ギャラリーへの PR で変えられるのは themes/<ログイン名>/<id>.json だけです（${own}）。`,
      ];
    case 'notOwnDirectory':
      return [
        `is in another account's directory: yours is ${own}.`,
        `ほかのアカウントのディレクトリです。あなたのものは ${own} です。`,
      ];
    case 'removed':
      return [
        'removes a file. To take your theme down, open an issue ("Take down my theme").',
        'ファイルを消しています。自分のテーマの取り下げは Issue（「自分のテーマを取り下げてほしい」）で受けます。',
      ];
    case 'unsupportedChange':
      return [`changes the file in a way the gallery does not take (${p.status}).`, `ギャラリーが受けない変え方です（${p.status}）。`];
    case 'badFileName':
      return [
        `must be named <id>.json, the theme's id (a lowercase UUID v4), directly in ${own}.`,
        `ファイル名はテーマの id（小文字の UUID v4）に .json を付けたものにし、${own} の直下に置いてください。`,
      ];
    case 'idMismatch':
      return [
        `is not named after the theme's id (${p.id}).`,
        `ファイル名がテーマの id（${p.id}）と一致しません。`,
      ];
    case 'invalidTheme': {
      const [en, ja] = REASONS[p.reason] ?? [p.reason, p.reason];
      const at = p.field ? ` (${code(p.field)})` : '';
      const text = p.textProblem ? TEXT_PROBLEMS[p.textProblem] : null;
      return [`${en}${at}${text ? `: ${text[0]}` : ''}.`, `${ja}${at}${text ? `：${text[1]}` : ''}。`];
    }
    case 'schema':
      return [
        "does not match the format's JSON Schema:",
        'JSON Schema に合いません：',
        p.errors.map((e) => `  - ${code(e)}`),
      ];
    case 'notOneTheme':
      return ['holds more than one theme; a gallery file holds one.', 'テーマが 2 つ以上あります。ギャラリーのファイルにはテーマを 1 つだけ入れてください。'];
    case 'idTaken':
      return [
        `has the id of a theme already in the gallery (${code(p.by)}). Duplicate the theme in the app for a new id.`,
        `ギャラリーにある別のテーマ（${code(p.by)}）と同じ id です。アプリで複製すると新しい id になります。`,
      ];
    case 'nameTaken':
      return [
        `the name ${code(p.name)} is taken by ${code(p.by)} (names are compared ignoring case and width).`,
        `名前 ${code(p.name)} は ${code(p.by)} と重なります（大文字・小文字と全角・半角の違いは同じとみなします）。`,
      ];
    case 'lowContrast':
      return [
        `the foreground on the background is ${showRatio(p.ratio)}; the gallery needs ${MIN_CONTRAST}:1 or more.`,
        `前景と背景のコントラスト比が ${showRatio(p.ratio)} です。${MIN_CONTRAST}:1 以上が必要です。`,
      ];
    default:
      return [p.rule, p.rule];
  }
}

/** The comment's body (without the marker) for a check's [result] on a PR to [repo] by [author]. */
export function commentBody({ ok, problems }, { author, repo }) {
  if (ok) return '**The theme check passed.** / テーマの検査に通りました。';
  const lines = [
    '**The theme check failed.** / テーマの検査に通りませんでした。',
    '',
  ];
  for (const p of problems) {
    const [en, ja, more = []] = explain(p, author);
    lines.push(`- ${code(p.path)}: ${en}`, `  ${ja}`, ...more);
  }
  const guide = (file) => `https://github.com/${repo}/blob/main/${file}`;
  lines.push('', `How to send a theme: [CONTRIBUTING.md](${guide('CONTRIBUTING.md')}) / 送り方: [CONTRIBUTING.ja.md](${guide('CONTRIBUTING.ja.md')})`);
  return lines.join('\n');
}
