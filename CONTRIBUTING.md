# Contributing to KPI

We'd love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

## We Develop with GitHub

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## All Code Changes Happen Through Pull Requests

Pull requests are the best way to propose changes to the codebase (we use [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)).
We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update (or create!) the documentation.
4. Ensure the test suite passes - wait for CI or run everything locally in a container:
   ```sh
   cd kobo-install
   ./run.py
   ./run.py -cf exec kpi ./scripts/ci_locally.sh
   ```
5. Make sure your code lints.
6. Issue that pull request and follow the pull request template!

## Pull Requests Are Squash-Merged

Pull requests are always merged with squash-and-merge, and only the PR's assignee merges it.
GitHub deletes the branch afterwards.

- It keeps PRs small: if you'd rather not squash two specific commits together, they probably belong in separate PRs.
- The PR title and description become the merged commit message, so a well-written PR becomes a well-written commit.
- It drops the noise of back-and-forth changes and commits like "review changes".
  A PR made of well-crafted, well-described commits is still welcome, since reviewers can first read it commit by commit as a story.

## Pull Request Titles Follow Conventional Commits

PR titles follow [Conventional Commits](https://www.conventionalcommits.org/) as `<type>(<scope>)<!>: <title> DEV-1234`.
Structured titles nudge us to split PRs by type and make the git history easier to search and skim. They also feed the auto-generated changelog.
Write them for Kobo developers, now and in the future, reviewing the PR or reading the history and changelog later.

### Type

When a PR mixes changes, or you're unsure, either split it into several PRs or use the topmost type that applies:

- **feat** - change expected user-facing behavior
- **fix** - fix unexpected user-facing behavior
- **ci** - manage CI, production or test environment configuration or scripts
- **perf** - improve performance (no change in behavior)
- **build** - change or configure the build stack, upgrade dependencies
- **test** - assert expected behavior or manage the test suite (no change in behavior)
- **refactor** - improve maintainability (a code change that doesn't change behavior)
- **style** - changes that don't affect the meaning of the code (whitespace, formatting, etc.)
- **docs** - describe expected behavior, as well as edit READMEs, inline comments, etc.
- **chore** - other inconsequential changes, e.g. IDE configuration, version bump, removing dead code
- **revert** - revert previous commits

This is based on the widely used Angular list, so tooling can use a preset config, although we interpret it slightly differently.

### Title

- use the imperative, present tense: "change", not "changed" or "changes"
- don't capitalize the first letter
- no dot (.) at the end
- the `<type>(<scope>): <title>` part has a soft limit of 50 characters (a **few** more is fine)
- `<!>` is an optional exclamation mark that marks a breaking change, e.g. `feat(tags)!: remove tag detail endpoint`

### Scope

`(<scope>)` is optional and free-form. Be consistent and reuse scopes already in `git log` where you can.

- Skip the scope only if the changes are global (e.g. moving folders). Consider `frontend` and `backend` for semi-global changes (e.g. linter).
- Use camelCase for features or groups, and PascalCase for big classes and React components.
- To find the scope, write the title without one, see what you prefixed with in/at/on/to, drop the prefix and use that word as the scope.
  E.g. "feat: add spinner at the UniversalTable" → "feat(UniversalTable): add spinner".
- Alternatively, if your change applies (mostly) to a specific feature or location in the product, use that as the scope.
  E.g. "fix: automatic translations" → "fix(nlp): automatic translations".

### Task ID

`DEV-1234` refers to an issue in the Kobo team's internal tracker.
It's mandatory if a related task exists, which it should in most cases.
External contributors can leave it out; the Kobo team links one if needed.
All pull requests stay public, whether or not they reference an internal issue.

## Any contributions you make will be under the GNU Affero General Public License

In short, when you submit code changes, your submissions are understood to be under the same [GNU Affero General Public License](./LICENSE) that covers the project.
Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub's [issues](https://github.com/kobotoolbox/kpi/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/kobotoolbox/kpi/issues/new); it's that easy!
The Kobo team links GitHub issues to its internal tracker as needed, so GitHub is the place to report and follow them.

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

People *love* thorough bug reports. I'm not even kidding.

## Code style Guidelines

Automatic lint rules are written using a linter configuration, see:
- [`.editorconfig`](./.editorconfig) (global)
- [`.eslintrc.js`](./.eslintrc.js) (frontend)
- [`.stylelintrc.js`](./.stylelintrc.js) (frontend)
- [`coffeelint.json`](./coffeelint.json) (frontend)

Manual lint rules are written in coding style files, see:
- [`CODING_STYLE_FE.md`](./CODING_STYLE_FE.md)
- [`CODING_STYLE_BE.md`](./CODING_STYLE_BE.md)

Code style guideline principles:
- PR *must pass* linter CI job based on automatic linter rules
- PR *must resolve* all reviewer requests based on manual linter rules
- Reviewer's code style comments not based on manual linter rules are *optional*
