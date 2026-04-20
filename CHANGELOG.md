<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (35)</summary>

- **assetNavigator**: migrate to TypeScript and remove searches ([#6653](https://github.com/kobotoolbox/kpi/pull/6653))
- **auditLog**: add audit actions and types to support admin interface logging ([#6810](https://github.com/kobotoolbox/kpi/pull/6810))
    > <!-- 📣 Summary -->
    > Extend the `AuditType` and `AuditAction` models to lay the groundwork
    > for logging configuration and management actions performed by superusers
    > in the Django admin panel.
    > 
    > <!-- 📖 Description -->
    > Changes made by users with the highest level of access to the admin
    > panel are currently not logged, making it difficult to track major
    > application configuration and user management updates. This PR
    > introduces the foundational constants required to support logging these
    > superadmin actions.
    > 
    > This PR adds `ADMIN_CREATE`, `ADMIN_UPDATE`, `ADMIN_DELETE`, and
    > `UPDATE_CONSTANCE` to the `AuditAction` text choices and adds
    > `ADMIN_INTERFACE` to the `AuditType` text choices.

- **auditLog**: migrate `AuditLog`'s `object_id` to `CharField` ([#6821](https://github.com/kobotoolbox/kpi/pull/6821))
    > <!-- 📣 Summary -->
    > This PR converts `AuditLog.object_id` from `BigInteger` to
    > `CharField(255)` to support string-based UIDs.
    > 
    > <!-- 📖 Description -->
    > - Updated `AuditLog.object_id` to `CharField` in `models.py`
    > - Implemented a custom migration that alters the column type directly.
    > - Added logic to handle the `SKIP_HEAVY_MIGRATIONS` flag: 
    > - If `True`, the migration prints the SQL required for a background
    > index build.
    >  - If `False`, the migration builds the index normally.
    > - Verified on production that no existing indexes on `object_id` require
    > dropping.

- **automatedQA**: add `Generate with AI` button ([#6715](https://github.com/kobotoolbox/kpi/pull/6715))
    > <!-- 📣 Summary -->
    > This PR adds the "Generate with AI" button under the analysis questions.

- **automatedQA**: integrate AI answer generation api ([#6735](https://github.com/kobotoolbox/kpi/pull/6735))
    > <!-- 📣 Summary -->
    > This PR implements the flow for activating the AI response generation
    > feature and calling the actual generation endpoint

- **automaticQA**: parse and display AI generated results ([#6753](https://github.com/kobotoolbox/kpi/pull/6753))
- **autoqa**: add llm requests to project usage breakdown table ([#6714](https://github.com/kobotoolbox/kpi/pull/6714))
    > <!-- 📣 Summary -->
    > Adds llm ("Automatic analysis") requests to the project usage breakdown
    > table and removes total submissions column.

- **autoqa**: adjust frontend limit handling for autoqa ([#6731](https://github.com/kobotoolbox/kpi/pull/6731))
    > <!-- 📣 Summary -->
    > Adjusts frontend logic to ensure automatic analysis request limits are
    > calculated properly.

- **autoqa**: confirm modal for editing qa questions ([#6806](https://github.com/kobotoolbox/kpi/pull/6806))
    > <!-- 📣 Summary -->
    > Adds a modal warning users that editing a QA question will impact all
    > answers across submissions.

- **button**: define outline variant as tertiary ([#6809](https://github.com/kobotoolbox/kpi/pull/6809))
- **constance**: support explicit `CONSTANCE_*` env var overrides for NLP settings ([#6933](https://github.com/kobotoolbox/kpi/pull/6933))
    > <!-- 📖 Description -->
    > This PR allows the Google NLP (ASR/MT) settings to be configured
    > directly via environment variables, eliminating the need for manual
    > setup in the Django admin panel during deployments.
    > 
    > The following four settings have been explicitly updated in `base.py` to
    > support this pattern:
    > * `CONSTANCE_ASR_MT_GOOGLE_PROJECT_ID`
    > * `CONSTANCE_ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX`
    > * `CONSTANCE_ASR_MT_GOOGLE_TRANSLATION_LOCATION`
    > * `CONSTANCE_ASR_MT_GOOGLE_CREDENTIALS`

- **formHistory**: create and use infinite scroll component ([#6784](https://github.com/kobotoolbox/kpi/pull/6784))
    > <!-- 📣 Summary -->
    > 
    > Change Project → Form → Form History component to operate on new
    > endpoint and use infinte scroll. We also include undeployed version in
    > the list, so users now can clone them too.

- **massEmail**: add filter for users accessing deprecated v1 endpoints ([#6914](https://github.com/kobotoolbox/kpi/pull/6914))
    > <!-- 📣 Summary -->
    > This PR adds a new mass email filter to identify users who are still
    > accessing deprecated v1 API endpoints.
    > 
    > <!-- 📖 Description -->
    > As part of the v1 deprecation effort, we introduced `V1UserTracker` and
    > `V1AccessLoggingMiddleware` to record users who access deprecated
    > endpoints. This PR exposes that data through the existing mass email
    > system so that admins can notify these users to migrate to v2 endpoints.

- **metadata**: add `ExtraProjectMetadataField` model ([#6789](https://github.com/kobotoolbox/kpi/pull/6789))
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
    > Add the `ExtraProjectMetadataField` model to support customizable
    > project metadata on private servers.

- **mfa**: enable MFA unconditionally for all users ([#6939](https://github.com/kobotoolbox/kpi/pull/6939))
    > <!-- 📣 Summary -->
    > This PR removes the `MfaAvailableToUser` whitelist model and all
    > subscription-based restrictions tied to Multi-Factor Authentication. MFA
    > is now universally available to all KoboToolbox users, governed only by
    > the global `MFA_ENABLED` configuration.
    > 
    > <!-- 📖 Description -->
    > Historically, MFA was gated behind paid subscriptions or a specific
    > per-user whitelist (`MfaAvailableToUser`). As part of our push to make
    > security features available to everyone, this PR completely removes
    > those restrictions.
    > 
    > This PR:
    > - Deletes the `MfaAvailableToUser` model and its corresponding Django
    > Admin interface.
    > - Removes the subscription-check logic from
    > `MfaAdapter.is_mfa_enabled()`.
    > - Simplifies `permissions.py` to allow MFA access based solely on the
    > global `config.MFA_ENABLED` setting.
    > - Cleans up `environment.py` and related API endpoints that previously
    > exposed the whitelist status to the frontend.
    > - Refactors unit tests in `test_login.py`, `test_mfa_login.py`, and
    > `test_api_environment.py` to remove whitelist/subscription matrices and
    > verify universal access.

- **pagination**: make pagination class consistent and use the same parameters ([#6542](https://github.com/kobotoolbox/kpi/pull/6542))
    > <!-- 📣 Summary -->
    > This PR introduces the DefaultPagination class, which serves as the base
    > pagination class for all paginators in the KPI and KoBo apps. Other
    > pagination classes now inherit from it.
    > `start` becomes the primary pagination parameter, while `offset` remains
    > supported as an alias for backward compatibility.
    > 
    > It also adds support for the `page` and `page_size` query parameters,
    > which are internally converted into limit and offset values.

- **qual**: enable LLMs to answer QA questions ([#6707](https://github.com/kobotoolbox/kpi/pull/6707))
    > <!-- 📣 Summary -->
    > This PR allows users to use an LLM to answer QA questions via the API.
    > 
    > <!-- 📖 Description -->
    > Users can use the API to request LLM responses to QA questions, using
    > OpenAI as the primary LLM and defaulting to Claude if the request to
    > OpenAI fails. LLM requests can be limited by subscription tier.

- **qual**: add new addon category for automatic qa ([#6701](https://github.com/kobotoolbox/kpi/pull/6701))
    > <!-- 📣 Summary -->
    > Adds a new row to the list of addons on the addon page to display addons
    > for automatic QA.

- **qual**: allow un/verification of QA responses ([#6690](https://github.com/kobotoolbox/kpi/pull/6690))
    > <!-- 📣 Summary -->
    > Allow users to verify or unverify QA responses, whether manual or
    > automatic.
    > 
    > <!-- 📖 Description -->
    > All responses, manual or automatic, are considered unverified until they
    > are explicitly verified. This status can be updated via the API, and the
    > date of verification will be recorded, or removed if it was un-verified.

- **qual**: add OpenAPI schemas for automatic qual ([#6717](https://github.com/kobotoolbox/kpi/pull/6717))
    > <!-- 📣 Summary -->
    > Include automatic QA in endpoint documentation.

- **qual**: add verification to schemas ([#6724](https://github.com/kobotoolbox/kpi/pull/6724))
    > <!-- 📣 Summary -->
    > Update API documentation for advanced features to include verification
    > for QA answers.

- **qual**: clear answer button ([#6774](https://github.com/kobotoolbox/kpi/pull/6774))
    > <!-- 📣 Summary -->
    > Adds frontend handling for AI-generated responses, as well as "clear" button for removing those responses. Ensures we can delete automatic responses even if there were no previous manual ones.

- **qual**: add verification and source to data views ([#6800](https://github.com/kobotoolbox/kpi/pull/6800))
    > <!-- 📣 Summary -->
    > Add 'verification' and 'source' columns for QA questions in data views.
    > 
    > <!-- 📖 Description -->
    > For every QA question, add columns indicating whether the response (if
    > present) is verified or not and whether it was generated manually or
    > automatically. These columns will appear in exports but not the table
    > view.

- **qual**: add question and choice hints ([#6813](https://github.com/kobotoolbox/kpi/pull/6813))
    > <!-- 📣 Summary -->
    > Allow users to add hints to QA questions and choices.
    > 
    > <!-- 📖 Description -->
    > Question/choice hints will be sent to the LLM to assist with processing.

- **qual**: add per-user throttling for Automatic QA requests ([#6824](https://github.com/kobotoolbox/kpi/pull/6824))
    > <!-- 📣 Summary -->
    > Adds a configurable per-user rate limit for automatic QA requests to
    > prevent users or scripts from triggering large bursts of Bedrock
    > requests through the supplement API.
    > 
    > <!-- 📖 Description -->
    > Automatic QA requests trigger calls to external LLM providers (AWS
    > Bedrock). Currently there is no protection against a user sending a
    > large number of requests in a short time period.
    > 
    > Although the UI does not provide bulk operations, users could easily
    > send repeated requests via scripts (e.g. curl or API clients).
    > 
    > This PR introduces per-user rate limiting for Automatic QA requests. The
    > throttle:
    > - applies only to Automatic Bedrock QA requests (e.g.,
    > `AUTOMATIC_BEDROCK_QUAL`)
    > - is enforced on the submission supplement PATCH endpoint
    > - is per authenticated user
    > - limits requests to N requests per second (Configurable via Constance
    > `AUTOMATIC_QA_REQUESTS_PER_SECOND`, default: 5)
    > 
    > If a user exceeds the configured limit, the API returns: `HTTP 429 Too
    > Many Requests`

- **scim**: get/list api endpoints for the scim integration ([#6741](https://github.com/kobotoolbox/kpi/pull/6741))
    > <!-- 📣 Summary -->
    > As part of the SSO deprovisioning project, this PR implements basic SCIM
    > v2 User `GET` (list and retrieve) endpoints, allowing external IdPs to
    > query user accounts via the SCIM protocol.
    > 
    > Features included in this PR:
    > * SCIM API endpoints exposed at `/api/scim/v2/{idp_slug}/Users/` and
    > `/api/scim/v2/{idp_slug}/Users/{user_id}`
    > * Authentication via a `Bearer` token validated against the respective
    > `IdentityProvider.scim_api_key`.
    > * Pagination following the standard specifications 
    > * Supported filtering usernames and emails (e.g. `?filter=userName eq
    > "test@test.com"`) to locate linked accounts for deprovisioning queries.

- **scim**: deprovisioning endpoints ([#6756](https://github.com/kobotoolbox/kpi/pull/6756))
    > <!-- 📣 Summary -->
    > This PR implements the SCIM 2.0 User deprovisioning specification for
    > the SSO project. It enables IdPs like Okta to automatically and safely
    > disable Kobo accounts when a user is suspended or removed in the IdP,
    > acting as a single source of control.
    > * Added a social_app ForeignKey to the IdentityProvider model that
    > establishes a direct relationship between a SCIM IdP and the
    > corresponding SSO login app.
    > * Added support standard SCIM DELETE /Users/{id} requests. 
    > * Added UpdateModelMixin and custom partial_update logic to support SCIM
    > PATCH /Users/{id} workloads.

- **scim**: add groups and service provider config endpoints ([#6797](https://github.com/kobotoolbox/kpi/pull/6797))
    > <!-- 📣 Summary -->
    > This PR complements the SCIM implementation in kobo with Groups and
    > ServiceProviderConfig endpoints, which are required for providers like
    > Okta and Authentik.
    > 
    > * Added a ScimGroup model to store synced groups natively. 
    > * Created the /ServiceProviderConfig endpoint mapping to statically
    > announce our SCIM capabilities (e.g. PATCH is supported, bulk operations
    > are disabled).
    > * Created the /Groups CRUD endpoints to support list, create, update,
    > and patch requests from the IdP.
    > * Updated urls.py and serializers to correctly route and validate the
    > new payloads.
    > * Added unit tests in test_scim_groups_api.py
    > * Added simple provisioning to enable proper integration with test cases
    > * Handling of multi tenant IdP

- **searches**: remove unused code ([#6706](https://github.com/kobotoolbox/kpi/pull/6706))
- **sidebarForms**: migrate to TypeScript and remove searches ([#6703](https://github.com/kobotoolbox/kpi/pull/6703))
- **sso**: IdP model and admin screen ([#6738](https://github.com/kobotoolbox/kpi/pull/6738))
    > <!-- 📣 Summary -->
    > This PR adds the Identity Provider model and admin screen to manage the
    > SCIM providers.

- **sso**: create additional metadata endpoints required by some keycloak scim extension ([#6846](https://github.com/kobotoolbox/kpi/pull/6846))
    > <!-- 📣 Summary -->
    > Implemented SCIM 2.0 discovery metadata endpoints (/Schemas and
    > /ResourceTypes) to ensure full compliance and unblock integrations with
    > strict Enterprise Identity Providers (like Keycloak's outbound
    > provisioning).
    > 
    > <!-- 📖 Description -->
    > Certain strict SCIM clients (like the scim-for-keycloak.de extension or
    > strict configurations of Azure AD) rigidly enforce RFC-7643 discovery
    > specifications. Before they attempt to provision any users or groups,
    > they automatically query the target server for its schemas and resource
    > types to understand exactly what attributes are supported. Previously,
    > our minimal SCIM implementation only exposed /Users, /Groups, and
    > /ServiceProviderConfig. The data from these metadata endpoints is static
    > and adapted to the current subset of data handled by the kobo scim app.

- **subsequences**: add unit tests for subsequence polling tasks and failure handlers ([#6776](https://github.com/kobotoolbox/kpi/pull/6776))
    > <!-- 📣 Summary -->
    > Added unit tests for `poll_run_external_process` and its Celery signal
    > failure handler `poll_run_external_process_failure` to ensure external
    > NLP timeouts and crashes are accurately recorded in the database.
    > 
    > <!-- 📖 Description -->
    > Currently, we lacked testing around the Celery polling mechanism for
    > external subsequences processes. This PR introduces a test suite
    > (`TestPollRunExternalProcess` and `TestPollRunExternalProcessFailure`)
    > covering both standard task execution and the `@task_failure.connect`
    > signal handler.
    > 
    > Test Coverage Includes:
    > - Polling task correctly raises `SubsequenceTimeoutError` for
    > `in_progress` API responses to trigger Celery retries.
    > - Polling task correctly intercepts graceful API failures without
    > crashing the worker.
    > - Failure handler catches unhandled exceptions and logs a `failed`
    > status to `SubmissionSupplement`.
    > - Failure handler intercepts max-retry exhaustion and rewrites the
    > internal timeout error to a user-friendly "Maximum retries exceeded."
    > message.

- **subsequences**: batch-migrate legacy NLP supplements on deploy, guard exports ([#6937](https://github.com/kobotoolbox/kpi/pull/6937))
    > <!-- 📣 Summary -->
    > 
    > Exports on assets with NLP data were silently failing with an
    > `InvalidAction` error because `SubmissionSupplement` records were stored
    > in a legacy schema (no `_version` key). This PR adds a management
    > command and a LRM job to batch-migrate those records on deploy, and
    > shows a clear error during the transition window.
    > 
    > ### 👷 Description for instance maintainers
    > 
    > Three complementary changes ship together:
    > 
    > **1. Management command `migrate_submission_supplements`:** Iterates
    > over all `SubmissionSupplement` records still in the legacy format and
    > converts them to the current schema (`_version: '20250820'`). Can also
    > be run manually from the shell.
    > 
    > **2. Long-running migration (job `0023`):** Runs the management command
    > automatically on deploy via the existing Beat-scheduled LRM framework —
    > no manual intervention required.
    > 
    > **3. Export guard:** While the LRM is running, any async export for an
    > asset that still has unmigrated supplements fails with a clear message
    > (`Supplement data migration in progress, please retry later`) instead of
    > the previous cryptic `{"error": "", "error_type": "InvalidAction"}`.

- feat(autoQA) limit modal for analysis requests ([#6761](https://github.com/kobotoolbox/kpi/pull/6761))

<!-- 📣 Summary -->
Adds a warning modal for users over their LLm request limit when they
attempt to auto generate a QA answer.
</details>

<details><summary>Bug Fixes (35)</summary>

- **analysis**: hide questions buttons when disabled ([#6716](https://github.com/kobotoolbox/kpi/pull/6716))
    > <!-- 📣 Summary -->
    > This PR fixes an issue where the 'Clear' button is clickable and `Edit`
    > and `Delete` buttons are visible when qualitative analysis question is
    > disabled.

- **analysis**: fix crash when adding first analysis question ([#6775](https://github.com/kobotoolbox/kpi/pull/6775))
    > <!-- 📣 Summary -->
    > 
    > Fixes a bug where the user experiences a crash after adding the first
    > qualitative analysis question to a form with an audio submission.

- **api**: fixes for asset metadata ([#6864](https://github.com/kobotoolbox/kpi/pull/6864))
    > <!-- 📣 Summary -->
    > Fix incorrect counts in asset list metadata.
    > 
    > <!-- 📖 Description -->
    > Fixes two bugs:
    > 1. The /metadata endpoint was including all public assets, even those
    > not owned by the requesting user
    > 2. The `metadata` field in the asset list (included when `?metadata=on`
    > is provided) was always returning an empty country list

- **autoqa**: improve auto-save handling on text responses ([#6816](https://github.com/kobotoolbox/kpi/pull/6816))
    > <!-- 📣 Summary -->
    > Fixes an issue where user inputted text responses could be overwritten
    > by earlier values, either from within the browser or previous requests
    > to the backend.

- **billing**: remove handling for grandfathered free tier ([#6702](https://github.com/kobotoolbox/kpi/pull/6702))
    > <!-- 📣 Summary -->
    > Remove code for setting/handling "free tier" subscriptions.

- **datatable**: update multiple editing submissions description ([#6750](https://github.com/kobotoolbox/kpi/pull/6750))
    > <!-- 📣 Summary -->
    > Updated heading, description and help article link of "Displaying
    > multiple submission" modal in the Data table.

- **formBuilder**: use fresh asset data after creating template ([#6733](https://github.com/kobotoolbox/kpi/pull/6733))
- **formBuilder**: ensure cloned choices and rows ids are unique ([#6740](https://github.com/kobotoolbox/kpi/pull/6740))
    > <!-- 📣 Summary -->
    > 
    > When cloning a question in Form Builder the result is now ensured to be
    > a copy with unique ids. Previously clone was using original row ids
    > leading to unexpected behaviour.

- **formLanding**: remove Manage translations button from menu ([#6831](https://github.com/kobotoolbox/kpi/pull/6831))
    > <!-- 📣 Summary -->
    > Removed "Manage translations" item from the "•••" dropdown menu for the
    > "Current version" section under the Form tab in a project

- **formbuilder**: update audit support url ([#6748](https://github.com/kobotoolbox/kpi/pull/6748))
    > <!-- 📣 Summary -->
    > Updated support article link for the "Audit settings" section in the
    > Formbuilder.

- **formmedia**: update media support article url ([#6763](https://github.com/kobotoolbox/kpi/pull/6763))
    > <!-- 📣 Summary -->
    > Updated media support article link for "Attach files" "i" icon on Media
    > page

- **frontend**: check "flatten geojson" by default ([#6833](https://github.com/kobotoolbox/kpi/pull/6833))
    > <!-- 📣 Summary -->
    > User selects "GeoJSON" as export type and under "Advanced options" the
    > "Flatten GeoJSON" checkbox will be selected by default.
    > 
    > <img width="1227" height="493" alt="CleanShot 2026-03-17 at 15 44 46"
    > src="https://github.com/user-attachments/assets/3c05f91d-4f67-480f-aeb2-d131576f9479"
    > />

- **map**: display correct results when filtering map ([#6679](https://github.com/kobotoolbox/kpi/pull/6679))
    > <!-- 📣 Summary -->
    > Fixes the map display to show only submissions from the selected
    > question

- **mfa**: fix more mfa unit tests ([#6787](https://github.com/kobotoolbox/kpi/pull/6787))
- **mfa**: enable safe MFA deactivation via Admin UI during all-auth transition ([#6925](https://github.com/kobotoolbox/kpi/pull/6925))
    > <!-- 📣 Summary -->
    > This PR replaces the legacy Trench admin UI with the new all-auth
    > `MfaMethodsWrapper` admin and ensures that deleting a user's wrapper
    > correctly cascades to delete all underlying `Authenticator` and legacy
    > Trench `MfaMethod` records, preventing user lockouts.
    > 
    > <!-- 📖 Description -->
    > During the transition from Trench to Django all-auth, deleting a user's
    > MFA method via the legacy Trench Admin UI were inadvertently leaving
    > behind orphaned all-auth `Authenticator` and `MfaMethodsWrapper`
    > records. This caused a desynchronization where
    > `UserProfile.is_mfa_active` would be False, but the orphaned all-auth
    > wrapper would still force the user into an MFA challenge, effectively
    > locking them out.
    > 
    > This PR:
    > - Replaces the legacy Trench admin interface with the all-auth based
    > `MfaMethodsWrapper` admin and ensures that deleting a wrapper properly
    > cascades to remove all associated records.
    > - The .delete() method on `MfaMethodsWrapper` has been overridden to
    > delete related `Authenticator` entries as well as the legacy Trench
    > `MfaMethod`.
    > - Additionally, `delete_queryset` has been overridden in the admin to
    > ensure bulk deletion actions trigger the same custom logic instead of
    > bypassing it via raw SQL.

- **modal**: being displayed off center at 480px height viewport ([#6742](https://github.com/kobotoolbox/kpi/pull/6742))
    > <!-- 📣 Summary -->
    > 
    > When viewport had exactly 480px height, modals were being displayed off
    > center, partially outside the screen.

- **processing**: content loading fails when audio question is in group ([#6726](https://github.com/kobotoolbox/kpi/pull/6726))
    > <!-- 📣 Summary -->
    > Fix for an issue which will not load content on processing view when
    > audio question is in a group

- **processing**: immutable rollback for accepted optimistic update ([#6825](https://github.com/kobotoolbox/kpi/pull/6825))
    > <!-- 📣 Summary -->
    > 
    > Revert user interface correctly in case accepting automatically
    > generated transcription or translation request failed.

- **qual**: link automatic question uuids to manual params ([#6743](https://github.com/kobotoolbox/kpi/pull/6743))
    > <!-- 📣 Summary -->
    > Update the advanced features API to only take uuids instead of full
    > question specifications as parameters when updating an automatic QA
    > action.
    > 
    > <!-- 📖 Description -->
    > Change the `params` field for automatic QA actions to have parameters in
    > the form `{'uuid': 'question_uuid'}` instead of `{'uuid':
    > 'question_uuid', 'type': 'qualInteger', 'labels':...}`
    > 
    > ### 👷 Description for instance maintainers
    > Contains a migration for updating current QuestionAdvancedFeature
    > objects. This feature has barely been released (API only) so it should
    > only update very few objects, likely on test servers only.

- **qual**: prevent 500 errors in automatic qualitative analysis by handling Bedrock service exceptions ([#6783](https://github.com/kobotoolbox/kpi/pull/6783))
    > <!-- 📣 Summary -->
    > This PR resolves an inconsistent 500 error (ResourceNotFoundException)
    > that occurred when the primary LLM provided an unparseable response and
    > the fallback model encountered AWS service-level restrictions.
    > 
    > <!-- 📖 Description -->
    > The inconsistent 500 error was identified as a cascading failure
    > starting with a "soft failure" of the primary model, OSS120. In certain
    > scenarios, such as single-choice qualitative questions, the primary
    > model returns an answer that fails validation. For instance, returning
    > "FALSE,FALSE" when at least one selection is required, which triggers an
    > `InvalidResponseFromLLMException`.
    > 
    > While the system correctly attempts to fall back to the backup model,
    > Claude 3.5 Sonnet, an infrastructure-level "hard failure" occurs because
    > the configured backup uses a model ID marked as Legacy by AWS. Because
    > this model had not been actively used in the last 15 days, Amazon
    > Bedrock denied the request with a `ResourceNotFoundException`.
    > Previously, the `run_external_process` method was only configured to
    > catch the `InvalidResponseFromLLMException`, allowing the AWS
    > ClientError to bubble up and crash the request with a 500 server error.

- **qual**: upgrade backup LLM model to Claude 4.5 Sonnet ([#6786](https://github.com/kobotoolbox/kpi/pull/6786))
    > <!-- 📣 Summary -->
    > This PR upgrades the secondary LLM used for automatic qualitative
    > analysis from the deprecated Claude 3.5 Sonnet to the latest Claude 4.5
    > Sonnet. This change utilizes the AWS Cross-Region Inference profile to
    > ensure high availability and bypasses "Legacy Model" access
    > restrictions.

- **qual**: remove unused hint placeholder ([#6788](https://github.com/kobotoolbox/kpi/pull/6788))
- **qual**: handle empty result from LLM ([#6785](https://github.com/kobotoolbox/kpi/pull/6785))
    > <!-- 📣 Summary -->
    > Handle an error resulting from a rare edge case with the LLMs.

- **qual**: improve error messaging ([#6799](https://github.com/kobotoolbox/kpi/pull/6799))
    > <!-- 📣 Summary -->
    > Replace "Cannot translate without transcription" with "No transcription
    > found" so it is more appropriate for both translation and QA.

- **qual**: fix automatic qualitative analysis throttling tests ([#6865](https://github.com/kobotoolbox/kpi/pull/6865))
    > <!-- 📣 Summary -->
    > 
    > Internal test-only change — no user-visible impact.

- **qual**: fix flaky throttling tests caused by global cache clearing in parallel CI ([#6866](https://github.com/kobotoolbox/kpi/pull/6866))
    > <!-- 📣 Summary -->
    > Fix flaky automatic QA throttling tests by removing global
    > `cache.clear()` and deleting only the user-specific throttle cache key.
    > 
    > <!-- 📖 Description -->
    > The tests were using `cache.clear()` to reset the throttle state before
    > each test. When running tests in parallel (pytest -n auto) on CI,
    > multiple workers share the same Redis cache. Clearing the entire cache
    > in one worker could remove throttle state used by another worker,
    > causing inconsistent test results.
    > 
    > The Fix: Switched to
    > `cache.delete(f'throttle_automatic_qa_{self.asset.owner.id}')`. This
    > ensures each test worker only manages the cache state relevant to its
    > own execution context without interfering with others.

- **qual**: fix flaky QA throttling tests in parallel CI using `LocMemCache` isolation ([#6881](https://github.com/kobotoolbox/kpi/pull/6881))
    > <!-- 📣 Summary -->
    > This PR resolves intermittent test failures in
    > `TestAutomaticQAThrottling` by isolating its cache to local memory. This
    > prevents a race condition where parallel workers with identical
    > test-database User IDs were colliding in the shared Redis cache.
    > 
    > <!-- 📖 Description -->
    > Fixes the intermittent `200 != 429` and `429 != 200` assertion errors in
    > `TestAutomaticQAThrottling` during parallel GitHub Action runs.
    > 
    > **The Root Cause (Database ID Collision):**
    > The issue happens when tests run in parallel with multiple workers. DRF
    > throttling stores request history in the Django cache using a key
    > derived from the authenticated user's ID (e.g.
    > `throttle_<scope>_<user.pk>`).
    > 
    > When tests run with multiple workers, each worker creates its own test
    > database but they share the same cache backend. Since users in each
    > worker often have the same primary key (e.g. pk=1), they generate the
    > same throttle cache key.
    > 
    > As a result, requests from different workers collide in the same cache
    > entry, causing the throttle state to leak across tests. This leads to
    > nondeterministic failures where tests may receive 200 instead of 429 or
    > vice versa.
    > 
    > **The Fix:**
    > Applied the `@override_settings` decorator to the
    > `TestAutomaticQAThrottling` class to force it to use
    > `django.core.cache.backends.locmem.LocMemCache`.
    > 
    > This isolates the cache entirely to the local memory of the specific
    > worker process. Each worker now has its own private "cache bucket,"
    > preventing cross-worker interference and resolving the flakiness without
    > requiring us to patch application logic or hardcode unique cache keys.

- **qual**: default to false if verification missing ([#6943](https://github.com/kobotoolbox/kpi/pull/6943))
    > <!-- 📣 Summary -->
    > Fix an error loading the data table with older submissions
    > 
    > <!-- 📖 Description -->
    > Loading a data table for a survey with older submissions that had QA
    > data from before verification was released caused a 500 and displayed a
    > long error message.

- **table**: ensure always use fresh enketo edit url ([#6734](https://github.com/kobotoolbox/kpi/pull/6734))
    > <!-- 📣 Summary -->
    > 
    > Fix a bug when editing a submission for a consecutive time and withing
    > 30 second window - was errorenously displaying old submission data.

- **test**: patch `AutomaticQARateThrottle.timer` as staticmethod for freeze_time compatibility ([#6912](https://github.com/kobotoolbox/kpi/pull/6912))
- **usage**: rename to "File storage" ([#6749](https://github.com/kobotoolbox/kpi/pull/6749))
    > <!-- 📣 Summary -->
    > Fixed storage label text from "Storage" to "File storage" under Usage
    > screen and Per project total table

- **userReport**: remove misleading `service_usage.last_updated` from `user-reports` ([#6910](https://github.com/kobotoolbox/kpi/pull/6910))
    > <!-- 📖 Description -->
    > The field was previously set at serialization time using
    > `timezone.now()`, which represented API response time rather than the
    > snapshot time when usage data was computed. This could make the nested
    > timestamp appear newer than the snapshot timestamp.
    > 
    > The root `last_updated` already represents the correct freshness of the
    > user report snapshot, so the nested field has been removed to avoid
    > confusion.

- format ([c2686e9](https://github.com/kobotoolbox/kpi/commit/c2686e96d58b27285bca04a746e1c64bcfb060cf))
- migration conflicts ([1b68658](https://github.com/kobotoolbox/kpi/commit/1b686580c3d500c936cea726d7413a76166d8f71))
- prevent IntegrityError when running `create_kobo_superuser` management command ([#6945](https://github.com/kobotoolbox/kpi/pull/6945))
    > <!-- 📣 Summary -->
    > 
    > Running `create_kobo_superuser` could crash with an `IntegrityError`
    > when trying to create the user profile.

</details>

<details><summary>Performance (2)</summary>

- **pairedData**: async regen with distributed lock and fast XML filter ([#6847](https://github.com/kobotoolbox/kpi/pull/6847))
    > <!-- 📣 Summary -->
    > 
    > Make the manifest faster to respond when a connected project's dynamic
    > data needs to be regenerated.
    > 
    > <!-- 📖 Description -->
    > 
    > When a connected project's dynamic data is outdated, the manifest now
    > returns the last available version immediately while the update runs in
    > the background. This prevents slow or failing manifest requests on
    > projects with many submissions.

- **permissions**: speed up bulk permission assignments ([#6812](https://github.com/kobotoolbox/kpi/pull/6812))
    > <!-- 📣 Summary -->
    > 
    > Assigning permissions to many users at once was extremely slow because
    > each user triggered a separate round-trip to the database for every
    > permission it received.
    > 
    > <!-- 📖 Description -->
    > 
    > When sharing a survey or collection with a large number of users through
    > the bulk permission endpoint, the server would perform one database
    > write per user per permission — including implied permissions. On
    > datasets of 100+ users this caused noticeable slowdowns and, at scale,
    > timeouts.
    > 
    > All writes are now batched into a small fixed number of queries
    > regardless of how many users are in the payload. Removals are similarly
    > batched where possible. The API contract and visible behaviour are
    > unchanged.

</details>

<details><summary>Continous Integration (5)</summary>

- **enketo**: update non-prod deploy pipeline with required enketo versi… ([#6954](https://github.com/kobotoolbox/kpi/pull/6954))
    > 📣 Summary
    > Backport enketo ci version changes
    > (https://github.com/kobotoolbox/kpi/commit/cf01957071f8bd734128e1d4d534105b476a50e2)
    > to release/2.026.07

- **envs**: add initial gha workflow to build image for pr preview environments INFRA-418 ([#6834](https://github.com/kobotoolbox/kpi/pull/6834))
- **releases**: fix a typo in variable name ([#6837](https://github.com/kobotoolbox/kpi/pull/6837))
- **storybook**: add http-server and wait-on to devDependencies ([#6757](https://github.com/kobotoolbox/kpi/pull/6757))
- **storybook**: revert failing storybook dependabot upgrade ([#6765](https://github.com/kobotoolbox/kpi/pull/6765))
    > <!-- 📣 Summary -->
    > Reverts commit c6b7d1431e34f687e392ad103f6887083e24ee3f due to failing
    > unit tests, and temporarily blocks dependabot upgrades for storybook.

</details>

<details><summary>Security (1)</summary>

- **deps-dev**: bump storybook from 9.0.0-beta.11 to 9.1.19 ([#6764](https://github.com/kobotoolbox/kpi/pull/6764))
</details>

<details><summary>Refactor (7)</summary>

- **InfiniteScrollTrigger**: make component a default export ([#6803](https://github.com/kobotoolbox/kpi/pull/6803))
- **editableForm**: change into functional component ([#6708](https://github.com/kobotoolbox/kpi/pull/6708))
- **editableForm**: stop using `allAssets` ([#6713](https://github.com/kobotoolbox/kpi/pull/6713))
- **reports**: change into functional component ([#6721](https://github.com/kobotoolbox/kpi/pull/6721))
- **reports**: stop using `allAssets` ([#6722](https://github.com/kobotoolbox/kpi/pull/6722))
- **translationSettings**: stop using `allAssets` ([#6723](https://github.com/kobotoolbox/kpi/pull/6723))
- **translationSettings**: tsify ([#6728](https://github.com/kobotoolbox/kpi/pull/6728))
</details>

<details><summary>Chores (8)</summary>

- **biome**: constraint run to jsapp folder ([#6711](https://github.com/kobotoolbox/kpi/pull/6711))
- **ci**: cut a new release on Wednesdays instead ([#6782](https://github.com/kobotoolbox/kpi/pull/6782))
- **deps**: bump qs from 6.14.1 to 6.14.2 in the minor-and-patch group across 1 directory ([#6727](https://github.com/kobotoolbox/kpi/pull/6727))
- **deps**: upgrade Python requirements ([#6773](https://github.com/kobotoolbox/kpi/pull/6773))
- **drf-spectacular**: add local url for kobo-compose for schema generation ([#6718](https://github.com/kobotoolbox/kpi/pull/6718))
- **reflux**: add @deprecated comment to stores and actions ([#6747](https://github.com/kobotoolbox/kpi/pull/6747))
- **subsequences**: organize _supplementailDetails types ([#6730](https://github.com/kobotoolbox/kpi/pull/6730))
    > <!-- 📣 Summary -->
    > This PR provides schemas for the extensions
    > DataSupplementalDetailsFieldExtension and
    > DataSupplementResponseExtension, reuses generic schemas where possible
    > and introduces a new mixin to create reusable components.

- biome ([#6709](https://github.com/kobotoolbox/kpi/pull/6709))
</details>

<details><summary>Revert (1)</summary>

- revert "wip" ([7eb918c](https://github.com/kobotoolbox/kpi/commit/7eb918c6c3d65d246503f6fcb32d08cf60b921d2))
</details>

<details><summary>Other (1)</summary>

- wip ([1f7375c](https://github.com/kobotoolbox/kpi/commit/1f7375ce14a511d926fa0e8c7e1e9135fbd7da4e))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.07h..2.026.12
<!-- generated by git-cliff -->
