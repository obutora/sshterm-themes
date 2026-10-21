# Sending a theme to the gallery

[日本語](CONTRIBUTING.ja.md)

The theme gallery on [sshterm.iru-yo.com/themes](https://sshterm.iru-yo.com/themes) is built from this repository. To put a theme of yours in it, send a pull request that adds the theme's file. A check runs on every PR, and the developer reviews it before merging. Merged themes show on the site after it is rebuilt (a few minutes).

## Steps

1. **Make the theme in SSH Term.** Settings › Terminal Theme › Custom › New Theme (start from a preset or another theme), then edit its colours, name, author and license.
2. **Export it.** On the theme, ⋯ › Export › Save to File. The file is one theme in [format v1](https://sshterm.iru-yo.com/themes/format).
3. **Name the file after the theme's id.** Open the file and copy the value of `"id"` (for example `1b4e28ba-2fa1-41d2-883f-0016d3cca427`). The file must be named `<id>.json`.
4. **Add it under your GitHub login.** Fork this repository and add the file as `themes/<your GitHub login>/<id>.json`, for example `themes/octocat/1b4e28ba-2fa1-41d2-883f-0016d3cca427.json`. The directory must be your login exactly as GitHub shows it (with the same upper and lower case).
5. **Open a pull request.** One PR may add several themes. If the check finds a problem, it says which file and why in a comment on the PR; push a fix to the same PR and it checks again.

Change nothing else in the PR: a PR that touches any other file, or removes a file, fails the check.

## Updating your theme

Only the account that first sent a theme can change it: the directory it is in (`themes/<login>/`) records that account. To update a theme, edit it in the app (editing your own theme keeps its id), export it again, and send a PR that replaces the same file.

A theme you received from someone else and edited gets a new id in the app, so it is a new theme: send it as a new file, and keep its "based on" (the app fills it in).

## What the check refuses

- A file other than `themes/<your login>/<id>.json` added or changed: files of other accounts, files outside `themes/`, `.github/` and the check's code. Removing or renaming a file.
- A file name that is not the theme's `id` (a lowercase UUID v4), or an `id` that another account's theme already has.
- A file the app would not import, or that does not match the [JSON Schema](https://sshterm.iru-yo.com/themes/schema/v1.json): not UTF-8 JSON, over 64 KB, a field the format does not have, a name or author that is not 1–40 characters of plain text (no control characters, nothing that turns the text's direction; spaces at either end count for the schema), a broken or missing colour, a license other than the three below.
- More than one theme in a file.
- A name the gallery already has. Names are compared after Unicode NFKC and ignoring case, so `Tide`, `TIDE` and `Ｔｉｄｅ` are the same name.
- A foreground on the background with a contrast ratio under 4.5:1 ([WCAG](https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio)).

## What the developer looks at

- The name and the author are not offensive.
- The theme does not pass itself off as a well-known theme or as somebody else.
- A theme made from somebody else's theme says so ("based on"), and keeps that theme's license where the license asks for it.

## Licenses

Every theme carries one of three licenses. They all let anyone use, change and pass on the theme, in the app or anywhere else:

- **CC0-1.0**: no conditions. Anyone may do anything with it without crediting you.
- **CC-BY-4.0**: others must credit you (the app keeps you as the author of "based on" when they edit it).
- **MIT**: others must keep the copyright and license notice (in the app: the author and license of "based on").

A theme made from a CC-BY-4.0 or MIT theme keeps that license; the app does not let you change it. Do not send a theme you may not pass on under its license.

## Taking a theme down

Open an issue with the template for your theme or for somebody else's. If the issue comes from the account a theme's directory is named after, the developer removes the theme without asking why. Otherwise the developer decides.

Removing a theme from the gallery takes it off the site only. A theme already imported in someone's terminal stays there, and a theme link (`https://sshterm.iru-yo.com/theme#t=…`) carries the whole theme, so links already shared keep working.
