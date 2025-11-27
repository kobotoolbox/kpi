<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (8)</summary>

- **billing**: enable LLM usage tracking ([#6262](https://github.com/kobotoolbox/kpi/pull/6262))
    > <!-- 📣 Summary -->
    > Enables tracking of automated QAn (LLM) usage via `NLPUsageCounter` in
    > the `trackers` app, adds `llm_requests` to service usage serializer and
    > updates API/docs accordingly.

- **billing**: handle limit aggregation for llm requests ([#6291](https://github.com/kobotoolbox/kpi/pull/6291))
    > <!-- 📣 Summary -->
    > Enables aggregation of automated QA billing limits and the inclusion of
    > these limits in service usage data returned by the API.

- **formBuilder**: silently support background-geopoint type ([#6396](https://github.com/kobotoolbox/kpi/pull/6396))
    > <!-- 📣 Summary -->
    > 
    > Forms with `background-geopoint` no longer display errors when opened
    > through Form Builder. Saving such form will not result in lost row.

- **formBuilder**: add default max-pixels value when adding new photo question ([#6444](https://github.com/kobotoolbox/kpi/pull/6444))
    > <!-- 📣 Summary -->
    > 
    > When creating `image` question in Form Builder, set `max-pixels` to
    > default value (`1024`) instead of leaving it blank. Also applies default
    > values for `range` question type (the change is universal and will work
    > with any future default values we set).

- **formBuilder**: unset image max-pixels param by clearing the text field ([#6464](https://github.com/kobotoolbox/kpi/pull/6464))
- **frontend**: improve error messages in useOrganizationAssumed ([#6475](https://github.com/kobotoolbox/kpi/pull/6475))
- **mfa**: upgrade allauth version ([#6310](https://github.com/kobotoolbox/kpi/pull/6310))
- **mfa**: replace trench based API endpoints, views and forms with allauth implementation ([#6402](https://github.com/kobotoolbox/kpi/pull/6402))
</details>

<details><summary>Bug Fixes (13)</summary>

- **allauth**: redirect from signup page ([#6426](https://github.com/kobotoolbox/kpi/pull/6426))
    > <!-- 📣 Summary -->
    > Correctly redirect users from the signup page to the landing page
    > specified in the URL.

- **analysis**: Fix UI wording and gap sizes ([#6481](https://github.com/kobotoolbox/kpi/pull/6481))
    > <!-- 📣 Summary -->
    > Cleared up some confusing UI mistakes in the button wording and gap
    > sizes.

- **billing**: always send users to stripe portal for plan changes ([#6401](https://github.com/kobotoolbox/kpi/pull/6401))
    > <!-- 📣 Summary -->
    > Changes frontend billing code to always send users changing their plan
    > to Stripe for confirmation instead of handling downgrades in-app.

- **connectedProjects**: error handling causing crash ([#6458](https://github.com/kobotoolbox/kpi/pull/6458))
    > <!-- 📣 Summary -->
    > 
    > Fixes crash in Connected Projects UI when a renamed question of not yet
    > redeployed form is being selected.

- **data**: dynamically add empty validation status dict ([#6388](https://github.com/kobotoolbox/kpi/pull/6388))
    > <!-- 📣 Summary -->
    > Fix error when loading data tables for submissions created before
    > validation_statuses were added.

- **exports**: block access to old exports when permissions change ([#6507](https://github.com/kobotoolbox/kpi/pull/6507))
    > <!-- 📣 Summary -->
    > Ensure anonymous users cannot access old export files if permission to
    > view submissions is revoked.

- **formLanding**: clone form version button ([#6459](https://github.com/kobotoolbox/kpi/pull/6459))
    > <!-- 📣 Summary -->
    > 
    > Fixes unresponsive "Clone this version as a new project" button from
    > Project → Form tab.

- **formLanding**: clone form version button ([#6459](https://github.com/kobotoolbox/kpi/pull/6459))
    > <!-- 📣 Summary -->
    > 
    > Fixes unresponsive "Clone this version as a new project" button from
    > Project → Form tab.

- **fromBuilder**: accessing non existent attribute for group type ([#6419](https://github.com/kobotoolbox/kpi/pull/6419))
    > <!-- 📣 Summary -->
    > This PR fixes an error when loading form builder containing a group.

- **gallery**: load small images for thumbnails ([#6454](https://github.com/kobotoolbox/kpi/pull/6454))
    > <!-- 📣 Summary -->
    > Load a quick, small resolution version of an image instead of the full
    > resolution in the form gallery view. Should speed up load times and ease
    > server bandwidth

- **mfa**: fix recovery codes error in token field ([#6495](https://github.com/kobotoolbox/kpi/pull/6495))
- **versions**: convert version removal celery task to migration ([#6434](https://github.com/kobotoolbox/kpi/pull/6434))
- [**breaking**] stuff ([976ba6e](https://github.com/kobotoolbox/kpi/commit/976ba6eddb35e51028e119f75335675e7a6be5c9))
</details>

<details><summary>Performance (4)</summary>

- **assets**: prefetch related XForm objects to reduce database queries ([#6487](https://github.com/kobotoolbox/kpi/pull/6487))
    > <!-- 📣 Summary -->
    > Improve performance of asset queries by prefetching related XForm
    > objects.
    > 
    > <!-- 📖 Description -->
    > This change optimizes asset retrieval by prefetching related XForm
    > objects, reducing the number of database queries executed when listing
    > or accessing assets. Previously, each access to related XForm data
    > triggered additional queries, which impacted performance on endpoints
    > returning multiple assets. With prefetching, related data is loaded
    > efficiently in a single query, improving response times and lowering
    > database load without altering API behavior or response content.

- **attachments**: access XForm directly from Attachment to avoid heavy joins on Instance table ([#6488](https://github.com/kobotoolbox/kpi/pull/6488))
    > <!-- 📣 Summary -->
    > Improve performance by linking attachments directly to their project.
    > 
    > <!-- 📖 Description -->
    > This optimization allows retrieving the related `XForm` directly from
    > the `Attachment` model, bypassing the need to join through the
    > `Instance` table, which can be extremely large. By establishing a more
    > direct relationship, the system reduces query complexity and execution
    > time, significantly improving performance when loading or filtering
    > attachments.

- **build**: switch from pip to uv ([#6467](https://github.com/kobotoolbox/kpi/pull/6467))
- **userReports**: remove `count` from API response ([#6505](https://github.com/kobotoolbox/kpi/pull/6505))
    > <!-- 📣 Summary -->
    > Improve user report performance by removing the expensive count
    > calculation from the response.
    > 
    > <!-- 📖 Description -->
    > This change removes the `count` field from the user report API response
    > because calculating the total number of documents is a major bottleneck
    > on large datasets. The count query requires scanning the entire
    > collection, significantly slowing down the endpoint. Clients still
    > receive the paginated results as before, just without the heavy count
    > operation.

</details>

<details><summary>Continous Integration (3)</summary>

- **releases**: variable typo for zulip messages ([#6395](https://github.com/kobotoolbox/kpi/pull/6395))
- **staging**: pin kubectl version to avoid timeouts INFRA-283 ([#6455](https://github.com/kobotoolbox/kpi/pull/6455))
- **toolVersions**: set kubectl and helm version from github environment variable ([#6471](https://github.com/kobotoolbox/kpi/pull/6471))
</details>

<details><summary>Testing (2)</summary>

- **userReports**: fix race condition ([#6417](https://github.com/kobotoolbox/kpi/pull/6417))
- **xforms**: improve xform list API tests ([#6413](https://github.com/kobotoolbox/kpi/pull/6413))
</details>

<details><summary>Security (3)</summary>

- **deps**: bump actions/setup-node from 5 to 6 in the actions-deps group ([#6387](https://github.com/kobotoolbox/kpi/pull/6387))
- **deps-dev**: bump playwright from 1.52.0 to 1.56.1 in the minor-and-patch group across 1 directory ([#6392](https://github.com/kobotoolbox/kpi/pull/6392))
- **deps-dev**: bump validator from 13.15.15 to 13.15.20 in the minor-and-patch group across 1 directory ([#6415](https://github.com/kobotoolbox/kpi/pull/6415))
</details>

<details><summary>Refactor (6)</summary>

- **commonHeader**: mantineify and refactor analysis header into wrapper component ([#6441](https://github.com/kobotoolbox/kpi/pull/6441))
- **connectedProjects**: migrate dataAttachments files to TypeScript ([#6451](https://github.com/kobotoolbox/kpi/pull/6451))
- **mantine**: migrate nlp qa number input ([#6373](https://github.com/kobotoolbox/kpi/pull/6373))
- **mantine**: migrate QA tags response form to mantine ([#6390](https://github.com/kobotoolbox/kpi/pull/6390))
- **members**: adopt Orval for members and invites ([#6090](https://github.com/kobotoolbox/kpi/pull/6090))
- **reactQuery**: standard error flow for Orval ([#6439](https://github.com/kobotoolbox/kpi/pull/6439))
</details>

<details><summary>Styling (1)</summary>

- **backend**: linter ([#6436](https://github.com/kobotoolbox/kpi/pull/6436))
</details>

<details><summary>Chores (1)</summary>

- **openAPI**: enable stripe for schema generation ([#6393](https://github.com/kobotoolbox/kpi/pull/6393))
</details>

<details><summary>Revert (1)</summary>

- revert "fixup!: stuff" ([1b48e2f](https://github.com/kobotoolbox/kpi/commit/1b48e2f892b4057ebab90a570fd7cb2cfb35535e))
</details>

<details><summary>Other (1)</summary>

- INFRA-284 update-kpi-repo-to-use-oidc-for-aws-authentication ([#6474](https://github.com/kobotoolbox/kpi/pull/6474))


</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.025.43e..2.025.47
<!-- generated by git-cliff -->
