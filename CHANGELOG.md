<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (19)</summary>

- **KMLExport**: route KML exports through KPI export tasks ([#7236](https://github.com/kobotoolbox/kpi/pull/7236))
    > <!-- 📣 Summary -->
    > KML exports now run through KPI export tasks and no longer use the
    > legacy OpenRosa KML export endpoint.

- **TOS**: allows admins to force TOS reaccpetance ([#7235](https://github.com/kobotoolbox/kpi/pull/7235))
    > <!-- 📣 Summary -->
    > Add an admin action to require all users to reaccept the Terms of
    > Service.
    > 
    > <!-- 📖 Description -->
    > Adds an admin action to the SitewideMessage admin. When triggered, as
    > long as there is a terms of service sitewide message present, all users
    > will be prompted to accept the TOS regardless of whether they have
    > already done so.

- **bulkProcessing**: use proper xpath for bulk translation ([#7207](https://github.com/kobotoolbox/kpi/pull/7207))
    > <!-- 📣 Summary -->
    > 
    > Fixed bulk translation requests that were failing due to incorrect
    > question path being sent to the backend.

- **bulkProcessing**: display review button ([#7203](https://github.com/kobotoolbox/kpi/pull/7203))
    > <!-- 📣 Summary -->
    > 
    > Display "Review" button in table cells for automatic transcripts and
    > translations that haven't been accepted yet. Works both for bulk and
    > single requests.

- **bulkProcessing**: review button better navigation ([#7204](https://github.com/kobotoolbox/kpi/pull/7204))
    > <!-- 📣 Summary -->
    > 
    > Clicking the Review button on a translation now opens directly to that
    > specific language instead of defaulting to the most recent one.

- **bulkProcessing**: approve all modal ([#7209](https://github.com/kobotoolbox/kpi/pull/7209))
    > <!-- 📣 Summary -->
    > 
    > Added "Approve all selected" button to transcript and translation column
    > headers for bulk-approving ASR/MT results.

- **bulkProcessing**: add audio duration estimate to bulk transcription modal ([#7177](https://github.com/kobotoolbox/kpi/pull/7177))
    > <!-- 📣 Summary -->
    > Adds an estimated total time for all selected submissions' audio
    > attachments in the bulk transcription modal.

- **bulkProcessing**: ongoing job conflict alert ([#7181](https://github.com/kobotoolbox/kpi/pull/7181))
    > <!-- 📣 Summary -->
    > 
    > Bulk transcription and translation now warn you when you try to process
    > submissions that are already being processed by another job.

- **bulkProcessing**: poll activity logs if bulk processing is in progress ([#7205](https://github.com/kobotoolbox/kpi/pull/7205))
    > <!-- 📣 Summary -->
    > 
    > Activity log now automatically updates bulk processing counters while
    > jobs are running.

- **bulkProcessing**: already transcribed alert ([#7231](https://github.com/kobotoolbox/kpi/pull/7231))
    > <!-- 📣 Summary -->
    > 
    > Bulk Transcription now warns correctly when selected audio files are
    > already transcribed, including an accurate total duration, and those
    > files are filtered out before processing.

- **bulkProcessing**: near limit alert ([#7232](https://github.com/kobotoolbox/kpi/pull/7232))
    > <!-- 📣 Summary -->
    > 
    > Adds a new Near Limit error alert to bulk transcription and bulk
    > translation modals, shown when a user still has quota left but not
    > enough to process all selected submissions.

- **bulkProcessing**: bulk job alert nlp view ([#7241](https://github.com/kobotoolbox/kpi/pull/7241))
    > <!-- 📣 Summary -->
    > 
    > Display alerts in Single Processing view when a bulk processing job is
    > already working on the same submission. Also disables conflicting UI
    > until job is finished.

- **dataTable**: improve repeat group responses handling ([#7226](https://github.com/kobotoolbox/kpi/pull/7226))
    > <!-- 📣 Summary -->
    > 
    > Data Table repeat-group handling was stabilized for nested structures:
    > values no longer disappear for valid nested repeat paths, andrepeat
    > answers are (still) shown as a simple flat comma-separated list.

- **longRunningMigrations**: keep migration lock fresh with a heartbeat ([#7270](https://github.com/kobotoolbox/kpi/pull/7270))
    > <!-- 📣 Summary -->
    > 
    > Background data migrations can now run for up to 24 hours per pass and
    > recover on their own if a server is restarted, so they finish more
    > reliably.
    > 
    > <!-- 📖 Description -->
    > 
    > Some database maintenance tasks run in the background over a very large
    > amount of data. Until now each pass was capped at about 71 minutes, and
    > if the server running one was restarted it could stay stuck for a long
    > time before another server picked it up. These tasks now get up to 24
    > hours per pass and are retried within minutes if their server goes away,
    > so they complete without manual intervention.
    > 
    > ### 👷 Description for instance maintainers
    > 
    > Long-running migrations now get a dedicated, much longer time budget, up
    > to about 24 hours per run, separate from the shared limits used by other
    > background tasks (those keep their current values). New environment
    > variables let you tune this:
    > `CELERY_LONG_RUNNING_MIGRATION_TASK_TIME_LIMIT`,
    > `CELERY_LONG_RUNNING_MIGRATION_TASK_SOFT_TIME_LIMIT`,
    > `CELERY_LONG_RUNNING_MIGRATION_TASK_HEARTBEAT_INTERVAL` and
    > `CELERY_LONG_RUNNING_MIGRATION_TASK_HEARTBEAT_TTL`.
    > 
    > While a migration runs, a background heartbeat keeps its lock alive with
    > a short lease and records that it is still making progress. If the
    > worker running it dies (for example a Kubernetes pod eviction), the
    > lease expires within a few minutes and the migration is picked up again
    > automatically, instead of being blocked until the old time limit
    > elapsed.
    > 
    > No database schema change and no new migration to run. The defaults are
    > safe, so no configuration change is required.

- **qualitativeAnalysis**: add `QATagTracker` model for QA tag autocomplete ([#7195](https://github.com/kobotoolbox/kpi/pull/7195))
    > <!-- 📣 Summary -->
    > This PR introduces the `QATagTracker` model to support autocomplete
    > suggestions for QA tag-type questions.
    > 
    > <!-- 📖 Description -->
    > This PR adds the `QATagTracker` model to the subsequences app as the
    > database foundation for the autocomplete-for-QA-tag-questions feature.
    > Each row represents a unique tag value used for a specific QA question
    > on a specific asset.
    > 
    > The model includes a foreign key to `Asset`, a `question_uuid` field
    > identifying the QA question (stored as a plain char field since QA
    > questions are not persisted as database objects), and a value field
    > holding the tag string. A unique constraint on (asset, question_uuid,
    > value) ensures no duplicate tags are stored per question.

- **qualitativeAnalysis**: track QA tags on supplement save ([#7199](https://github.com/kobotoolbox/kpi/pull/7199))
    > <!-- 📣 Summary -->
    > This PR implements tag tracking for `qualTags` type QA questions by
    > creating `QATagTracker` rows whenever tags are saved via the supplement
    > PATCH endpoint.
    > 
    > <!-- 📖 Description -->
    > This PR adds the logic to populate `QATagTracker` on every successful
    > supplement save. When the `manual_qual` action processes a `qualTags`
    > question, `SubmissionSupplement._sync_qual_tag_trackers()` is called
    > after the supplement data is committed. It looks up the question type
    > from the `QuestionAdvancedFeature` params, and if the type is
    > `qualTags`, it bulk-creates tracker rows one per tag value using
    > `ignore_conflicts=True` so duplicate tags across submissions are
    > silently skipped without any additional query overhead.

- **qualitativeAnalysis**: add list endpoint for tag trackers ([#7225](https://github.com/kobotoolbox/kpi/pull/7225))
    > <!-- 📣 Summary -->
    > This PR adds a list endpoint for tag trackers, nested under the relevant
    > asset and QA question:
    > 
    > `GET /api/v2/assets/{uid_asset}/qual-questions/{uid_qa_question}/tags/`
    > 
    > The endpoint returns previously tracked tag values for a given QA tags
    > question, intended to power frontend autocomplete suggestions when
    > submitting answers to QA questions.
    > 
    > <!-- 📖 Description -->
    > - The endpoint uses `AdvancedSubmissionPermission`, since only users who
    > can submit answers to QA questions should be able to see this data.
    > - Results are filtered by asset + `question_uuid` and ordered by
    > `value`.

- **qualitativeAnalysis**: add suggestions to qualitative analysis tags questions ([#7233](https://github.com/kobotoolbox/kpi/pull/7233))
    > <!-- 📣 Summary -->
    > The tags question in qualitative analysis now displays responses from
    > previous answers to the same question in a dropdown

- **subsequences**: background polling for async Google translations ([#7217](https://github.com/kobotoolbox/kpi/pull/7217))
    > <!-- 📣 Summary -->
    > This PR enables background polling support for asynchronous automated
    > Google Translate operations.
    > 
    > <!-- 📖 Description -->
    > Enables `allow_async=True` on `AutomaticGoogleTranslationAction`, so
    > long-running translation batch jobs now reuse the same
    > `poll_run_external_process` Celery task already used for automatic
    > transcription, instead of relying on the user to manually re-request the
    > translation after a timeout.
    > 
    > `GoogleTranslationService` now returns status: `in_progress` (instead of
    > status: `failed` with the `SYNC_RETRY_LATER_ERROR` message) whenever the
    > batch translation job is still running or a transient Google
    > infrastructure error occurs while starting/polling it. The Google
    > operation reference is preserved in these cases so the next poll resumes
    > the same job rather than starting a duplicate one.

</details>

<details><summary>Bug Fixes (23)</summary>

- **KMLExport**: add simplekml to requirements ([#7245](https://github.com/kobotoolbox/kpi/pull/7245))
    > <!-- 📣 Summary -->
    > Fixes deployment issue where the build failed due to a missing python
    > dependency required for KML export.

- **account**: delete button disabled check ([#7269](https://github.com/kobotoolbox/kpi/pull/7269))
    > <!-- 📣 Summary -->
    > 
    > Fixed an issue where users who deleted all their projects could still be
    > blocked from deleting their account because non-project assets were
    > counted by mistake.

- **auth**: handle user names from IdP and metadata refactor ([#7215](https://github.com/kobotoolbox/kpi/pull/7215))
    > <!-- 📣 Summary -->
    > Map standard SCIM name attributes (givenName, familyName, and formatted)
    > natively to Kobo user fields (User.first_name, User.last_name, and
    > ExtraUserDetail.data['name']) during SCIM provisioning.
    > 
    > <!-- 📖 Description -->
    > Previously, Kobo's SCIM implementation did not natively capture standard
    > name payload attributes from the IdP when creating or updating users.
    > This resulted in new users appearing with empty full names inside the
    > Kobo frontend. This PR resolves the issue by intercepting the standard
    > SCIM core schema attributes for names and mapping them to their
    > appropriate Kobo storage locations:
    > 
    > * `name.givenName` → `User.first_name`
    > * `name.familyName` → `User.last_name`
    > * `name.formatted` → `ExtraUserDetail.data['name']`
    > 
    > - Refactored the core extraction logic inside
    > kobo/apps/kobo_scim/utils.py. Created a helper function
    > `get_scim_value()` that parses both nested JSON dictionaries and SCIM
    > extension URN paths
    > - Unified Metadata Application: Updated `apply_scim_user_metadata()` to
    > natively process standard SCIM core fields alongside the configurable
    > custom metadata mappings (`USER_METADATA_FIELDS`). Because this utility
    > handles all mapping, POST, PUT, and PATCH API requests automatically
    > receive this behavior without duplicating code in the view layer
    > - Updated `ScimUserSerializer.get_name()` to fetch the formatted name
    > from ExtraUserDetail so the SCIM API returns the correct data. It safely
    > falls back to concatenating first_name and last_name if formatted is
    > omitted

- **bulkProcessing**: skip already-accepted versions in bulk-accept ([#7208](https://github.com/kobotoolbox/kpi/pull/7208))
    > <!-- 📣 Summary -->
    > The bulk-accept endpoint (`POST
    > /api/v2/assets/{uid_asset}/data/supplements/bulk/`) was re-stamping
    > `_dateAccepted` and counting already-accepted submissions on every call,
    > making `accepted_count` misleading. Added a guard in
    > `BulkAcceptSerializer.accept()` to skip versions where `_dateAccepted`
    > is already set.
    > 
    > <!-- 📖 Description -->
    > Calling the bulk-accept endpoint multiple times for the same submission
    > always returned `accepted_count: 1` (or more), even though no new
    > acceptance action was performed. The caller had no way to distinguish
    > "just accepted" from "already accepted".
    > 
    > This PR adds an early continue in the per-supplement loop when
    > latest_version.get(`_dateAccepted`) is already truthy. Already-accepted
    > versions are now silently skipped `_dateAccepted` is not modified and
    > the supplement is excluded from `to_update`, so `accepted_count`
    > correctly reflects only newly accepted records.

- **constance**: add new setting to fieldsets ([#7255](https://github.com/kobotoolbox/kpi/pull/7255))
    > <!-- 📣 Summary -->
    > Fixes an error that was preventing saves to Constance.

- **constance**: add new default ([#7266](https://github.com/kobotoolbox/kpi/pull/7266))
    > <!-- 📣 Summary -->
    > Fixes a bug that was preventing constance from being updated when there
    > was no initial TOS update date.

- **formBuilder**: translate entire validation logic string ([#7272](https://github.com/kobotoolbox/kpi/pull/7272))
    > <!-- 📣 Summary -->
    > Allow validation logic description in formbuilder to be translatable.

- **gallery**: heic images not being displayed ([#7206](https://github.com/kobotoolbox/kpi/pull/7206))
    > <!-- 📣 Summary -->
    > 
    > HEIC images now show up in the Project → Data → Gallery view.

- **import**: forbid bad names in import ([#7227](https://github.com/kobotoolbox/kpi/pull/7227))
    > <!-- 📣 Summary -->
    > Forbid uploading assets with bad node names
    > 
    > <!-- 📖 Description -->
    > Previously we allowed users to upload assets with spaces or other
    > non-xml-compliant characters in the node names, then sanitized those
    > names when we deployed, resulting in a mismatch between the asset
    > content and what was in submissions and breaking the data table in some
    > cases.

- **import**: forbid duplicate names on import ([#7240](https://github.com/kobotoolbox/kpi/pull/7240))
    > <!-- 📣 Summary -->
    > Do not allow users to import XLS files with duplicate names.
    > 
    > <!-- 📖 Description -->
    > Previously, users were allowed to import XLS files with duplicate names
    > that were then renamed on deploy. Update the import process to no longer
    > allow this.

- **longRunningMigrations**: convert legacy googlets to automatic_google_transcription in LRM 0024 ([#7228](https://github.com/kobotoolbox/kpi/pull/7228))
    > <!-- 📣 Summary -->
    > 
    > Fixes a background data upgrade so that older automatic-transcription
    > results are carried into the current format instead of stopping the
    > upgrade for an entire server.
    > 
    > <!-- 📖 Description -->
    > 
    > The background task that upgrades legacy qualitative-analysis / NLP data
    > stopped with an error on some servers when a project still referenced a
    > pre-migration transcription result. It now converts those legacy results
    > into the current format and finishes the upgrade.

- **longRunningMigrations**: do not tag XForm as failed on Celery timeout ([#7267](https://github.com/kobotoolbox/kpi/pull/7267))
    > <!-- 📣 Summary -->
    > 
    > A background data-repair task could permanently skip a form's
    > submissions, either when it ran out of time or when it hit an old
    > submission it did not know how to handle. It now resumes on the next
    > cycle and handles those old submissions instead of giving up for good.

- **myLibrary**: submenu size ([#7213](https://github.com/kobotoolbox/kpi/pull/7213))
    > <!-- 📣 Summary -->
    > 
    > Fixes "Move to" (collection) submenu to adjust size based on number of
    > items in it.

- **pairedData**: return null source for deleted parent projects ([#7218](https://github.com/kobotoolbox/kpi/pull/7218))
    > <!-- 📣 Summary -->
    > When a source project used for a connected (paired) dataset is deleted,
    > it is now clearly reported as deleted rather than still appearing as a
    > normal source.
    > 
    > <!-- 📖 Description -->
    > Connected projects pull data from a "source" project. If that source
    > project was deleted, the paired-data endpoint kept listing it as if it
    > were a live source, which the connected-projects UI couldn't reliably
    > detect. The deleted source's `source` link is now returned as `null`,
    > giving the frontend a dependable signal.

- **parsers**: preserve raw filenames beyond 255 chars ([#7234](https://github.com/kobotoolbox/kpi/pull/7234))
    > <!-- 📣 Summary -->
    > 
    > Fixed a server error that blocked KoboCollect submissions for projects
    > with very long names.
    > 
    > <!-- 📖 Description -->
    > 
    > Submitting a form from KoboToolbox Collect could fail with a server
    > error when the project name was very long. Submissions now succeed
    > regardless of name length, so no data is lost.

- **project settings**: remove deployment check for showing anonymous submission permission option ([#7277](https://github.com/kobotoolbox/kpi/pull/7277))
    > <!-- 📣 Summary -->
    > Removes a check for project deployment status that determined whether or
    > not the checkbox for enabling anonymous users to view submission data
    > was visible, so users can now view/toggle option for undeployed
    > projects.

- **project-views**: return asset_count for users list ([#7264](https://github.com/kobotoolbox/kpi/pull/7264))
    > <!-- 📣 Summary -->
    > 
    > Fixes a server error when listing the users of a project view.
    > 
    > <!-- 📖 Description -->
    > 
    > Opening the **Users** tab of a project view failed with a server error
    > and showed no one. The list now loads correctly again, including each
    > user's project count.

- **storybook**: missing settings causing crash ([#7263](https://github.com/kobotoolbox/kpi/pull/7263))
- **subsequences**: make translation _dependency optional in schema ([#7262](https://github.com/kobotoolbox/kpi/pull/7262))
    > <!-- 📣 Summary -->
    > 
    > Corrects the data API documentation so it no longer claims that every
    > translation always has a linked source transcript.
    > 
    > <!-- 📖 Description -->
    > 
    > In the API, each translation records which transcript it was based on.
    > Deleted translations don't have one. The documentation wrongly listed
    > that link as always present — it's now marked optional, matching what
    > the API actually returns.

- **supplement**: include null value for deleting automatic transcription/translation ([#7239](https://github.com/kobotoolbox/kpi/pull/7239))
    > <!-- 📣 Summary -->
    > 
    > API-schema fix
    > 
    > <!-- 📖 Description -->
    > 
    > The API reference for automatic transcription and translation now
    > documents that a result can be deleted by sending an empty (null) value.
    > This only affects the API documentation and generated API client; the
    > delete itself already worked.

- **tests**: remove unused parameter ([#7251](https://github.com/kobotoolbox/kpi/pull/7251))
- **versions**: allow date_deployed to be false in version responses ([#7249](https://github.com/kobotoolbox/kpi/pull/7249))
    > <!-- 📣 Summary -->
    > 
    > Corrects the deployment date the API reports for form versions that were
    > never deployed.
    > 
    > <!-- 📖 Description -->
    > 
    > In a form's version history, versions that were never deployed have no
    > deployment date. The API already returns this correctly, but its
    > published type description wrongly claimed the deployment date is always
    > a date. This corrects the description so the value is understood as
    > either a date or "not deployed" — matching what the API actually
    > returns. There is no visible change in the app.

- **xlsForm**: keep leading "=" in labels as text instead of a formula ([#7282](https://github.com/kobotoolbox/kpi/pull/7282))
    > <!-- 📣 Summary -->
    > 
    > Question and choice labels that start with an equals sign (e.g. `=foo`)
    > now display and export correctly instead of turning into `0` or a
    > spreadsheet error.
    > 
    > <!-- 📖 Description -->
    > 
    > If a label began with `=`, it was mistaken for a spreadsheet formula.
    > The deployed form showed `0` in place of the label in Enketo, and
    > exporting the form to XLSForm produced an error (`Err:520`) where the
    > label should be. Labels (and other cells) starting with `=` are now kept
    > as plain text everywhere.

</details>

<details><summary>Performance (1)</summary>

- **asset**: fetch permissions once in Asset detail endpoint ([#7238](https://github.com/kobotoolbox/kpi/pull/7238))
    > <!-- 📣 Summary -->
    > 
    > Opening a single project or collection is a bit faster — the server does
    > less redundant work per request.
    > 
    > <!-- 📖 Description -->
    > 
    > When you open a project or collection, the server was preparing its
    > permission information twice. It now does that once, so detail pages
    > load slightly faster. Nothing changes in what you see.

</details>

<details><summary>Build & Dependencies (1)</summary>

- **storybook**: update storybook to v10 ([#7212](https://github.com/kobotoolbox/kpi/pull/7212))
    > <!-- 📣 Summary -->
    > 
    > Upgraded Storybook from v9 to v10 for compatibility with modern tooling
    > and Node 20.19+. And hopes of making it behave better.
    > 
    > ### 👷 Description for instance maintainers
    > 
    > This upgrade requires Node 20.19.0 or newer (was 20.18.1). The `.nvmrc`
    > file has been updated, so `nvm use` will switch to the correct version.
    > Although the version bump was due to Storybook (code testing), the
    > version bump is project wide, so it influences the production code
    > building too.

</details>

<details><summary>Testing (3)</summary>

- **frontend**: use orval to generate MSW mocks ([#7219](https://github.com/kobotoolbox/kpi/pull/7219))
    > <!-- 📣 Summary -->
    > 
    > Migrates from manually maintained API mocks to Orval-generated ones for
    > type-safe mocking in Storybook stories and tests. Ensures OpenAPI schema
    > is the single source of truth for both API types and mock data.

- **storybook**: fix DeleteAccountBanner tests ([#7276](https://github.com/kobotoolbox/kpi/pull/7276))
- **storybook**: fix processing column story ([#7287](https://github.com/kobotoolbox/kpi/pull/7287))
</details>

<details><summary>Security (1)</summary>

- **npm**: pin minimist with override ([#7253](https://github.com/kobotoolbox/kpi/pull/7253))
    > <!-- 📣 Summary -->
    > Pins an override version for the minimist transitive dependency to avoid
    > security issues from older versions pinned by older, umaintained direct
    > dependencies.

</details>

<details><summary>Refactor (6)</summary>

- **fonts**: replace webfonts-generator ([#7265](https://github.com/kobotoolbox/kpi/pull/7265))
- **frontend**: use Links for navigation ([#7257](https://github.com/kobotoolbox/kpi/pull/7257))
    > <!-- 📣 Summary -->
    > 
    > Updated navigation-related buttons to use route links for better UX.

- **projectDownloads**: migrate components to functional ([#7247](https://github.com/kobotoolbox/kpi/pull/7247))
- **projectSettings**: tsify ([#7190](https://github.com/kobotoolbox/kpi/pull/7190))
- **projectSettings**: split files ([#7193](https://github.com/kobotoolbox/kpi/pull/7193))
- **settings**: standardize Constance env overrides to CONSTANCE_ prefix ([#7230](https://github.com/kobotoolbox/kpi/pull/7230))
    > ### 🔗 Related PRs
    > Part of a 3-repo Constance env-var standardization:
    > - **kobotoolbox/kobo-install#279** — same rename in the kobo-install env
    > template
    > - **kobotoolbox/kobo-docker#373** — same rename in the kobo-docker
    > default env file
    > 
    > Backward compatibility is preserved (see below), so these can land
    > independently — the deploy-repo PRs simply complete the migration to the
    > new names.
    > 
    > <!-- 📣 Summary -->
    > Standardize all Constance override env vars on a single `CONSTANCE_`
    > prefix.
    > 
    > <!-- 📖 Description -->
    > The env vars that override Constance defaults used three conventions
    > (bare, `KOBO_`, `CONSTANCE_`). This unifies them on `CONSTANCE_`,
    > matching the existing `CONSTANCE_ASR_MT_GOOGLE_*` precedent.

</details>

<details><summary>Chores (3)</summary>

- **frontend**: delete leftover file ([#7214](https://github.com/kobotoolbox/kpi/pull/7214))
- **frontend**: remove leftover $ characters after #6987 ([#7274](https://github.com/kobotoolbox/kpi/pull/7274))
- **openapi**: type data_sharing in Open API assetsPartialUpdate request model ([#7252](https://github.com/kobotoolbox/kpi/pull/7252))
    > <!-- 📣 Summary -->
    > Remodeled the data_sharing property properly in AssetPatchRequest and
    > cleaned up boilerplate code. Also updated `connectProject.tsx` to use
    > the new geneated model.
    > 
    > <!-- 📖 Description -->
    > * Replaced the drf-spectacular schema extensions with natively supported
    > DRF discriminated unions using a `PolymorphicProxySerializer` that
    > allows the backend to generate `oneOf` blocks from DRF serialization
    > structures. Remodeled the data_sharing property properly in
    > `AssetPatchRequest`.
    > * Deleted `AssetCreateRequestSerializerExtension`,
    > `AssetPatchRequestSerializerExtension`, and
    > `BulkPayloadSerializerExtension` from
    > `kpi/schema_extensions/v2/assets/extensions.py`. This reduces
    > boilerplate and prevents future disconnects between the codebase logic
    > and the OpenAPI JSON mapping
    > * With the correct model for `PatchedAssetPatchRequest` (including the
    > data_sharing: `{ enabled, fields }` structure), we removed the explicit
    > `as any` typing workaround in `connectProjects.tsx`

</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.27a..2.026.30
<!-- generated by git-cliff -->
