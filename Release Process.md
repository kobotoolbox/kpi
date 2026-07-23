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

1. (manually by Release Manager) push a matching minor or patch tag to release branch
2. pull transifex translations (TODO DEV-1916), if there's any to commit:
   1. delete the tag
   2. commit changes to release branch
   3. create the tag on the new commit
3. create and upload image to github (TODO: based on John's script)
   - on failure, delete the tag (push it again to retry)
4. tag/push to `kobo-docker`, update/commit/tag/push to `kobo-install` (`create-kobo-release.sh` of [release-notes-writer](https://github.com/kobotoolbox/release-notes-writer))
5. set Linear release status to "Pending Release"
6. create Linear issue for Infra team to deploy it, and detect `SKIP_HEAVY_MIGRATIONS` for that (TODO: DEV-653)
7. notify on zulip

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
