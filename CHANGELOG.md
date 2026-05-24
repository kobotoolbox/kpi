<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (33)</summary>

- **api**: add new endpoints for asset counts ([#6853](https://github.com/kobotoolbox/kpi/pull/6853))
    > <!-- 📣 Summary -->
    > Add new endpoints for determining the count of draft, deployed, and
    > archived assets for a user, an organization, and a project view.
    > 
    > <!-- 📖 Description -->
    > Adds three new endpoints:
    > `/api/v2/assets/counts`
    > `api/v2/organizations/{org_id}/assets/counts`
    > `api/v2/project-views/{pv_id}/assets/counts`
    > each returning the number of draft, deployed, and archived assets in the
    > relevant scope.

- **api**: add assets minimal-list endpoints ([#6909](https://github.com/kobotoolbox/kpi/pull/6909))
    > <!-- 📣 Summary -->
    > 
    > New lightweight API endpoints return only `uid`, `name`, and
    > `deployment_status` for assets, with no `COUNT(*)` query.
    > 
    > <!-- 📖 Description -->
    > 
    > Three new read-only endpoints are available:
    > - `GET /api/v2/assets/minimal-list/`
    > - `GET /api/v2/organizations/{id}/assets/minimal-list/`
    > - `GET /api/v2/project-views/{id}/assets/minimal-list/`
    > 
    > Each returns a paginated list of assets with only `uid`, `name`, and
    > `deployment_status` (`draft`, `deployed`, `archived`). Responses omit
    > the `count` field. Use `?q=asset_type:survey AND
    > _deployment_status:status` to filter by type. Supports `limit` and
    > `start` pagination parameters.

- **auditLog**: log superuser admin actions to `AuditLog` ([#6856](https://github.com/kobotoolbox/kpi/pull/6856))
    > <!-- 📣 Summary -->
    > This PR introduces functionality to automatically capture actions
    > performed by superusers in the Django Admin interface and record them in
    > the `AuditLog` table using native Django signals.
    > 
    > <!-- 📖 Description -->
    > This change ensures a complete and reliable audit trail for all actions
    > performed by superusers within the Django Admin interface.
    > 
    > It leverages Django’s built-in `LogEntry` signal to capture admin events
    > globally, eliminating the need for custom mixins or per-model
    > `ModelAdmin` modifications. This approach guarantees consistent coverage
    > across all current and future admin-managed models.
    > 
    > Additionally, the implementation extracts and stores a concise,
    > human-readable summary of each action, improving log readability while
    > keeping storage efficient. Audit logs are also exposed via the
    > `/api/v2/audit-logs/` API for easy access and inspection.

- **auditLog**: log Constance config changes to `AuditLog` ([#6870](https://github.com/kobotoolbox/kpi/pull/6870))
    > <!-- 📣 Summary -->
    > This PR adds audit logging for configuration changes made via
    > django-constance by capturing updates through signals and recording them
    > in the `AuditLog` table.
    > 
    > <!-- 📖 Description -->
    > This change ensures that all configuration updates made through
    > django-constance are properly tracked, providing a reliable audit trail
    > for system-level changes performed by superusers.
    > 
    > It leverages Constance’s native `config_updated` signal to detect
    > changes and logs them centrally without requiring modifications to
    > existing config logic.
    > 
    > Each update is recorded with relevant context, including the config key,
    > previous value, and updated value.
    > 
    > The implementation also safely handles edge cases by skipping logging
    > when no request context is available or when the user is
    > unauthenticated.

- **auth**: allauth openapi docs ([#6961](https://github.com/kobotoolbox/kpi/pull/6961))
    > <!-- 📣 Summary -->
    > This PR exposes the django-allauth headless authentication API and
    > automatically merges its API docs into our core drf-spectacular OpenAPI
    > schemas. This allows our frontend generators (like Orval) to natively
    > build TypeScript interfaces for login, MFA, and profile management
    > flows.
    > 
    > <!-- 📖 Description -->
    > I've explicitly mounted `allauth.headless.urls` at `/api/v2/allauth/` so
    > that Django can successfully perform reverse route-lookups. Since
    > allauth's engine uses standard Python views instead of DRF ViewSets,
    > drf-spectacular cannot natively autodiscover them. A custom
    > postprocessing hook (`merge_allauth_headless_schema`) that fetches the
    > internal allauth dictionary, ingests all components, and manually
    > patches them into the final DRF schema payload.
    > 
    > The custom hook automatically flattens ambiguous path templates (like
    > `_allauth/{client}/v1/login`) into discrete, concrete endpoints
    > (`/browser/v1/login` and `/app/v1/login`) and automatically injects
    > unique operationId handles to avoid conflicts with other endpoints
    > definitions.

- **autoQA**: add verification checkbox ([#6835](https://github.com/kobotoolbox/kpi/pull/6835))
    > <!-- 📣 Summary -->
    > Adds a checkbox for users to indicate when a manual or automatic QA
    > response has been verified.

- **autocomplete**: add custom Autocomplete and styles ([#6957](https://github.com/kobotoolbox/kpi/pull/6957))
    > <!-- 📣 Summary -->
    > 
    > Add theming to a new Autocomplete component

- **autoqa**: informative error for autoqa requests on unapproved transcripts ([#6930](https://github.com/kobotoolbox/kpi/pull/6930))
    > <!-- 📣 Summary -->
    > Returns a more informative error when users request an AI generated
    > response for a transcript that has not been approved.

- **autoqa**: remove feature flag ([#6935](https://github.com/kobotoolbox/kpi/pull/6935))
    > <!-- 📣 Summary -->
    > Remove feature flag for automatic qualitative analysis in preparation
    > for release.

- **bulkProcessing**: update google transcription and translation flow to accept `bulk_action_uid` ([#7058](https://github.com/kobotoolbox/kpi/pull/7058))
- **copyTeamPermissions**: remove allAssets ([#6893](https://github.com/kobotoolbox/kpi/pull/6893))
    > <!-- 📣 Summary -->
    > 
    > Make Copy Team Permissions feature properly load all available projects
    > and allow for searching particular one within the project selection
    > dropdown. Also stop using deprecated `allAssets` store.

- **frontend**: introduce tabler icons ([#6952](https://github.com/kobotoolbox/kpi/pull/6952))
    > <!-- 📣 Summary -->
    > 
    > Introduces `KoboIcon` component for displaying new icons. Adds a future
    > friendly way of using old icons as SVGs in new component.

- **frontend**: setup default invalidations ([#6985](https://github.com/kobotoolbox/kpi/pull/6985))
- **languages**: extend `languages` to support region, model and location configuration for ASR/MT services ([#6953](https://github.com/kobotoolbox/kpi/pull/6953))
    > <!-- 📣 Summary -->
    > This PR extends the languages app to support service-specific
    > configuration required by Google Speech-to-Text v2 and modern
    > translation APIs.
    > 
    > The change introduces region-based language configurations and allows
    > ASR/MT services to define model and location settings per language
    > region.
    > 
    > <!-- 📖 Description -->
    > Google Speech-to-Text v2 and translation services require additional
    > configuration beyond the base language code, such as region, model, and
    > service location. The existing languages app only stored basic language
    > codes and did not
    > support service-specific regional configurations.
    > 
    > This PR extends the languages infrastructure to support region-aware
    > configurations for ASR and MT services.

- **menu**: style Mantine's component ([#6963](https://github.com/kobotoolbox/kpi/pull/6963))
    > <!-- 📣 Summary -->
    > 
    > Change Menu component looks.

- **metadata**: expose extra project metadata fields in the `/environment` endpoint ([#6817](https://github.com/kobotoolbox/kpi/pull/6817))
    > <!-- 📣 Summary -->
    > Expose the extra project metadata fields via the `/environment` endpoint
    > to allow the frontend to dynamically fetch and display this data.

- **metadata**: ensure extra metadata fields are nested in asset settings ([#7027](https://github.com/kobotoolbox/kpi/pull/7027))
    > <!-- 📣 Summary -->
    > Added extra project metadata fields to the asset settings under a
    > dedicated section to ensure a more organized and reliable data structure

- **metadata**: add extra project metadata inputs to project settings ([#6895](https://github.com/kobotoolbox/kpi/pull/6895))
    > <!-- 📣 Summary -->
    > Superuser-defined custom project metadata fields are now supported on
    > the frontend and appear in the project settings.

- **metadata**: update library form to include extra project metadata inputs ([#6902](https://github.com/kobotoolbox/kpi/pull/6902))
    > <!-- 📣 Summary -->
    > Allow users to customize the details of library templates and
    > collections by adding the same project metadata used in the standard
    > project settings.

- **metadata**: update project summary to include extra project metadata ([#6923](https://github.com/kobotoolbox/kpi/pull/6923))
    > <!-- 📣 Summary -->
    > 
    > Update the Project Summary page to show the custom metadata fields
    > configured during the project setup process.

- **nlp**: upgrade automatic Google transcription to Speech-to-Text v2 batch API ([#6955](https://github.com/kobotoolbox/kpi/pull/6955))
    > <!-- 📣 Summary -->
    > This PR upgrades the automatic Google transcription service from the
    > Speech-to-Text v1 API to the v2 API.
    > 
    > The implementation uploads audio files to Google Cloud Storage, submits
    > a batch recognition job, and retrieves the resulting transcripts from
    > JSON output files written by Google.
    > 
    > The service now dynamically resolves the correct region and model using
    > the new languages configuration introduced in the languages app.
    > 
    > <!-- 📖 Description -->
    > The new implementation follows the v2 architecture:
    > 1. Audio files are uploaded to Google Cloud Storage
    > 2. A BatchRecognize job is created
    > 3. Google processes the audio asynchronously
    > 4. Transcription results are written as JSON files to Cloud Storage
    > 5. The service reads the output JSON and returns the transcript
    > 
    > The implementation supports two mechanisms for tracking long-running
    > operations:
    > - Cache-based tracking: Used for single transcription requests.
    > - Database-based tracking: Future bulk transcription operations will
    > store the Google operation id on `SubsequenceBulkActionItem`.

- **nlp**: add bulk-aware async workflow to `GoogleTranslationService` ([#6976](https://github.com/kobotoolbox/kpi/pull/6976))
    > <!-- 📣 Summary -->
    > Enhance `GoogleTranslationService` to support bulk-aware translation
    > workflows by reusing and polling existing asynchronous operations
    > instead of creating duplicate jobs.
    > 
    > <!-- 📖 Description -->
    > This PR updates the translation workflow to align with the bulk-aware
    > processing model introduced for transcription.
    > 
    > The implementation introduces support for an optional `bulk_action_uid`
    > parameter in `process_data()`. When provided, the service reuses or
    > polls an existing Google batch translation operation instead of creating
    > a new one. This prevents duplicate jobs and enables consistent tracking
    > across retries.

- **nlp**: add placeholder bulk actions API with drf-spectacular schema ([#7029](https://github.com/kobotoolbox/kpi/pull/7029))
    > <!-- 📣 Summary -->
    > This PR introduces placeholder API endpoints for bulk job management,
    > enabling frontend integration and API contract alignment before full
    > backend implementation.
    > 
    > <!-- 📖 Description -->
    > This PR adds placeholder endpoints for managing bulk transcription and
    > translation actions on assets. It includes support for listing,
    > retrieving, creating, and cancelling bulk actions.
    > 
    > The endpoints are intended to support frontend development through
    > generated API hooks, while the underlying business logic and database
    > models will be implemented in a later phase. At this stage, all
    > endpoints return a “Not Implemented” response, except for the cancel
    > operation which follows the agreed API contract.
    > 
    > This setup ensures that frontend and backend development can proceed in
    > parallel while maintaining a stable and well-defined API structure.

- **nlp**: add models for subsequence bulk action and item tracking ([#7043](https://github.com/kobotoolbox/kpi/pull/7043))
    > <!-- 📣 Summary -->
    > This PR introduces the database tables required to support bulk
    > transcription and translation jobs within the subsequences app.
    > 
    > <!-- 📖 Description -->
    > This PR implements the models necessary for orchestrating and tracking
    > bulk processing tasks.
    > 
    > - `SubsequenceBulkAction`: A parent model is created to represent a
    > batch execution, storing deterministic parameters and global status.
    > 
    > - `SubsequenceBulkActionItem`: A child model is implemented to track
    > individual submission processing within a bulk job, including an
    > external `service_id` for tracking Google operations.
    > 
    > - Idempotency via Hashing: A deterministic SHA-256 hash of job
    > parameters is utilized to prevent duplicate active jobs for the same
    > submission and action.
    > 
    > - Integrity Guarantees: Atomic creation logic is provided via
    > `create_with_items`, and status propagation is implemented to
    > synchronize parent and child states.
    > 
    > - Database Constraints: A `UniqueConstraint` is enforced to ensure only
    > one active job item exists per submission/action/hash combination.

- **notification**: add new notification with themes and stories ([#6947](https://github.com/kobotoolbox/kpi/pull/6947))
    > <!-- 📣 Summary -->
    > Adds mantine Notification component and apply our theme to it

- **qual**: escape xml in questions and transcripts ([#6874](https://github.com/kobotoolbox/kpi/pull/6874))
    > <!-- 📣 Summary -->
    > Escape user-entered xml before using it in an LLM prompt.

- **qual**: get model id from settings ([#6877](https://github.com/kobotoolbox/kpi/pull/6877))
- **qualitativeAnalysis**: add hints handling to UI ([#6871](https://github.com/kobotoolbox/kpi/pull/6871))
    > <!-- 📣 Summary -->
    > 
    > For qualitative analysis questions (and choices) add way to create and
    > display hints for.

- **qualitativeAnalysis**: show hints toggle ([#6892](https://github.com/kobotoolbox/kpi/pull/6892))
    > <!-- 📣 Summary -->
    > 
    > Add a persistent "Show hints" toggle in the Analysis UI.

- **subsequences**: implement `SubsequenceBulkAction` ViewSet and Serializer ([#7063](https://github.com/kobotoolbox/kpi/pull/7063))
    > <!-- 📣 Summary -->
    > Users can now create bulk transcription and translation jobs that
    > process multiple audio submissions at once, with full validation to
    > prevent duplicate or conflicting work.
    > 
    > <!-- 📖 Description -->
    > This PR adds the backend API for bulk NLP processing. Users can submit a
    > list of submission UUIDs for a single audio question and request
    > transcription or translation in bulk. The API validates that submissions
    > exist, that results don't already exist for the requested language, and
    > that no conflicting active job is already running for the same
    > submissions and parameters. All records are created atomically, if
    > anything fails, nothing is saved. Cancellation of bulk jobs will follow
    > in a separate task.

- **subsequences**: implement subsequence bulk action cancellation ([#7064](https://github.com/kobotoolbox/kpi/pull/7064))
    > <!-- 📣 Summary -->
    > Users can now cancel ongoing bulk transcription and translation jobs
    > directly through the interface, preventing unwanted automated
    > processing.
    > 
    > <!-- 📖 Description -->
    > This PR introduces a cancellation endpoint for bulk processing tasks.
    > When a bulk job is cancelled, all pending sub-tasks are halted before
    > they begin, and any active requests currently processing with Google
    > Cloud are instructed to stop. Completed sub-tasks are preserved exactly
    > as they are, and the system safely logs who performed the cancellation.

- **table**: add non-functional bulk processing UI ([#6975](https://github.com/kobotoolbox/kpi/pull/6975))
    > <!-- 📣 Summary -->
    > 
    > Add bulk processing buttons to Project → Data → Table, in the header
    > dropdowns (hidden behind feature flags). They are non-functional,
    > introduced for future PRs.

- feat(autoqa) update log action labels ([#6898](https://github.com/kobotoolbox/kpi/pull/6898))

<!-- 📣 Summary -->
Add human-friendly text for automatic QA log actions.
</details>

<details><summary>Bug Fixes (37)</summary>

- **CI**: switch all automatic uses npm install to npm ci ([#7062](https://github.com/kobotoolbox/kpi/pull/7062))
    > <!-- 📣 Summary -->
    > Switch all automated uses of `npm install` to `npm ci` to ensure version
    > consistency and security.

- **auth**: remove email verification contact links ([#7083](https://github.com/kobotoolbox/kpi/pull/7083))
    > <!-- 📣 Summary -->
    > Removes links inviting users to contact support on the verification_sent
    > and email_confirm view templates.

- **autoQA**: hide AI-related UI behind feature flag ([#6880](https://github.com/kobotoolbox/kpi/pull/6880))
    > <!-- 📣 Summary -->
    > Fix components where UI changes tied to the auto-qa feature were showing
    > up even without feature flag enabled.

- **autoqa**: improve over-limit error handling for NLP ([#6922](https://github.com/kobotoolbox/kpi/pull/6922))
    > <!-- 📣 Summary -->
    > Identify 402 errors from the backend and display the over-limit modal
    > instead of a generic error message when automatic NLP requests are
    > rejected.

- **autoqa**: unify naming for automatic analysis ([#6929](https://github.com/kobotoolbox/kpi/pull/6929))
    > <!-- 📣 Summary -->
    > Updates naming for automatic analysis request across the frontend UI.

- **connectProjects**: unhelpful error message ([#6956](https://github.com/kobotoolbox/kpi/pull/6956))
    > <!-- 📣 Summary -->
    > 
    > Provides a helpful error message with a list of invalid fields when
    > using Project → Settings → Connect Projects.

- **connectProjects**: deleted imported project issue ([#6971](https://github.com/kobotoolbox/kpi/pull/6971))
    > <!-- 📣 Summary -->
    > 
    > Fixes a problem with Connect Projects UI when an imported project was
    > removed before the import-link was deleted. The problem was causing an
    > infinite loading spinner (or crash).
    > 
    > Also migrated few old icons and buttons to latest components. Also
    > introduced a confirmation for imported project removing.

- **dataTable**: verified column doesn't use modal ([#6916](https://github.com/kobotoolbox/kpi/pull/6916))
    > <!-- 📣 Summary -->
    > 
    > Verified column in Project → Data → Table no longer displays option to
    > show a modal with full value. We always display "Yes", "No" or empty
    > cell, no need for modal.

- **formBuilder**: don't modify existing text operators ([#6921](https://github.com/kobotoolbox/kpi/pull/6921))
    > <!-- 📣 Summary -->
    > 
    > `text` questions with comparison operators will no longer get their
    > conditions modified (unknowlingy!) when saving in Form Builder.

- **formbuilder**: force select2 compatibility with jquery ([#7061](https://github.com/kobotoolbox/kpi/pull/7061))
    > <!-- 📣 Summary -->
    > Fixes incompatibility between outdated select2 dependency and jquery v4
    > via polyfills

- **frontend**: update links to support pages ([#6984](https://github.com/kobotoolbox/kpi/pull/6984))
- **icon**: change way of identifying legacy icons ([#6983](https://github.com/kobotoolbox/kpi/pull/6983))
    > <!-- 📣 Summary -->
    > 
    > Fixes a problem with some icon rendering.

- **icons**: missing legacy icon mapping ([#6982](https://github.com/kobotoolbox/kpi/pull/6982))
    > <!-- 📣 Summary -->
    > Resolve linting error on LegacyIcon mapping.

- **map**: enable map settings button when were are no geopoint responses ([#6828](https://github.com/kobotoolbox/kpi/pull/6828))
    > <!-- 📣 Summary -->
    > Allows the map settings button to show on top of the overlay if there
    > are no geopoint responses

- **map**: allow multiple queries on map display ([#6924](https://github.com/kobotoolbox/kpi/pull/6924))
    > <!-- 📣 Summary -->
    > Fixes a bug where the frontend was only displaying one page of results
    > (1000) regardless of the limit placed

- **map**: multiple UI issues ([#6962](https://github.com/kobotoolbox/kpi/pull/6962))
    > <!-- 📣 Summary -->
    > 
    > Fix few different UI issues in Project → Data → Map. Migrate old
    > components to new ones. Allow zooming map with pinch zoom gesture on
    > touchpad, and with ctrl + mouswheel.

- **map**: blank map for questions in group fix ([#7034](https://github.com/kobotoolbox/kpi/pull/7034))
    > <!-- 📣 Summary -->
    > 
    > Fixed the Project → Data → Map so geopoint answers inside groups are now
    > shown correctly instead of incorrectly showing "No geopoint responses
    > have been received".

- **menu**: item background on hover ([#7035](https://github.com/kobotoolbox/kpi/pull/7035))
- **mfa**: prevent superusers from deactivating MFA when `SUPERUSER_AUTH_ENFORCEMENT` is active ([#6928](https://github.com/kobotoolbox/kpi/pull/6928))
    > <!-- 📣 Summary -->
    > Ensure administrative accounts remain protected by preventing superusers
    > from disabling two-factor authentication when a security enforcement
    > configuration is enabled.

- **nlp**: suggest languages in language selector ([#7059](https://github.com/kobotoolbox/kpi/pull/7059))
    > <!-- 📣 Summary -->
    > Enabled a previously missing feature in the single processing view.
    > Users can now see a recently used language for transcripts/translations
    > in the language selector for those steps in the single processing view.

- **notification**: paddings ([#7012](https://github.com/kobotoolbox/kpi/pull/7012))
- **projects**: change delete and bulk delete button permissions ([#6903](https://github.com/kobotoolbox/kpi/pull/6903))
    > <!-- 📣 Summary -->
    > 
    > Enable delete/bulk delete buttons only if user has `delete_asset`
    > permission.

- **qual**: update LLM prompts for consistency ([#6859](https://github.com/kobotoolbox/kpi/pull/6859))
    > <!-- 📣 Summary -->
    > Aligns LLM prompts with the current wording and formatting in POC
    > implementation and fixes a bug where hints were silently dropped on
    > select_one questions.
    > 
    > <!-- 📖 Description -->
    > - Fix: select_one prompt was missing `{{hint}}` placeholder
    > - Tune: select_multiple example now shows 2 TRUEs to better represent
    > the expected multi-select response format
    > - Tune: temperature 0.1 → 0
    > - Style: numbered choices, consistent hint/rule formatting
    > 
    > <!-- This is an auto-generated comment: release notes by coderabbit.ai
    > -->
    > ## Summary by CodeRabbit
    > 
    > * **Improvements**
    >  * Set model temperature to 0 for more deterministic LLM responses
    >  * Reformatted prompt text to tighten spacing and line breaks
    >  * Enumerated choice display with indices (e.g., "1.", "2.")
    > * Changed hint formatting from parenthetical to dash-separated notation
    > * Refined example response generation for select-one and select-multiple
    > questions
    > <!-- end of auto-generated comment: release notes by coderabbit.ai -->

- **qual**: fix automatic qualitative analysis throttling tests ([#6862](https://github.com/kobotoolbox/kpi/pull/6862))
    > <!-- 📣 Summary -->
    > Updates `TestAutomaticQAThrottling` to use method-level decorators for
    > `boto3.client` mocks, ensuring that all requests including those
    > expected to be throttled are covered by the mock to prevent
    > environment-driven crashes.

- **qual**: do not allow deleting all choices ([#6873](https://github.com/kobotoolbox/kpi/pull/6873))
    > <!-- 📣 Summary -->
    > Forbid users from deleting all choices in a multiple choice QA question

- **qual**: graceful timeout handling for automatic qualitative analysis ([#6894](https://github.com/kobotoolbox/kpi/pull/6894))
    > <!-- 📣 Summary -->
    > This PR introduces strict timeout configurations for AWS Bedrock
    > requests to prevent unhandled 504 Gateway Timeout errors during
    > automatic qualitative analysis.
    > 
    > <!-- 📖 Description -->
    > This PR addresses an issue where slow responses from the LLM via AWS
    > Bedrock were causing the web server to sever the connection, resulting
    > in a 504 Gateway Timeout for the client.
    > - A strict timeout of 50 seconds (read) and 5 seconds (connect) is now
    > enforced on the `boto3` client via `botocore.config.Config`.
    > - The `run_external_process` loop is updated to catch
    > `ReadTimeoutError`.
    > - If a timeout occurs on the primary model, this PR ensures the system
    > gracefully falls back to the backup model.
    > - If all models time out, a clean JSON response with a failed status is
    > returned to the frontend rather than crashing the request.
    > - Unit tests have been updated and added to verify the timeout fallback
    > behavior.

- **qual**: remove explicit credentials from call to LLM ([#6886](https://github.com/kobotoolbox/kpi/pull/6886))
- **qual**: update Automated Qualitative Analysis primary bedrock model ([#6900](https://github.com/kobotoolbox/kpi/pull/6900))
    > <!-- 📣 Summary -->
    > This PR updates the primary AWS Bedrock model used for automatic
    > qualitative analysis to the standard, non-safeguarded version.
    > 
    > <!-- 📖 Description -->
    > This PR is introduced to replace the `openai.gpt-oss-safeguard-120b`
    > model with the standard `openai.gpt-oss-120b-1:0` model. The previous
    > safeguard model was found to be unsupported in the primary private
    > instance region, requiring cross-region routing, and was unnecessarily
    > costly for this specific feature.

- **qual**: add prompt guardrails and improve text response formatting, closes ([#6860](https://github.com/kobotoolbox/kpi/pull/6860))
    > <!-- 📣 Summary -->
    > Adds prompt guardrails for all question types; improves prompt
    > formatting for text questions.
    > 
    > <!-- 📖 Description -->
    > - Wrap interview responses and analysis questions in XML tags to sandbox
    > untrusted input
    > - Add post-data reminders scoping each tagged section's role
    > - Add "plain text only" and "no sections" rule to text prompt as default

- **qual**: default to false if verification missing ([#6943](https://github.com/kobotoolbox/kpi/pull/6943))
    > <!-- 📣 Summary -->
    > Fix an error loading the data table with older submissions
    > 
    > <!-- 📖 Description -->
    > Loading a data table for a survey with older submissions that had QA
    > data from before verification was released caused a 500 and displayed a
    > long error message.

- **select**: clear button styles ([#7014](https://github.com/kobotoolbox/kpi/pull/7014))
    > <!-- 📣 Summary -->
    > 
    > Fixes Select UI when clearable option is enabled.

- **settings**: apply AWS settings without explicit credentials ([#7017](https://github.com/kobotoolbox/kpi/pull/7017))
- **sidebar**: use counts and minimal-list APIs ([#6918](https://github.com/kobotoolbox/kpi/pull/6918))
    > <!-- 📣 Summary -->
    > 
    > Use new API for Sidebar lists of projects (Deployed, Draft, and
    > Archived). This fixes a problem when user with more than 200 projects
    > was unable to see all of their projects in the Sidebar (previously it
    > was limited to 200 latest projects, prioritizing Deployed ones). Now
    > three groups use infinite scroll loading. We also fixed a problem with
    > sidebar serving always "My Projects" projects - now when user switches
    > to organization projects or a custom view, the sidebar reflects this
    > properly.

- **submissions**: return 400 error message from OpenRosa for an invalid deprecatedID ([#6942](https://github.com/kobotoolbox/kpi/pull/6942))
    > ### 🗒️ Checklist
    > 
    > 1. [X] run linter locally
    > 2. [X] update developer docs (API, README, inline, etc.), if any
    > 3. [X] for user-facing doc changes create a Zulip thread at `#Support
    > Docs Updates`, if any
    > 4. [X] draft PR with a title `<type>(<scope>)<!>: <title> `
    > 5. [X] assign yourself, tag PR: at least `Front end` and/or `Back end`
    > or `workflow`
    > 6. [X] fill in the template below and delete template comments
    > 7. [X] review thyself: read the diff and repro the preview as written
    > 8. [X] open PR & confirm that CI passes & request reviewers, if needed
    > 9. [ ] delete this section before merging
    > 
    > <!-- 📣 Summary -->
    > Updated the submission process to return a clear error message when an
    > edit is attempted with an invalid ID, preventing a system crash when a
    > record cannot be found.

- **subsequences**: track LLM usage counters even when Stripe is disabled ([#6920](https://github.com/kobotoolbox/kpi/pull/6920))
    > <!-- 📣 Summary -->
    > Ensure AI qualitative analysis requests are tracked in usage counters
    > even when Stripe billing is disabled.
    > 
    > <!-- 📖 Description -->
    > Previously, requests to the AI qualitative analysis service were only
    > recorded in NLP usage counters when Stripe was enabled. This prevented
    > usage metrics from being tracked in environments where Stripe billing is
    > disabled.
    > 
    > This PR removes the Stripe dependency from the LLM request tracking
    > logic so that NLP usage counters are always recorded. Stripe remains
    > responsible only for billing and limit enforcement, while usage tracking
    > now works consistently across all deployments.

- **subsequences**: bypass usage limits for LLM answer verification ([#6938](https://github.com/kobotoolbox/kpi/pull/6938))
    > <!-- 📣 Summary -->
    > This PR ensures that users can verify or delete existing automated
    > qualitative analysis responses without triggering LLM usage limit
    > checks, as these actions do not invoke external APIs or consume tokens.

- fix missing map item ([938985f](https://github.com/kobotoolbox/kpi/commit/938985f745f54a0105a1c7e47c8d1ab3236063f6))
</details>

<details><summary>Continous Integration (8)</summary>

- **enketo**: update non-prod deploy pipeline with required enketo version input INFRA-439 ([#6949](https://github.com/kobotoolbox/kpi/pull/6949))
    > <!-- 📣 Summary -->
    > Updates nonprod release pipeline to input enketo version in the helm
    > deploy step.
    > <!-- 📖 Description -->
    > This modifies the nonprod release pipeline to set enketo version as it
    > is now a required input from the helm chart. Adds the org-wide variable
    > - `ENKETO_VERSION` to manage running enketo version for non-prod
    > environments.

- **ephemeral_envs**: add ability to deploy an ephemeral environment off of a branch INFRA-461 ([#6950](https://github.com/kobotoolbox/kpi/pull/6950))
- **locale**: automate pushing to transifex ([#6827](https://github.com/kobotoolbox/kpi/pull/6827))
- **main**: check for openapi as well ([#6944](https://github.com/kobotoolbox/kpi/pull/6944))
- **npm**: Turn off dependabot automerge, don't open new PR's ([#7048](https://github.com/kobotoolbox/kpi/pull/7048))
- **packages**: Schedule weekly deletion of kpi images older than 90 days INFRA-431 ([#7016](https://github.com/kobotoolbox/kpi/pull/7016))
- **packages**: Clean up old GCHR packages INFRA-431 ([#7047](https://github.com/kobotoolbox/kpi/pull/7047))
- ci (kfmain): remove duplicate kfmain notifications ([#6882](https://github.com/kobotoolbox/kpi/pull/6882))

📖 Description
The success notification was firing for kfmain even though the actual
deployment happens in the devops repo pipeline, which has its own
notifications. Now notify-success only runs for feature branches and
public-beta.
📣 Summary
Remove redundant success notification for main deploys since the actual
deployment and notifications are handled in the devops pipeline.
</details>

<details><summary>Build & Dependencies (26)</summary>

- **deps**: bump the minor-and-patch group across 1 directory with 2 updates ([#6883](https://github.com/kobotoolbox/kpi/pull/6883))
- **deps**: bump the actions-deps group across 1 directory with 7 updates ([#6889](https://github.com/kobotoolbox/kpi/pull/6889))
- **deps**: bump aws-actions/configure-aws-credentials from 6.0.0 to 6.1.0 in the actions-deps group ([#6934](https://github.com/kobotoolbox/kpi/pull/6934))
- **deps**: bump the actions-deps group across 1 directory with 2 updates ([#6967](https://github.com/kobotoolbox/kpi/pull/6967))
- **deps**: bump @tanstack/react-query from 5.85.5 to 5.100.9 ([#6988](https://github.com/kobotoolbox/kpi/pull/6988))
- **deps**: bump @fontsource/roboto from 4.5.8 to 5.2.10 ([#6768](https://github.com/kobotoolbox/kpi/pull/6768))
- **deps**: bump fuse.js from 6.6.2 to 7.3.0 ([#6996](https://github.com/kobotoolbox/kpi/pull/6996))
- **deps**: bump pretty-bytes from 7.0.0 to 7.1.0 ([#7003](https://github.com/kobotoolbox/kpi/pull/7003))
- **deps**: bump react-copy-to-clipboard from 5.1.0 to 5.1.1 ([#7013](https://github.com/kobotoolbox/kpi/pull/7013))
- **deps**: bump mobx from 6.15.0 to 6.15.2 ([#7023](https://github.com/kobotoolbox/kpi/pull/7023))
- **deps**: bump the actions-deps group with 2 updates ([#7038](https://github.com/kobotoolbox/kpi/pull/7038))
- **deps-dev**: bump brace-expansion from 1.1.12 to 1.1.13 ([#6884](https://github.com/kobotoolbox/kpi/pull/6884))
- **deps-dev**: bump @eslint/eslintrc from 3.3.1 to 3.3.5 ([#6989](https://github.com/kobotoolbox/kpi/pull/6989))
- **deps-dev**: bump playwright from 1.56.1 to 1.59.1 ([#6992](https://github.com/kobotoolbox/kpi/pull/6992))
- **deps-dev**: bump postcss from 8.4.49 to 8.5.13 ([#6994](https://github.com/kobotoolbox/kpi/pull/6994))
- **deps-dev**: bump style-loader from 3.3.4 to 4.0.0 ([#6991](https://github.com/kobotoolbox/kpi/pull/6991))
- **deps-dev**: bump wait-on from 9.0.4 to 9.0.5 ([#7002](https://github.com/kobotoolbox/kpi/pull/7002))
- **deps-dev**: bump ts-loader from 9.5.1 to 9.5.7 ([#7005](https://github.com/kobotoolbox/kpi/pull/7005))
- **deps-dev**: bump @jest/create-cache-key-function from 30.0.5 to 30.3.0 ([#7010](https://github.com/kobotoolbox/kpi/pull/7010))
- **deps-dev**: bump cheerio from 1.1.2 to 1.2.0 ([#7008](https://github.com/kobotoolbox/kpi/pull/7008))
- **deps-dev**: bump jest and @types/jest ([#7007](https://github.com/kobotoolbox/kpi/pull/7007))
- **deps-dev**: bump eslint-import-resolver-webpack from 0.13.10 to 0.13.11 ([#7021](https://github.com/kobotoolbox/kpi/pull/7021))
- **deps-dev**: bump @testing-library/react from 16.3.0 to 16.3.2 ([#7022](https://github.com/kobotoolbox/kpi/pull/7022))
- **frontend**: delete unused webpack-dev-middleware (again) ([#6998](https://github.com/kobotoolbox/kpi/pull/6998))
- **jquery**: bump to v4 ([#7015](https://github.com/kobotoolbox/kpi/pull/7015))
- **mantine**: upgrade to v8 ([#6986](https://github.com/kobotoolbox/kpi/pull/6986))
    > <!-- 📣 Summary -->
    > 
    > Upgrades Mantine UI library from v7 to v8 and Sentry from v7 to v10
    > (required for Mantine v8). Both are dependency-only upgrades with no
    > user-visible changes. Required as a stepping stone toward Mantine v9.

</details>

<details><summary>Refactor (9)</summary>

- **bigModal**: drop allAssets usage ([#6872](https://github.com/kobotoolbox/kpi/pull/6872))
- **connectProjects**: functional component ([#6931](https://github.com/kobotoolbox/kpi/pull/6931))
    > <!-- 📣 Summary -->
    > 
    > Internal code improvements

- **dataTable**: stop relying on allAssets ([#6897](https://github.com/kobotoolbox/kpi/pull/6897))
    > <!-- 📣 Summary -->
    > 
    > Data Table already had access to asset data, no need to request it again
    > through (deprecated) `allAssets`.

- **dataTable**: move around and group cell related files ([#7052](https://github.com/kobotoolbox/kpi/pull/7052))
- **dropzone**: update react-dropzone and migrate out of mixin ([#6987](https://github.com/kobotoolbox/kpi/pull/6987))
    > <!-- 📣 Summary -->
    > 
    > Upgrade react-dropzone to v15, migrate all Dropzone usages to the
    > current API, remove legacy droppable mixin usage.

- **formBuilder**: merge surveyCompanionStore into surveyScope ([#6888](https://github.com/kobotoolbox/kpi/pull/6888))
- **frontend**: use start in API calls ([#6908](https://github.com/kobotoolbox/kpi/pull/6908))
    > <!-- 📣 Summary -->
    > 
    > Internal code improvement.

- **frontend**: migrate pageState out of Reflux ([#6981](https://github.com/kobotoolbox/kpi/pull/6981))
- **notification**: adjust story and add wrapper file ([#7037](https://github.com/kobotoolbox/kpi/pull/7037))
</details>

<details><summary>Chores (4)</summary>

- **allAssets**: delete unused code ([#6940](https://github.com/kobotoolbox/kpi/pull/6940))
- **encryptForm**: delete unused code ([#6885](https://github.com/kobotoolbox/kpi/pull/6885))
- **frontend**: upgrade react-router to v7 ([#6979](https://github.com/kobotoolbox/kpi/pull/6979))
- **github**: bump python version in locale workflow ([#6969](https://github.com/kobotoolbox/kpi/pull/6969))
</details>

<details><summary>Other (1)</summary>

- **frontend**: update background audio warning link ([#7054](https://github.com/kobotoolbox/kpi/pull/7054))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.13a..2.026.21
<!-- generated by git-cliff -->
