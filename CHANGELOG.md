<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (14)</summary>

- **api**: add basic HTML renderer to API endpoints ([#6320](https://github.com/kobotoolbox/kpi/pull/6320))
    > <!-- 📣 Summary -->
    > Provide a lightweight HTML view for API responses with a direct link to
    > the new documentation filtered on the endpoint URL.

- **assetVersions**: remove reversion version foreign key ([#6157](https://github.com/kobotoolbox/kpi/pull/6157))
- **background-audio-recording**: modify messages about bg audio recording on form builder ([#6185](https://github.com/kobotoolbox/kpi/pull/6185))
    > ### 🗒️ Checklist
    > 
    > 1. [x] run linter locally
    > 2. [x] update developer docs (API, README, inline, etc.), if any
    > 3. [x] for user-facing doc changes create a Zulip thread at #Kobo
    > support docs, if any
    > 4. [x] draft PR with a title `<type>(<scope>)<!>: <title> `
    > 5. [x] assign yourself, tag PR: at least `Front end` and/or `Back end`
    > or `workflow`
    > 6. [x] fill in the template below and delete template comments
    > 7. [x] review thyself: read the diff and repro the preview as written
    > 8. [x] open PR & confirm that CI passes & request reviewers, if needed
    > 9. [ ] delete this section before merging
    > 
    > <!-- 📣 Summary -->
    > This PR modifies messages about the capabilities of background audio
    > recording present in the form builder.
    > [See requirements in Linear task
    > 
    > ](https://linear.app/kobotoolbox/issue//changeremove-background-audio-availability-warning)

- **components**: add tooltips to icon only buttons with storybook option ([#6123](https://github.com/kobotoolbox/kpi/pull/6123))
    > <!-- 📣 Summary -->
    > Adds ability for tooltips to be used with icon only buttons. Useful for
    > some UI designs

- **dataCollectors**: set up initial models and admin ([#6142](https://github.com/kobotoolbox/kpi/pull/6142))
    > <!-- 📣 Summary -->
    > Add new data collector models to Django admin.
    > 
    > <!-- 📖 Description -->
    > Adds DataCollector and DataCollectorGroup models to Django admin. A
    > DataCollectorGroup may have several DataCollectors and be associated
    > with several Assets. Every DataCollector has a token, which may be
    > rotated using Django admin.

- **dataCollectors**: utilities for creating enketo links ([#6196](https://github.com/kobotoolbox/kpi/pull/6196))
- **dataCollectors**: update enketo links when assigning assets to groups ([#6197](https://github.com/kobotoolbox/kpi/pull/6197))
    > <!-- 📣 Summary -->
    > Create/update enketo links for data collectors when assigning assets to
    > data collector groups.
    > 
    > <!-- 📖 Description -->
    > Create the necessary enketo links for data collectors so they can
    > view/submit to the assets to which their group has access.

- **dataCollectors**: create authentication class for data collectors ([#6203](https://github.com/kobotoolbox/kpi/pull/6203))
- **instanceHistory**: add root_uuid to instancehistory ([#6143](https://github.com/kobotoolbox/kpi/pull/6143))
- **instanceHistory**: Celery task to clean instance history records ([#6165](https://github.com/kobotoolbox/kpi/pull/6165))
    > <!-- 📣 Summary -->
    > InstanceHistory objects are kept for an amount of days given by the
    > constance parameter SUBMISSION_HISTORY_GRACE_PERIOD. After this period
    > has passed, the records that have no associated instance (xform_instance
    > = NULL) are deleted by a celery task that runs weekly.

- **massEmails**: get name from extra details ([#6131](https://github.com/kobotoolbox/kpi/pull/6131))
    > <!-- 📣 Summary -->
    > Use the user-entered name in mass email templates.

- **permissions**: Kobocat/OpenRosa - Merge Permissions Systems ([#5887](https://github.com/kobotoolbox/kpi/pull/5887))
    > <!-- 📣 Summary -->
    > This contains multiple PR's from the project `Kobocat/OpenRosa - Merge Permissions Systems`:
    > 1. Remove the ObjectPermissionBackend 
    > 2. Remove Guardian related code 
    > 3. Clean up obsolete Kobocat/OpenRosa permissions code
    > 4. Remove all occurrences of the special permission PERM_FROM_KC_ONLY from the database and from the codebase
    > 5. Remove Guardian dependancy.
    > 6. Replacing guardian extension used in openrosa apps with functions from the kpi permissions system.

- **reversion**: task to remove version objects ([#6162](https://github.com/kobotoolbox/kpi/pull/6162))
- **reversion**: optimize version removal task ([#6204](https://github.com/kobotoolbox/kpi/pull/6204))
</details>

<details><summary>Bug Fixes (21)</summary>

- **UniversalTable**: don't crash while data is loading ([#6141](https://github.com/kobotoolbox/kpi/pull/6141))
- **UniversalTable**: don't crash in webpack ([#6147](https://github.com/kobotoolbox/kpi/pull/6147))
- **api**: restore default renderers for API `v1` ([#6257](https://github.com/kobotoolbox/kpi/pull/6257))
    > <!-- 📣 Summary -->
    > Reinstate API v1’s renderer settings so browsers receive HTML by default
    > instead of XML.

- **api**: respect the rendering format when it is provided ([#6325](https://github.com/kobotoolbox/kpi/pull/6325))
    > <!-- 📣 Summary -->
    > Remove custom negotiation class which broke the rendering of the API
    > response with a browser

- **audioRecording**: background audio file being soft deleted on creation ([#6207](https://github.com/kobotoolbox/kpi/pull/6207))
    > <!-- 📣 Summary -->
    > This PR adds the pattern for the background audio file generated by
    > Enketo to the fix to avoid it being soft-deleted on creation

- **billing**: schedule update-exceeded-limit-counters with crontab ([#6232](https://github.com/kobotoolbox/kpi/pull/6232))
    > <!-- 📣 Summary -->
    > Use crontab scheduling instead of timedelta for
    > update-exceeded-limit-counters task.

- **billing**: enforce grace period using `datetime` on exceeded limit counters ([#6255](https://github.com/kobotoolbox/kpi/pull/6255))
    > <!-- 📣 Summary -->
    > Fixed an issue where storage limit counters could update too early
    > because only the calendar date was checked. Now the system respects a
    > full 24-hour grace period before updating counters.
    > 
    > <!-- 📖 Description -->
    > Previously, exceeded limit counters were filtered using only the date
    > portion of `date_modified`. This meant that if a user exceeded their
    > limit late in the day (e.g., 3 PM), the counter could be updated just
    > after midnight instead of waiting the full 24 hours.
    > We now compare the full `datetime` so counters are only updated once the
    > full grace period has passed. This ensures fairer enforcement of storage
    > limits and avoids premature counter increments or deletions.

- **dataCollectors**: revert accidental change ([#6154](https://github.com/kobotoolbox/kpi/pull/6154))
- **exports**: simplify account log export prompt ([#6183](https://github.com/kobotoolbox/kpi/pull/6183))
    > <!-- 📣 Summary -->
    > Notifications for exporting access logs now match notifications for
    > project activity logs

- **exports**: use empty object for empty payload ([#6201](https://github.com/kobotoolbox/kpi/pull/6201))
- **fetch**: headers handling on frontend API calls ([#6211](https://github.com/kobotoolbox/kpi/pull/6211))
    > <!-- 📣 Summary -->
    > Fixes a bug with headers handling in recently refactored code for
    > frontend API calls that was causing an infinite loading spinner on the
    > usage page.

- **frontend**: ensure country list respects RTL languages ([#5875](https://github.com/kobotoolbox/kpi/pull/5875))
    > ## 📣 Summary
    > Ensure countries list is displayed in the correct direction for RTL
    > languages.
    > 
    > ## 📖 Description
    > This adjusts `getCountryDisplayString` so that when the UI language is
    > RTL (like Arabic or Hebrew), the countries list respects the reading
    > order, improving the UX for RTL users.
    > 
    > No functional changes outside the display of the countries string.
    > 
    > ## 👷 Description for instance maintainers
    > No database or deployment changes. Pure frontend utility fix.
    > 
    > ## 💭 Notes
    > * Couldn't fully run the local Docker frontend due to platform + Docker
    > daemon issues on ARM Mac, but linting, unit tests, and code review of
    > the minimal change look solid.
    > * Happy to adjust or add any follow-up if maintainers suggest
    > improvements.
    > 
    > ## 👀 Preview steps
    > *(didn't run full manual UI preview locally due to setup blockers —
    > trusting maintainers to validate UI or have CI e2e handle it)*

- **instanceHistory**: Persist instance history when instance is deleted ([#6152](https://github.com/kobotoolbox/kpi/pull/6152))
    > <!-- 📣 Summary -->
    > The InstanceHistory objects are not deleted when the referenced instance
    > is deleted anymore. They remain for an configurable amount of days after
    > which they are collected and purged

- **languageSelector**: remove native cancel button on chrome ([#6202](https://github.com/kobotoolbox/kpi/pull/6202))
    > <!-- 📣 Summary -->
    > 
    > Chrome no longer displays two clear search buttons ("x") in Language
    > Selector component.

- **massEmails**: get name from user extra_details with no backup ([#6163](https://github.com/kobotoolbox/kpi/pull/6163))
    > <!-- 📣 Summary -->
    > Use the full user name in the user extra_details object, for mass email
    > templates. If the user has no name it defaults to None.
    > 
    > 👀 Preview steps
    > 
    > This is most easily tested with MASS_EMAILS_CONDENSE_SEND set to true.
    > 
    > 1. Using a user account, add a full name in Account Settings
    > 2. Add the user's email to Constance > MASS_EMAIL_TEST_EMAILS
    > 3. Create a new mass email config using the test_users query that uses
    > ##full_name## somewhere in the template and set it to live
    > 4. 🟢 At the next email send, the name entered in the account settings
    > should be rendered in the email

- **migrations**: partially revert #6157; avoid renaming `_reversion_version` ([#6229](https://github.com/kobotoolbox/kpi/pull/6229))
- **migrations**: revert _reversion_version change in historical kpi 0015 migration ([#6239](https://github.com/kobotoolbox/kpi/pull/6239))
- **nlp**: reset polling status after auto translation finishes ([#6184](https://github.com/kobotoolbox/kpi/pull/6184))
    > <!-- 📣 Summary -->
    > Fixes a bug in NLP where attempting a second automatic translation
    > resulted in a infinite loading screen

- **projectSettings**: unnecessary modal padding ([#6138](https://github.com/kobotoolbox/kpi/pull/6138))
- **swaggerUI**: restore search bar functionality with collapsed tags ([#6319](https://github.com/kobotoolbox/kpi/pull/6319))
    > <!-- 📣 Summary -->
    > Fix Swagger UI search so results appear even when endpoint groups are collapsed by default.

- **tooltip**: replace deprecated button with new button in table cells ([#6178](https://github.com/kobotoolbox/kpi/pull/6178))
    > <!-- 📣 Summary -->
    > Replaces deprecated button with new button that fixes a tooltip issue in
    > the data table

</details>

<details><summary>Documentation (2)</summary>

- **accesslog**: add proper markdown documentation for access logs ([#6274](https://github.com/kobotoolbox/kpi/pull/6274))
    > <!-- 📣 Summary -->
    > Fix API documentation so the access log endpoints display their own
    > description instead of reusing audit log text.
    > 
    > <!-- 📖 Description -->
    > The API documentation for access logs was incorrectly showing the audit
    > log description because the access log view extends the audit log
    > viewset and inherited its markdown. This change introduces dedicated
    > markdown documentation for the access log endpoints, ensuring that their
    > purpose, fields, and usage are clearly documented and no longer
    > overwritten by audit log content.

- **api**: set up API documentation with drf-spectacular and Swagger UI ([#5746](https://github.com/kobotoolbox/kpi/pull/5746))
    > <!-- 📣 Summary -->
    > Integrated drf-spectacular and Swagger UI to auto-generate OpenAPI
    > documentation and added developer documentation to guide implementation
    > for each endpoint.
    > 
    > <!-- 📖 Description -->
    > This PR introduces API documentation support using drf-spectacular for
    > OpenAPI schema generation and Swagger UI for live documentation
    > browsing. The setup enables automatic schema generation for KPI’s v2 API
    > and lays the foundation for documenting all endpoints consistently.
    > 
    > Enabled Swagger UI at `/api/v2/docs/` and schema access at
    > `/api/v2/schema/`.
    > 
    > Added
    > [README](https://github.com/kobotoolbox/kpi/blob/6d285ad83b45c1b6fbaaeab73497fec9d5027fb1/docs/README.md)
    > on how to document a ViewSet properly using `@extend_schema` and related
    > helpers.
    > 
    > ### 🗒️ Endpoints checklist
    > 
    > ### Access Logs
    > - [x] /api/v2/access-logs/
    > - [x] /api/v2/access-logs/export/
    > - [x] /api/v2/access-logs/me/
    > - [x] /api/v2/access-logs/me/export/
    > 
    > ### Asset Snapshots
    > - [x] /api/v2/asset_snapshots/
    > - [x] /api/v2/asset_snapshots/{uid}/
    > - [x] /api/v2/asset_snapshots/{uid}/preview/
    > - [x] /api/v2/asset_snapshots/{uid}/xform/
    > - [x] /api/v2/asset_snapshots/{uid}/xml_with_disclaimer/
    >  #### OpenRosa for edits
    >  - [x] /api/v2/asset_snapshots/{uid}/formList
    >  - [x] /api/v2/asset_snapshots/{uid}/manifest
    >  - [x] /api/v2/asset_snapshots/{uid}/submission
    > 
    > ### Asset Subscriptions
    > - [x] /api/v2/asset_subscriptions/
    > - [x] /api/v2/asset_subscriptions/{uid}/
    > 
    > ### Asset Usage
    > - [x] /api/v2/asset_usage/
    > 
    > ### Assets
    > - [x] /api/v2/assets/
    > - [x] /api/v2/assets/{parent_lookup_asset}/counts/
    > - [x] /api/v2/assets/{parent_lookup_asset}/data/
    > - [x]
    > /api/v2/assets/{parent_lookup_asset}/data/{parent_lookup_data}/attachments/
    > - [x]
    > /api/v2/assets/{parent_lookup_asset}/data/{parent_lookup_data}/attachments/{pk}/
    > - [x]
    > /api/v2/assets/{parent_lookup_asset}/data/{parent_lookup_data}/attachments/{pk}/{suffix}/
    > - [x] /api/v2/assets/{parent_lookup_asset}/data/{pk}/
    > - [x] /api/v2/assets/{parent_lookup_asset}/data/{pk}/duplicate/
    > - [x] /api/v2/assets/{parent_lookup_asset}/data/{pk}/enketo/{var}view/
    > - [x] /api/v2/assets/{parent_lookup_asset}/data/{pk}/validation_status/
    > - [x] /api/v2/assets/{parent_lookup_asset}/data/bulk/
    > - [x] /api/v2/assets/{parent_lookup_asset}/data/validation_statuses/
    > - [x] /api/v2/assets/{parent_lookup_asset}/export-settings/
    > - [x] /api/v2/assets/{parent_lookup_asset}/export-settings/{uid}/
    > - [x] /api/v2/assets/{parent_lookup_asset}/export-settings/{uid}/data/
    > - [x] /api/v2/assets/{parent_lookup_asset}/exports/
    > - [x] /api/v2/assets/{parent_lookup_asset}/exports/{uid}/
    > - [x] /api/v2/assets/{parent_lookup_asset}/files/
    > - [x] /api/v2/assets/{parent_lookup_asset}/files/{uid}/
    > - [x] /api/v2/assets/{parent_lookup_asset}/files/{uid}/content/
    > - [x] /api/v2/assets/{parent_lookup_asset}/history/
    > - [x] /api/v2/assets/{parent_lookup_asset}/history/actions/
    > - [x] /api/v2/assets/{parent_lookup_asset}/history/export/
    > - [x] /api/v2/assets/{parent_lookup_asset}/hooks/
    > - [x]
    > /api/v2/assets/{parent_lookup_asset}/hooks/{parent_lookup_hook}/logs/
    > - [x]
    > /api/v2/assets/{parent_lookup_asset}/hooks/{parent_lookup_hook}/logs/{uid}/
    > - [x]
    > /api/v2/assets/{parent_lookup_asset}/hooks/{parent_lookup_hook}/logs/{uid}/retry/
    > - [x] /api/v2/assets/{parent_lookup_asset}/hooks/{uid}/
    > - [x] /api/v2/assets/{parent_lookup_asset}/hooks/{uid}/retry/
    > - [x] /api/v2/assets/{parent_lookup_asset}/paired-data/
    > - [x]
    > /api/v2/assets/{parent_lookup_asset}/paired-data/{paired_data_uid}/
    > - [x]
    > /api/v2/assets/{parent_lookup_asset}/paired-data/{paired_data_uid}/external/
    > - [x] /api/v2/assets/{parent_lookup_asset}/permission-assignments/
    > - [x] /api/v2/assets/{parent_lookup_asset}/permission-assignments/{uid}/
    > - [x] /api/v2/assets/{parent_lookup_asset}/permission-assignments/bulk/
    > - [x] /api/v2/assets/{parent_lookup_asset}/permission-assignments/clone/
    > - [x] /api/v2/assets/{parent_lookup_asset}/versions/
    > - [x] /api/v2/assets/{parent_lookup_asset}/versions/{uid}/
    > - [x] /api/v2/assets/{uid}/
    > - [x] /api/v2/assets/{uid}/content/
    > - [x] /api/v2/assets/{uid}/deployment/
    > - [x] /api/v2/assets/{uid}/reports/
    > - [x] /api/v2/assets/{uid}/table_view/
    > - [x] /api/v2/assets/{uid}/valid_content/
    > - [x] /api/v2/assets/{uid}/xform/
    > - [x] /api/v2/assets/{uid}/xls/
    > - [x] /api/v2/assets/bulk/
    > - [x] /api/v2/assets/hash/
    > - [x] /api/v2/assets/metadata/
    > 
    > ### Audit Logs
    > - [x] /api/v2/audit-logs/
    > 
    > ### Authorized Application
    > - [x] /api/v2/authorized_application/users/
    > - [x] /api/v2/authorized_application/users/authenticate_user/
    > 
    > ### Imports
    > - [x] /api/v2/imports/
    > - [x] /api/v2/imports/{uid}/
    > 
    > ### Languages
    > - [x] /api/v2/languages/
    > - [x] /api/v2/languages/{code}/
    > 
    > ### Organizations
    > - [x] /api/v2/organizations/
    > - [x] /api/v2/organizations/{id}/
    > - [x] /api/v2/organizations/{id}/asset_usage/
    > - [x] /api/v2/organizations/{id}/assets/
    > - [x] /api/v2/organizations/{id}/service_usage/
    > - [x] /api/v2/organizations/{organization_id}/members/
    > - [x] /api/v2/organizations/{organization_id}/members/{user__username}/
    > 
    > ### Me
    > - [x] /me/
    > - [x] /me/social-accounts/
    > - [x] /me/social-accounts/{provider}/{uid}/
    > - [x] /me/email/
    > 
    > ### Permissions
    > - [x] /api/v2/permissions/
    > - [x] /api/v2/permissions/{codename}/
    > 
    > ### Project Ownership Invites
    > - [x] /api/v2/project-ownership/invites/
    > - [x]
    > /api/v2/project-ownership/invites/{parent_lookup_invite_uid}/transfers/
    > - [x]
    > /api/v2/project-ownership/invites/{parent_lookup_invite_uid}/transfers/{uid}/
    > - [x] /api/v2/project-ownership/invites/{uid}/
    > 
    > ### Project Views
    > - [x] /api/v2/project-views/
    > - [x] /api/v2/project-views/{uid}/
    > - [x] /api/v2/project-views/{uid}/{obj_type}/export/
    > - [x] /api/v2/project-views/{uid}/assets/
    > - [x] /api/v2/project-views/{uid}/users/
    > 
    > ### Service Usage
    > - [x] /api/v2/service_usage/
    > 
    > ### Tags
    > - [x] /api/v2/tags/
    > - [x] /api/v2/tags/{uid}/
    > 
    > ### TOS
    > - [x] /api/v2/terms-of-services/
    > - [x] /api/v2/terms-of-services/{slug}/
    > 
    > ### Transcription Services
    > - [x] /api/v2/transcription-services/
    > - [x] /api/v2/transcription-services/{code}/
    > 
    > ### Translation Services
    > - [x] /api/v2/translation-services/
    > - [x] /api/v2/translation-services/{code}/
    > 
    > ### Users
    > - [x] /api/v2/users/
    > - [x] /api/v2/users/{username}/

</details>

<details><summary>Continous Integration (8)</summary>

- **npm**: assert up to date package-lock.json ([#6317](https://github.com/kobotoolbox/kpi/pull/6317))
- **releases**: release every 4 weeks ([#6189](https://github.com/kobotoolbox/kpi/pull/6189))
- **releases**: release every 4 weeks, modulo 1 ([#6208](https://github.com/kobotoolbox/kpi/pull/6208))
- **releases**: output a forgotten variable ([#6212](https://github.com/kobotoolbox/kpi/pull/6212))
- **releases**: run version even if a test fails ([#6316](https://github.com/kobotoolbox/kpi/pull/6316))
- **staging**: deploy nonprod envs with github actions INFRA-14 ([#6186](https://github.com/kobotoolbox/kpi/pull/6186))
- **staging**: Removing staging deploys from gitlab ([#6220](https://github.com/kobotoolbox/kpi/pull/6220))
- **storybook**: Deploying storybook with GHA INFRA-15 ([#6221](https://github.com/kobotoolbox/kpi/pull/6221))
</details>

<details><summary>Security (12)</summary>

- **deps**: bump @tanstack/react-query from 5.84.1 to 5.85.5 ([#6174](https://github.com/kobotoolbox/kpi/pull/6174))
- **deps-dev**: bump @storybook/addon-links from 9.0.0-beta.11 to 9.1.3 ([#6148](https://github.com/kobotoolbox/kpi/pull/6148))
- **deps-dev**: bump @eslint/eslintrc from 3.2.0 to 3.3.1 ([#6149](https://github.com/kobotoolbox/kpi/pull/6149))
- **deps-dev**: bump @types/gtag.js from 0.0.12 to 0.0.20 ([#6158](https://github.com/kobotoolbox/kpi/pull/6158))
- **deps-dev**: bump sass from 1.77.6 to 1.91.0 ([#6168](https://github.com/kobotoolbox/kpi/pull/6168))
- **deps-dev**: bump terser-webpack-plugin from 5.3.10 to 5.3.14 ([#6169](https://github.com/kobotoolbox/kpi/pull/6169))
- **deps-dev**: bump @swc/jest from 0.2.36 to 0.2.39 ([#6171](https://github.com/kobotoolbox/kpi/pull/6171))
- **deps-dev**: bump webpack from 5.97.1 to 5.101.3 ([#6172](https://github.com/kobotoolbox/kpi/pull/6172))
- **deps-dev**: bump msw from 2.10.4 to 2.10.5 ([#6173](https://github.com/kobotoolbox/kpi/pull/6173))
- **deps-dev**: bump eslint-plugin-react-hooks from 5.1.0 to 5.2.0 ([#6175](https://github.com/kobotoolbox/kpi/pull/6175))
- **deps-dev**: bump react-refresh from 0.14.2 to 0.17.0 ([#6179](https://github.com/kobotoolbox/kpi/pull/6179))
- **deps-dev**: bump @testing-library/jest-dom from 6.6.4 to 6.8.0 ([#6180](https://github.com/kobotoolbox/kpi/pull/6180))
</details>

<details><summary>Refactor (2)</summary>

- **UniversalTable**: handle future generated API helpers ([#6134](https://github.com/kobotoolbox/kpi/pull/6134))
- **frontend**: generate API react-query helpers with Orval ([#6083](https://github.com/kobotoolbox/kpi/pull/6083))
</details>

<details><summary>Chores (5)</summary>

- **assetVersions**: remove reversion usages ([#6200](https://github.com/kobotoolbox/kpi/pull/6200))
    > <!-- 📣 Summary -->
    > Removing usages of the django-reversion extension.

- **docs**: remove `@action` leftover JSONserializer ([#6153](https://github.com/kobotoolbox/kpi/pull/6153))
    > <!-- 📣 Summary -->
    > Cleaned up unused code by removing unnecessary `JSONSerializers` from
    > action decorators.

- **openAPI**: improve API documentation structure and descriptions ([#6313](https://github.com/kobotoolbox/kpi/pull/6313))
    > <!-- 📣 Summary -->
    > Restructure API documentation with clearer grouping of endpoints and
    > more detailed descriptions.

- **openAPI**: update HTML template title and text body ([#6331](https://github.com/kobotoolbox/kpi/pull/6331))
    > <!-- 📣 Summary -->
    > Replace default DRF title and update the top level text

- remove unused import ([#6276](https://github.com/kobotoolbox/kpi/pull/6276))
    > <!-- 📣 Summary -->
    > Remove an unused import after merging #6274 in release branch.

</details>

<details><summary>Revert (1)</summary>

- **docs**: restore JSON renderer only for some endpoints ([#6155](https://github.com/kobotoolbox/kpi/pull/6155))
    > <!-- 📣 Summary -->
    > Revert some changes made in #6153

</details>

<details><summary>Other (1)</summary>

- [NA] Setting correct version on main deploys ([#6194](https://github.com/kobotoolbox/kpi/pull/6194))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.025.34d..2.025.37
<!-- generated by git-cliff -->
