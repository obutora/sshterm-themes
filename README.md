# sshterm-themes

The themes of the [SSH Term](https://sshterm.iru-yo.com/app) theme gallery, [sshterm.iru-yo.com/themes](https://sshterm.iru-yo.com/themes), and the check that every pull request to it goes through. The site itself is built in [obutora/sshterm-open](https://github.com/obutora/sshterm-open); this repository holds data and the check only.

To send a theme: [CONTRIBUTING.md](CONTRIBUTING.md) ([日本語](CONTRIBUTING.ja.md)).

## Layout

- `themes/<GitHub login>/<id>.json`: one theme each, in [format v1](https://sshterm.iru-yo.com/themes/format), named after the theme's id. The directory is the account that sent the theme and the only one that may change it; there is no other record of it. Only the developer moves a theme to another directory. The gallery lists themes in the order their files were first added to `main`.
- `check/`: the check of a pull request (Node, no build).
  - `main.js`: the workflow's entry. `run.js`: reads the PR's files over the GitHub API, the gallery from the base branch's checkout, and leaves the verdict in one comment on the PR. `github.js`: the API calls.
  - `rules.js`: the gallery's rules over that data (`checkPullRequest`). `contrast.js`: WCAG contrast. `comment.js`: the comment.
  - `theme-format.js`: the rules of format v1, **copied** from `public/theme-format.js` in sshterm-open, the same as the app's (the header names the commit). Change them there and copy them again.
- `test/`: `npm test` (`node --test`). `test/fixtures/schema-v1.json` is a copy of the published schema for the tests; the check fetches the published one.
- `.github/workflows/check.yml`: the check, on `pull_request_target`. `.github/workflows/deploy.yml`: on a push to `main`, calls the Cloudflare Pages deploy hook that rebuilds the site.

## Why the check is shaped this way

Anyone may send a pull request from a fork, and it may change anything, the workflow and the check included. So the check runs on `pull_request_target`, which runs the workflow and the code **of the base branch**, never the PR's. It does not check out the PR: it reads the PR's file list and the theme files' contents over the API as data, and runs nothing from them. Its token may only read the repository and comment on the PR, and it uses no secrets. The deploy hook's URL, the one secret, is only in the separate workflow that runs on `main`.

The check refuses any change outside `themes/<author's login>/`, so a PR cannot reach the check's code, the workflows or other people's themes even if a reviewer misses it. `CODEOWNERS` keeps `.github/` and the check's code to the developer. The developer's own changes to them fail the check too and are merged past it (as an administrator); changing the check takes effect for PRs only once it is on `main`.

## Running the tests

```sh
npm ci
npm test
```

Node 22 or later.

## License

The themes are each under the license in their file (`CC0-1.0`, `CC-BY-4.0` or `MIT`). The check's code and the documents of this repository are under the MIT License ([LICENSE](LICENSE)).
