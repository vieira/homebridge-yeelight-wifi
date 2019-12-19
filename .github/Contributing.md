# Contributors guide

## Commit message conventions

We use [ESLint commit message conventions](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-eslint).

Each commit looks like this:

```
Tag: Short description (fixes #1234)

Longer description here if necessary
```

The `Tag` is one of the following:

- `Fix` — for a bug fix.
- `Update` — for a backwards-compatible enhancement.
- `New` — implemented a new feature.
- `Breaking` — for a backwards—incompatible enhancement or feature.
- `Docs` — changes to documentation only.
- `Build` — changes to build process only.
- `Upgrade` — for a dependency upgrade.
- `Chore` — for refactoring, adding tests and so on (anything that isn’t user-facing).

If the commit doesn’t completely fix the issue, then use (`refs #1234`) instead of (`fixes #1234`).

Here are some good commit message summary examples:

```
Build: Update Travis to only test Node 0.10 (refs #734)
Fix: Semi rule incorrectly flagging extra semicolon (fixes #840)
Upgrade: Esprima to 1.2, switch to using comment attachment (fixes #730)
```

## Pull requests

Maintainers merge pull requests by squashing all commits and editing the commit message if necessary using the GitHub user interface.

Use an appropriate commit type. Be especially careful with breaking changes. See _Commit message conventions_ above for details.

## Releases

We’re doing automated releases with semantic-release. We’re using [milestones](https://github.com/styleguidist/react-styleguidist/milestones) to group approved pull requests that should be released together (most useful for major releases).

### Patch releases

Any commit of a `Fix` or `Update` types merged into the master branch, is published as a _patch_ release as soon as CI passes.

### Minor releases

Any commit of a `New` type merged into the master branch, is published as a _minor_ release as soon as CI passes.

### Major releases

Any commit of a `Breaking` type merged into the master branch, is published as a _major_ release as soon as CI passes.

1. Merge all pull requests from a milestone. If a milestone has more than one pull request, they should be merged and released together:
   1. Create a new branch.
   2. Merge all pull requests into this new branch (you can change the target branch on the pull request page and merge it using the GitHub user interface).
   3. Resolve possible merge conflicts.
2. Wait until semantic-release publishes the release.
3. Edit the release notes on GitHub (see _Changelogs_ below).
4. Tweet the release!

## Changelogs

### What is a good changelog

- Changelogs are written for users, not developers.
- Changelog should show new features with code examples or GIFs.
- Changelog should make all breaking changes clear.
- Changelog should explain how to migrate to a new version if there are breaking changes.
- Commit log **is not** a changelog but can be a base for it.
