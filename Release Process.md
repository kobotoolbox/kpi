# Release Process

How we version, branch, and ship KoboToolbox releases.
Covers the automated pipeline from branch cut through image build to public release notes.

## KoboToolbox versioning convention

KoboToolbox uses semver-alike time-based versioning: `[MAJOR].0[MINOR][PATCH]`, where:

- `[MAJOR]` is `2`
- `[MINOR]` is `[YEAR_SUFFIX].[WEEK]`, where
  - `[YEAR_SUFFIX]` is 26 for year 2026
  - `[WEEK]` is the week the release branch is cut, not the week it's released or deployed.
- `[PATCH]` is empty for a minor version, and then letters `a`, `b`, `c`, ... for subsequent patch releases.

Example valid releases that are also subsequent to each other:

- `2.026.07h`
- `2.026.12`
- `2.026.12a`

## KoboToolbox Git branching flow

At KoboToolbox, we use squashed feature branches, and release branches.
PRs may target either main or any release branch, usually the latest one.
Every push to a release branch is automatically merged forward to the next release branch(es), and then to main.

## KoboToolbox Release Process

EOM owns the flow as a whole and related automation for unlabelled steps.
QA Lead and Release Manager own their respective steps and the implied judgement that QA/release is ready.

Minor release creation triggers every Wednesday night IF previous minor release is released.

1. create git release branch from main, e.g. `release/2.026.07`
2. create Linear release, link related Linear issues, and set status to "Pending QA"
3. notify on zulip

Patch release creation triggers when a commit is pushed to release branch after a version tag on it:

1. push transifex translation source strings
2. upsert Linear release, link related Linear issues, and upsert status to "Pending Image"
   - Note: Patch releases skip QA status and process
3. notify on zulip

When minor release is in "Pending QA" status (usually takes two weeks):

1. (manually by QA Lead) test the minor release against release test plan
   - found problems are filed as Linear issues, fixed, merged directly to release branch, and QA'd individually.
2. (manually by QA Lead) test any Linear issues in the minor release that have "In QA" status.
3. (manually by QA Lead) set Linear release status to "Pending Image"
4. (manually by QA Lead) notify on zulip

When minor or patch release is in "Pending Image" status (usually next Monday-Wednesday):

1. (manually by Release Manager) trigger the tag workflow
2. pull transifex translations and commit if changed
3. create and push the tag on the release branch (after any translation commit)
4. regenerate changelog (authoritative, with all prior tags known)
5. create and upload image to GHCR
   - on failure, delete the tag (trigger the workflow again to retry)
6. tag/push to `kobo-docker`, update/commit/tag/push to `kobo-install`
7. set Linear release status to "Pending Release"
8. create Linear issue for Infra team to deploy it, and detect `SKIP_HEAVY_MIGRATIONS` for that
9. notify on zulip

When minor or patch release is in "Pending Release" status (usually right after the image is built):

1. (manually by Release Manager) run a GHA action
2. create GitHub releases with a changelog (`create-gh-releases.py` of [release-notes-writer](https://github.com/kobotoolbox/release-notes-writer))
3. set Linear release status to "Released"
4. notify on zulip

Note: Usually we post release notes right after building an image and well before deployment.
The reason for separating "Pending Image" and "Pending Release" steps is the occasional case
when we want to delay release notes after deployment for security reasons (e.g. security update in `2.026.23a`).

## Deployment

We separate release from deployment due to having 20+ servers to deploy to, both public and private, managed and not.
It's usual to deploy to different instances at different times for various reasons, even across weeks.
From the Engineering perspective, release ends with release notes, and Linear Release lifecycle reflects that.

Infrastructure team follows these steps **per instance** that the auto-created Linear issue contains as well:

1. Coordinate deployment time at least 24h in advance with James LD for private instances
2. Schedule maintenance window in Datadog
3. Deploy Image & run or skip heavy migrations, if any
4. Add SLO correction in Datadog
5. Mark instance in the Linear issue deployed
6. notify on zulip

## Invariants

These invariants follow from the linking rules above. Automation enforces them; manual linking should also satisfy them.

A commit MUST NOT be tagged with multiple releases. If it's already tagged, assume a re-build, not a new release.

All Linear issues with a single linked PR are marked as part of one or more releases.
The following invariants are always true for them:

- a Linear issue has exactly one patch release linked of the same minor version (subsequent releases are assumed)
- if a Linear issue has a minor release linked, then no future release are linked (subsequent releases are assumed)
- if a Linear issue has a patch release linked, then it must also have one of next minor version patch releases linked

If the Linear issue has multiple linked PRs, it has linked releases as union of as-if those were separate Linear issues.

Examples:

- if normal Linear issue has 2.026.21 release linked, DO NOT link also 2.026.21a and subsequent releases
- if normal Linear issue has 2.026.21 release linked, DO NOT link also 2.026.23 and subsequent releases
- if hotfix Linear issue has 2.026.21b release linked, DO NOT link also 2.026.23 and subsequent releases if it made it
- if hotfix Linear issue has 2.026.21b release linked, DO link also 2.026.23b release if it didn't make in 2.026.23
- if hotfix Linear issue has 2.026.21b release linked and is backported to .12k and .03h, link them all.

## Happy Path Scenarios

### Minor release

1. Context: `.27` is released and deployed. Life is good.
2. Wednesday night automation creates `release/2.026.28` branch from main.
3. Linear release "2.026.28" is created in "Pending QA" status. Zulip notified.
4. Over the next few weeks, devs may merge PRs into `.28`. Each push runs tests, updates the changelog, deploys to beta, and merges forward to main.
5. QA tests the release. Found bugs are fixed directly on `.28`.
6. QA Lead sets Linear release to "Pending Image" and notifies on Zulip.
7. Release Manager runs the tag workflow. Translations are pulled, tag `2.026.28` is created, image is built, kobo-docker and kobo-install are bumped and tagged. Linear release → "Pending Release".
8. Release Manager runs the announce workflow. GitHub releases are created with a changelog. Linear release → "Released". Zulip notified.

### Patch release

1. Context: `.27` is released and deployed. A bug is found in production.
2. Dev fixes it, merges PR to `.27` branch.
3. Stabilize runs: tests pass, Linear release "2.026.27a" is created in "Pending Image" status, changes are merged forward (to `.28` if it exists, otherwise to main).
4. Release Manager tags `.27` → `2.026.27a`. Image built, repos bumped. Linear release → "Pending Release".
5. Release Manager announces `2.026.27a`. GitHub releases created. Linear release → "Released".
6. If `.28` exists, the fix is already there via merge-forward, so `.28`'s Linear release does not include this issue — it was already shipped in `.27a`.

### Skipped release (QA decides to kill a release)

1. Context: week 28 Wednesday — `.28` branch is created. Linear release "2.026.28" is in "Pending QA".
2. QA won't start to test `.28` in time and would rather move on to `.29`. Before next Wednesday, QA Lead runs the "skip release" workflow with `release/2.026.28`.
3. The workflow retargets any open PRs to main, deletes the branch, deletes the Linear release, and notifies on Zulip.
4. Week 29 Wednesday: automation computes `.29`, finds prev=`.27` (released, since `.28` no longer exists) → creates `release/2.026.29` from main. Linear release "2.026.29" created in "Pending QA".
