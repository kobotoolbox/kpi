<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (27)</summary>

- **api**: add endpoint to return the total length of all audio ([#7151](https://github.com/kobotoolbox/kpi/pull/7151))
    > <!-- 📣 Summary -->
    > This PR adds a new endpoint that returns the duration of audio
    > attachments, allowing the front-end to calculate total transcription
    > time without downloading and processing each file.
    > 
    > <!-- 📖 Description -->
    > This PR introduces a new endpoint, `POST
    > /api/v2/assets/{asset_uid}/attachments/audio-duration/`, which accepts a
    > list of attachment UIDs and returns the duration of each audio file
    > along with the total duration.
    > 
    > A new `audio_length` field has been added to the `Attachment` model to
    > cache audio durations. When a request is made:
    > 
    > * If `Attachment.audio_length` is already populated, the stored value is
    > returned directly.
    > * Otherwise, the duration is extracted using `ffprobe`, saved to
    > `audio_length`, and then returned in the response.
    > 
    > This caching mechanism improves performance and avoids repeatedly
    > processing the same files. The endpoint also returns per-attachment
    > durations to support future front-end features that may need to display
    > file-level duration information.

- **asset**: allow owners to delete empty assets ([#7090](https://github.com/kobotoolbox/kpi/pull/7090))
    > <!-- 📣 Summary -->
    > Allow users to delete assets they have created if there are no
    > submissions.
    > 
    > <!-- 📖 Description -->
    > Extends permission to delete an asset to a user if:
    > 1. They created the asset
    > 2. They have the manage_asset permission
    > 3. The asset has no submissions

- **auditLogs**: make log lifespan an environment setting ([#7108](https://github.com/kobotoolbox/kpi/pull/7108))
    > <!-- 📣 Summary -->
    > Move audit log retention configurations from Constance to an environment
    > configuration.

- **auditLogs**: util for getting max lookback days ([#7122](https://github.com/kobotoolbox/kpi/pull/7122))
- **auditLogs**: filter list endpoints by lookback ([#7137](https://github.com/kobotoolbox/kpi/pull/7137))
    > <!-- 📣 Summary -->
    > Restrict API endpoints for audit logs to only look back the number of
    > days allowed by the user's subscription.
    > 
    > <!-- 📖 Description -->
    > Restricts the following endpoints:
    > - audit logs
    > - access logs (personal and global)
    > - project history logs (project-specific and global)
    > If stripe is not enabled, the number of days allowed is set based on the
    > log retention settings of the server.

- **auditLogs**: limit export lookback ([#7140](https://github.com/kobotoolbox/kpi/pull/7140))
    > <!-- 📣 Summary -->
    > Limit audit logs exported according to the maximum lookback allowed to
    > the user.
    > 
    > <!-- 📖 Description -->
    > Uses the same limits as the API endpoints.

- **auth**: add failed login attempts ([#7166](https://github.com/kobotoolbox/kpi/pull/7166))
    > <!-- 📣 Summary -->
    > Added application-level logging for failed login attempts and exposed
    > them in the access logs UI and API
    > 
    > <!-- 📖 Description -->
    > Failed authentications are tracker similar to how successful logins are
    > recorded, using audit logs. It also tracks failed logins for
    > non-existent accounts to help identify automated attacks (e.g. repeated
    > attempts across random usernames from a single IP).
    > 
    > * For this it hooks into Django's user_login_failed signal to create
    > AccessLog entries with a new AUTH_FAILED action. Safely handles
    > instances without an attached HTTP request or user object
    > * Updated AccessLogSerializer to expose the new action attribute. For
    > non-existent accounts where the user relationship is null, it falls back
    > to exposing the attempted_username stored in the metadata
    > * Updated OpenAPI outputs and TypeScript models to include action. Added
    > a "Status" column to the AccessLogsSection component table to clearly
    > distinguish between Success and Failed logins.

- **bulkProcessing**: implement background execution and polling for bulk actions ([#7080](https://github.com/kobotoolbox/kpi/pull/7080))
    > 📣 Summary
    > Users can now successfully run bulk transcription and translation jobs
    > in the background, with real-time progress tracking and automatic
    > recovery if a network interruption occurs.
    > 
    > 📖 Description
    > This PR implements the core background processing engine for
    > SubsequenceBulkAction using Celery. It ensures that large-scale audio
    > processing and translation tasks run asynchronously without blocking the
    > main API threads.
    > 
    > **Key Architectural Highlights:**
    > * **Job Orchestration:** Added `start_bulk_item_job` to safely delegate
    > individual submissions to the existing
    > `SubmissionSupplement.revise_data()` flow, ensuring complete
    > compatibility with existing NLP schemas.
    > * **Progress Polling:** Implemented `update_batch_status` utilizing
    > pessimistic database locking (`select_for_update(skip_locked=True)`) to
    > safely calculate and update the parent job's overall progress percentage
    > without triggering deadlocks.
    > * **Feature Auto-Provisioning:** Updated the creation serializer to
    > automatically provision the necessary `QuestionAdvancedFeature` (the
    > backend column) if it does not already exist for the requested language.
    > * **System Resilience:** Introduced a `resume_stuck_bulk_actions`
    > watchdog task (run every 5 minutes) to automatically resume polling for
    > jobs that experience worker restarts, timeouts, or pod terminations.
    > * **Async Guard Fix:** Updated the execution guard in `base.py` to
    > ensure long-running Google Cloud operations properly trigger the
    > downstream polling mechanism without getting trapped in an infinite
    > `in_progress` state.
    > * `BULK_ACTION_STATUS_POLL_INTERVAL` (Default: `30` seconds): Determines
    > how frequently the background task queries individual child submissions
    > to compute the overall parent batch progress percentage.
    > * `BULK_ACTION_STUCK_THRESHOLD` (Default: `300` seconds / 5 minutes):
    > The expiration window after which an active bulk action job is flagged
    > as "stuck" due to potential worker pod crashes or unexpected container
    > restarts.

- **bulkProcessing**: add OpenAPI schema documentation for bulk actions APIs ([#7111](https://github.com/kobotoolbox/kpi/pull/7111))
    > <!-- 📣 Summary -->
    > This PR implements the OpenAPI specifications for the
    > `SubsequenceBulkAction` ViewSet using `drf-spectacular`.
    > 
    > <!-- 📖 Description -->
    > This PR also adds the `progress` and `failure_error` fields to the API
    > response schemas, allowing clients to track the progress of background
    > bulk tasks and inspect failure details when errors occur.

- **bulkProcessing**: implement bulk processing history log action ([#7114](https://github.com/kobotoolbox/kpi/pull/7114))
    > <!-- 📣 Summary -->
    > Add `ProjectHistoryLog` entries for bulk transcription and translation
    > jobs, including progress and final status updates.
    > 
    > <!-- 📖 Description -->
    > Bulk processing actions now appear in a `ProjectHistoryLog`. When a user
    > starts a bulk transcription or translation job, Backend creates a single
    > `ProjectHistoryLog` entry that tracks the job's progress and status. The
    > log is updated as submissions are processed, allowing users to monitor
    > bulk-processing operations directly from the project's activity history.

- **bulkProcessing**: hide feature based on admin setting ([#7113](https://github.com/kobotoolbox/kpi/pull/7113))
    > <!-- 📣 Summary -->
    > 
    > Only users with ASR/MT enabled can see or use bulk transcription and
    > translation in the data table.

- **bulkProcessing**: handle new activity log ([#7116](https://github.com/kobotoolbox/kpi/pull/7116))
    > <!-- 📣 Summary -->
    > 
    > Project Activity now supports the new backend bulk-processing history
    > action, with clear user-facing messages for transcription/translation
    > jobs and a proper Bulk processing filter option.

- **bulkProcessing**: skip already-processed submissions in bulk actions ([#7142](https://github.com/kobotoolbox/kpi/pull/7142))
    > <!-- 📣 Summary -->
    > Previously, if any submission in a bulk action request had an existing
    > result or an active conflicting job, the entire request was rejected
    > with a 400. This PR changes the behavior so eligible submissions are
    > processed and ineligible ones are silently skipped, with their UUIDs
    > returned in `skipped_uuids` on the POST response. A 400 is only returned
    > if every submission is ineligible.
    > 
    > <!-- 📖 Description -->
    > Previously `_validate_no_existing_results` and
    > `_validate_no_active_bulk_conflicts` raised a 400 if any submission was
    > ineligible. Now, 400 is only raised if all submissions are ineligible.
    > The POST response includes `skipped_uuids` so callers know which
    > submissions were excluded.

- **bulkProcessing**: add bulk transcription modal ([#7109](https://github.com/kobotoolbox/kpi/pull/7109))
    > <!-- 📣 Summary -->
    > Adds modal to allow bulk transcribing multiple audio submissions

- **bulkProcessing**: make bulk activity message interactive ([#7153](https://github.com/kobotoolbox/kpi/pull/7153))
    > <!-- 📣 Summary -->
    > 
    > Activity log now displays ongoing bulk transcription and translation
    > jobs with real-time progress tracking and the ability to cancel them.

- **bulkProcessing**: add bulk translation modal ([#7134](https://github.com/kobotoolbox/kpi/pull/7134))
    > <!-- 📣 Summary -->
    > Adds modal to allow bulk translation for multiple transcripts

- **bulkProcessing**: in progress banner and request toast ([#7156](https://github.com/kobotoolbox/kpi/pull/7156))
    > <!-- 📣 Summary -->
    > 
    > Show bulk processing banner immediatelly after bulk job is created. Show
    > additional activity log link for users who created jobs. Also show a
    > toast on bulk job creation success.

- **bulkProcessing**: add toast notification when bulk translation request succeeds ([#7175](https://github.com/kobotoolbox/kpi/pull/7175))
    > <!-- 📣 Summary -->
    > 
    > Show toast notification when bulk translation request succeeds.

- **bulkProcessing**: poll for ongoing bulk action and update table ([#7106](https://github.com/kobotoolbox/kpi/pull/7106))
    > <!-- 📣 Summary -->
    > 
    > Data Table now keeps bulk-processing rows up to date automatically by
    > polling active jobs and refreshing completed cells without needing a
    > manual page refresh. Hidden behind a feature flag.

- **deleteAsset**: migrate asset delete modal to Mantine ([#7110](https://github.com/kobotoolbox/kpi/pull/7110))
    > <!-- 📣 Summary -->
    > Deleting a project now uses the new Mantine ported confirmation modal
    > flow while keeping the same safety checks as before.

- **frontend**: mantineify AssetTagsModal ([#7115](https://github.com/kobotoolbox/kpi/pull/7115))
    > <!-- 📣 Summary -->
    > 
    > Modernize looks of "Edit tags" modal in My Library.

- **frontend**: enable filtering for hidden question type ([#7123](https://github.com/kobotoolbox/kpi/pull/7123))
    > <!-- 📣 Summary -->
    > 
    > Make it possible to filter `hidden` questions in Project → Data → Table.

- **frontend**: add Mantine notifications ([#7120](https://github.com/kobotoolbox/kpi/pull/7120))
    > <!-- 📣 Summary -->
    > 
    > Enabled Mantine notifications across the app and Storybook, and added a
    > Design System story that demonstrates triggering a notification with
    > notifications.show.

- **frontend**: introduce kobo-themed mantine focus styles ([#7129](https://github.com/kobotoolbox/kpi/pull/7129))
    > <!-- 📣 Summary -->
    > 
    > Improved keyboard focus visibility across Kobo by replacing inconsistent
    > focus styling with a shared Kobo-themed focus ring for Mantine and
    > legacy UI controls.

- **frontend**: update button and pill ([#7152](https://github.com/kobotoolbox/kpi/pull/7152))
    > <!-- 📣 Summary -->
    > 
    > Added Pill component wrapper with gray-light and amber-light variants,
    > improved Button stories organization, and updated amber color palette.

- **map**: improve settings modal tabs logic ([#7117](https://github.com/kobotoolbox/kpi/pull/7117))
    > <!-- 📣 Summary -->
    > 
    > Map display settings modal now has a consistent and tested tab display
    > behaviour. The order of the tabs is now enforced and kept the same.

- **projectViews**: creating Project Views with organizations besides countries ([#7138](https://github.com/kobotoolbox/kpi/pull/7138))
    > <!-- 📣 Summary -->
    > Added the capability for server admins to define Project Views based on
    > organization uid's (Teams), while continuing to support the existing
    > country-based filtering approach.
    > 
    > <!-- 📖 Description -->
    > * Introduced uid_organizations field to ProjectView to store
    > comma-separated organization uids, defaulting to * (that represents "all
    > teams") and added this field to the serializer class, the admin list
    > display
    > * Implemented `get_uid_organizations()` method for processing and
    > stripping white spaces from the UID list.
    > * Updated get_project_view_user_permissions_for_asset logic to include
    > an intersecting query matching the asset owner's organization against
    > the `ProjectView.uid_organizations` list.
    > * Refactored _get_regional_queryset to evaluate and filter the query
    > sets depending on whether the asset owner or the target user is a member
    > of any of the specified organizations (using
    > organizations_organization). If uid_organizations contains *, it behaves
    > like the original logic without enforcing organizational filtering
    > * Included basic unit tests for project views filters and permissions
    > code

</details>

<details><summary>Bug Fixes (13)</summary>

- **assets**: fix 500 when parent uid is wrong ([#7168](https://github.com/kobotoolbox/kpi/pull/7168))
    > <!-- 📣 Summary -->
    > Return an empty list instead of an error when an invalid parent id is
    > passed to the asset list filter query.

- **dataTable**: bulk processing stories not working ([#7130](https://github.com/kobotoolbox/kpi/pull/7130))
- **dataTable**: filter input losing focus ([#7148](https://github.com/kobotoolbox/kpi/pull/7148))
    > <!-- 📣 Summary -->
    > 
    > Fixed filter inputs in the Data Table losing focus while typing, which
    > caused keystrokes to be lost after query completion.

- **editableForm**: stale closure and cache mutability issues ([#7139](https://github.com/kobotoolbox/kpi/pull/7139))
    > <!-- 📣 Summary -->
    > 
    > Fixed two bugs in Form Builder: event listeners weren't cleaning up on
    > unmount (memory leak), and the react-query cache was exposed to direct
    > mutation from Backbone code.

- **formMedia**: improve multiple pending uploads handling ([#7095](https://github.com/kobotoolbox/kpi/pull/7095))
    > <!-- 📣 Summary -->
    > 
    > Form Media now keeps the loading indicator visible until all dropped
    > files finish uploading, reducing confusing false-failure moments during
    > multi-file uploads.
    > 
    > <!-- 📖 Description -->
    > 
    > This PR continues the Form Media modernization and fixes the key UX bug
    > from .
    > 
    > Previously, when users dropped multiple files, the loading spinner could
    > disappear after early files finished, even while large files were still
    > uploading. That made it look like upload had stopped, and users could
    > retry too early and hit misleading duplicate-file errors.
    > 
    > Now the spinner remains visible until every in-flight file upload
    > settles.
    > The PR also includes stronger story coverage for the multi-file case and
    > a small cleanup pass to make behavior and tests more reliable.

- **library**: use full metadata flow when creating project from template ([#7161](https://github.com/kobotoolbox/kpi/pull/7161))
    > <!-- 📣 Summary -->
    > 
    > Fixed bug where creating a project from a template in My Library skipped
    > the metadata prompt, leaving required fields blank.

- **map**: include start-geopoint in Project → Data → Map UI ([#7136](https://github.com/kobotoolbox/kpi/pull/7136))
    > <!-- 📣 Summary -->
    > 
    > Map now shows submissions that only have `start-geopoint` data. Before
    > this, the map stayed empty if your project collected locations via
    > `start-geopoint` but didn't have any geopoint questions.

- **myLibrary**: popover menu items not working 2nd time ([#7163](https://github.com/kobotoolbox/kpi/pull/7163))
    > <!-- 📣 Summary -->
    > 
    > Fix issue with My Library "…" ("More actions") dropdown options not
    > working after trying to use them 2nd time.

- **nlp**: remove region selector from translation step ([#7174](https://github.com/kobotoolbox/kpi/pull/7174))
    > <!-- 📣 Summary -->
    > Remove region selector from the translate step in the single processing
    > view.

- **reports**: general color override doesn't work for single report with custom type ([#7118](https://github.com/kobotoolbox/kpi/pull/7118))
    > <!-- 📣 Summary -->
    > 
    > Fixed report color behavior so chart colors update consistently across
    > chart types and still inherit global color changes after per-question
    > chart-type overrides.

- **reports**: disable restricted report actions ([#7162](https://github.com/kobotoolbox/kpi/pull/7162))
    > <!-- 📣 Summary -->
    > Disables custom report buttons when the user doesn't have the correct
    > permissions.

- **storybook**: unreliable asset tags modal test ([#7149](https://github.com/kobotoolbox/kpi/pull/7149))
    > <!-- 📣 Summary -->
    > Fixes AssetTagsModal storybook test by removing check for modal being
    > removed from the dom.

- **tests**: fix failing google transcribe test ([#7160](https://github.com/kobotoolbox/kpi/pull/7160))
    > <!-- 📣 Summary -->
    > Fix failing google transcribe test

</details>

<details><summary>Testing (2)</summary>

- **frontend**: make FormMedia tests more stable ([#7112](https://github.com/kobotoolbox/kpi/pull/7112))
- **subsequences**: fix bad Constance setting after merge ([3694aaf](https://github.com/kobotoolbox/kpi/commit/3694aaf13e3ab173863cb3824fed1873f29942bf))
</details>

<details><summary>Refactor (8)</summary>

- **assetTagsModal**: reorganise files ([#7132](https://github.com/kobotoolbox/kpi/pull/7132))
- **assetTagsModal**: make stories more stable ([#7146](https://github.com/kobotoolbox/kpi/pull/7146))
- **deleteAccountBanner**: make stories more stable ([#7144](https://github.com/kobotoolbox/kpi/pull/7144))
- **formLanguagesManager**: reorganise files ([#7133](https://github.com/kobotoolbox/kpi/pull/7133))
- **formMedia**: tsify, functional component, add stories ([#7093](https://github.com/kobotoolbox/kpi/pull/7093))
- **formMedia**: orvalify component ([#7135](https://github.com/kobotoolbox/kpi/pull/7135))
- **frontend**: remove PopoverMenu in favor of Mantine Menu ([#7165](https://github.com/kobotoolbox/kpi/pull/7165))
- **libraryUploadModal**: reorganise files ([#7131](https://github.com/kobotoolbox/kpi/pull/7131))
</details>

<details><summary>Chores (1)</summary>

- **migrations**: merge bulkaction and google region migrations ([2ee111d](https://github.com/kobotoolbox/kpi/commit/2ee111d81b8a9873efe9d99a11dac025d4c98eb4))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.23..2.026.25
<!-- generated by git-cliff -->
