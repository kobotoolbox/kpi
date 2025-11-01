<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (19)</summary>

- **account**: delete account UI ([#6259](https://github.com/kobotoolbox/kpi/pull/6259))
    > <!-- 📣 Summary -->
    > 
    > Add option to safely and irreverseably delete account to Account
    > Settings → Profile. The change is hidden behind feature flag.

- **account**: use env flag instead of feature flag for delete account banner ([#6283](https://github.com/kobotoolbox/kpi/pull/6283))
- **api**: add filtering and ordering support for `/api/v2/user-reports` endpoint ([#6342](https://github.com/kobotoolbox/kpi/pull/6342))
    > <!-- 📣 Summary -->
    > Adds robust filtering and ordering capabilities to the
    > `/api/v2/user-reports` API endpoint, enabling users and admins to query
    > large user datasets efficiently by date, usage metrics, and subscription
    > attributes, all backed by the optimized materialized view for scalable
    > performance on millions of records.
    > 
    > <!-- 📖 Description -->
    > This PR introduces the filtering and ordering layer for the
    > `/api/v2/user-reports` endpoint, built on top of the existing
    > materialized view (`user_reports_userreportsmv`) that aggregates
    > user-level billing and usage data.
    > 
    > Also, added targeted indexes in `0003_add_user_reports_mv_indexes.py` on
    > high-cardinality numeric and timestamp columns to support range queries
    > without full table scans.
    > 
    >  Examples of usage:
    >  - Filter by username (case-insensitive, starts with):
    >  `/api/v2/user-reports/?q=username__icontains:raj`
    >  - Filter by email (case-insensitive, starts with):
    >  `/api/v2/user-reports/?q=email:kobo@example.com`
    > 
    >  - Filter by total storage bytes (greater than or equal to):
    > `/api/v2/user-reports/?q=service_usage__total_storage_bytes__gte:1`
    >  - Filter by total storage bytes (less than or equal to):
    > `/api/v2/user-reports/?q=service_usage__total_storage_bytes__lte:1`
    > 
    > ---
    > 
    > Part of https://github.com/kobotoolbox/kpi/pull/6243

- **billing**: update addon copy ([#6288](https://github.com/kobotoolbox/kpi/pull/6288))
    > <!-- 📣 Summary -->
    > Updates copy describing addons on the addons page.

- **billing**: bypass limit enforcement for submission edits ([#6281](https://github.com/kobotoolbox/kpi/pull/6281))
    > <!-- 📣 Summary -->
    > Bypasses restrictions on submissions based on usage limit enforcement
    > when users are submitting edits.

- **constanceSettings**: make self account deletion feature disabled by default ([#6380](https://github.com/kobotoolbox/kpi/pull/6380))
- **dataCollectors**: update enketo links when data collectors change ([#6198](https://github.com/kobotoolbox/kpi/pull/6198))
    > <!-- 📣 Summary -->
    > Create/update enketo links for data collectors when assigning data
    > collectors to groups or rotating tokens.

- **dataCollectors**: allow DCs access to read-only OpenRosa endpoints ([#6258](https://github.com/kobotoolbox/kpi/pull/6258))
    > <!-- 📣 Summary -->
    > Allow data collectors to view surveys in Enketo.
    > 
    > <!-- 📖 Description -->
    > Updates the OpenRosa endpoints to allow urls of the form
    > `/key/<token>/endpoint` and provide the correct response if the data
    > collector with the relevant token is part of a group that has access to
    > the xform.

- **dataCollectors**: allow data collectors to submit responses ([#6328](https://github.com/kobotoolbox/kpi/pull/6328))
    > <!-- 📣 Summary -->
    > Allow data collectors to add submissions to specified assets.

- **dataCollectors**: improve Django Admin UX for data collector groups ([#6337](https://github.com/kobotoolbox/kpi/pull/6337))
    > <!-- 📣 Summary -->
    > Make data collector group management easier by adding autocomplete
    > fields and a two-column selector for choosing projects.

- **dataCollectors**: display collection client URLs in Django Admin ([#6355](https://github.com/kobotoolbox/kpi/pull/6355))
    > <!-- 📣 Summary -->
    > Show ready-to-use links for Enketo Express and KoboCollect on Data
    > Collector pages in Django Admin

- **dataCollectors**: change key to collector ([#6365](https://github.com/kobotoolbox/kpi/pull/6365))
    > <!-- 📣 Summary -->
    > Use "collector" instead of "key" for data collector URLs.

- **dataCollectors**: cleanup admin UI ([#6369](https://github.com/kobotoolbox/kpi/pull/6369))
    > <!-- 📣 Summary -->
    > Minor improvements to the Django admin UI for data collectors and data
    > collector groups.
    > 
    > <!-- 📖 Description -->
    > Order data collectors and data collector groups by date created in the
    > list view. Also change the kobocat url "link" to plain text when in the
    > edit view for a data collector to make it clear that it's not actually a
    > link, just an example of the base url that Kobocat will use for this DC.

- **environment**: use Constance setting to toggle user account deletion ([#6280](https://github.com/kobotoolbox/kpi/pull/6280))
    > <!-- 📣 Summary -->
    > Add a configurable flag `ALLOW_SELF_ACCOUNT_DELETION` to enable or
    > disable user account deletion through the Constance admin.

- **massEmails**: parameterize users query functions in mass emails app ([#6279](https://github.com/kobotoolbox/kpi/pull/6279))
    > <!-- 📣 Summary -->
    > Added custom parameters for users query functions in the mass emails app
    > 
    > <!-- 📖 Description -->
    > With the new model MassEmailQueryParam you can customize the parameters
    > passed to the user query functions in the mass emails app. To do this
    > successfully you have to check the function parameters names and their
    > type hints. For now this only supports the types (int, float, str),
    > which are easily converted. WARNING: If the value provided for the
    > parameter can't be converted to the type, it will leave the parameter
    > use the default value. All parameters MUST have a default value in case
    > they are not customized in the MassEmailConfig instance.

- **projectHistoryLogs**: add data collector group info to submissions ([#6356](https://github.com/kobotoolbox/kpi/pull/6356))
    > <!-- 📣 Summary -->
    > Add data collector group name and uid to project history logs when
    > submissions are from data collectors.

- **usageLimits**: conditional over usage limit error message ([#6254](https://github.com/kobotoolbox/kpi/pull/6254))
    > <!-- 📣 Summary -->
    > This PR implements a conditional error message based on the usage type
    > for submissions failed due to account being over limit.

- **usageLimits**: Check all users storage usage to get their ExceededLimitCounter's ([#6267](https://github.com/kobotoolbox/kpi/pull/6267))
    > <!-- 📣 Summary -->
    > A new long running process is added to backfill exceeded limits counters
    > for storage usage type.

- **userReports**: add `/api/v2/user-reports/` endpoint for superusers ([#6243](https://github.com/kobotoolbox/kpi/pull/6243))
    > <!-- 📣 Summary -->
    > Add a new superuser-only endpoint, `/api/v2/user-reports/`, to access
    > and filter all user usage data.

</details>

<details><summary>Bug Fixes (39)</summary>

- **CI**: pin darker dependency in CI ([#6263](https://github.com/kobotoolbox/kpi/pull/6263))
    > <!-- 📣 Summary -->
    > Pins version of darker used in GitHub CI for backend lint action.

- **account**: disallow editing email if linked to social account ([#6265](https://github.com/kobotoolbox/kpi/pull/6265))
- **account**: clearing fields operated by Selects ([#6340](https://github.com/kobotoolbox/kpi/pull/6340))
    > <!-- 📣 Summary -->
    > 
    > Removing country, sector, gender, and organization type is possible
    > again.

- **accountSettings**: adjust delete banner message ([#6302](https://github.com/kobotoolbox/kpi/pull/6302))
- **accountSettings**: error handling in email section ([#6350](https://github.com/kobotoolbox/kpi/pull/6350))
    > <!-- 📣 Summary -->
    > 
    > Displays error in UI when changing email and API validates the proposed
    > email as invalid.

- **accountSettings**: change label ([#6391](https://github.com/kobotoolbox/kpi/pull/6391))
- **accounts**: block self-deletion when the account still owns data ([#6334](https://github.com/kobotoolbox/kpi/pull/6334))
    > <!-- 📣 Summary -->
    > Prevent users from deleting their own account if it still contains
    > projects, collections, blocks, questions, templates, or other owned
    > resources.

- **api**: Set all the required fields for service usage data schemas ([#6236](https://github.com/kobotoolbox/kpi/pull/6236))
    > <!-- 📣 Summary -->
    > Set required fields for service usage openapi types data schemas

- **api**: fix warnings for repeated service usage component ([#6282](https://github.com/kobotoolbox/kpi/pull/6282))
    > <!-- 📣 Summary -->
    > Fix warnings in generate_api script due to service usage repeated component

- **api**: fix required props for organization service usage component props ([#6285](https://github.com/kobotoolbox/kpi/pull/6285))
    > <!-- 📣 Summary -->
    > Set required props for
    > OrganizationServiceUsageResponseTotalSubmissionCount

- **api**: type /organizations/:id/service_usage response ([#6284](https://github.com/kobotoolbox/kpi/pull/6284))
- **api**: type OrganizationResponse ([#6292](https://github.com/kobotoolbox/kpi/pull/6292))
- **api**: add OpenAPI schema for stripe endpoints ([#6230](https://github.com/kobotoolbox/kpi/pull/6230))
- **assets**: handle anonymous user access on asset snapshot list ([#6409](https://github.com/kobotoolbox/kpi/pull/6409))
    > <!-- 📣 Summary -->
    > Fixes an issue where anonymous users received a 500 error when accessing
    > the asset snapshots list endpoint. Anonymous requests now safely return
    > an empty response instead of causing a server error.
    > 
    > <!-- 📖 Description -->
    > Previously, the `/api/v2/asset_snapshots/` endpoint raised a server
    > error when accessed anonymously, because the code attempted to access
    > `organization.is_admin_only()` even when no organization was associated
    > with the user.
    > This PR updates the filtering logic to handle anonymous users gracefully
    > and adds a unit test to ensure no 500 error occurs in such cases.

- **attachment**: persist original filename on save ([#6394](https://github.com/kobotoolbox/kpi/pull/6394))
    > <!-- 📣 Summary -->
    > Ensure uploaded attachments keep their exact original filenames when
    > saved.
    > 
    > <!-- 📖 Description -->
    > This change fixes an issue where uploaded files could lose or alter
    > their original names during the save process. The system now preserves
    > the raw filename provided by the client, bypassing Django’s default
    > sanitization when appropriate. This guarantees that the stored filename
    > matches exactly what was uploaded, improving traceability and
    > compatibility with external tools relying on original filenames.

- **auth**: stop sending password reset emails to unknown accounts ([#6410](https://github.com/kobotoolbox/kpi/pull/6410))
    > <!-- 📣 Summary -->
    > Prevent password reset emails from being sent to unregistered email
    > addresses while keeping the same non-revealing message on the reset
    > page.
    > 
    > <!-- 📖 Description -->
    > Previously, Kobo would send a password reset email even when the entered
    > email address was not associated with any existing account.
    > This behavior, inherited from django-allauth defaults, could lead to
    > unsolicited emails being sent to arbitrary addresses.
    > 
    > This PR updates the configuration to:
    > - Set `ACCOUNT_EMAIL_UNKNOWN_ACCOUNTS = False`, ensuring no email is
    > sent if the address doesn’t match any account.
    > - Preserve the existing UI message to avoid exposing valid accounts and
    > maintain account-enumeration protection.

- **billing**: enable portal upgrades to unlimited plan ([#6293](https://github.com/kobotoolbox/kpi/pull/6293))
    > <!-- 📣 Summary -->
    > Fixes a bug where a user upgrading from an existing subscription to an
    > "unlimited" type plan would get a 500 on their request.

- **dataCollectors**: fix adding assets to groups in admin ([#6226](https://github.com/kobotoolbox/kpi/pull/6226))
    > <!-- 📣 Summary -->
    > Fixes a bug that was removing old assets from data collector groups when
    > new ones were added.

- **dataCollectors**: set correct redis entries ([#6228](https://github.com/kobotoolbox/kpi/pull/6228))
- **dataCollectors**: remove assets from groups if owners lose permission ([#6357](https://github.com/kobotoolbox/kpi/pull/6357))
    > <!-- 📣 Summary -->
    > Ensure data collectors can no longer access projects if the group owner
    > has lost permission.
    > 
    > <!-- 📖 Description -->
    > Data collector group owners can only add an asset to their group if they
    > have the manage-asset permission. If that permission is removed, the
    > asset should no longer be assigned to the group and all the associated
    > data collector enketo links should be removed.

- **docs**: Use a shared type for service usage balances values ([#6233](https://github.com/kobotoolbox/kpi/pull/6233))
    > <!-- 📣 Summary -->
    > Use an unified type for the service usage balance data across
    > organization service usage responses and service usage responses.

- **docs**: Fix ErrorDetail type usage in error responses ([#6235](https://github.com/kobotoolbox/kpi/pull/6235))
    > <!-- 📣 Summary -->
    > Use ErrorDetail for 404 errors, given that they only return a string
    > message. ErrorObject type is used for validation error responses only,
    > at least for now.
    > 
    > ### Preview steps
    > 1. Check that 404 errors are ErrorDetail, in the Orval jsapp model
    > files.

- **docs**: Use enums in invite role and status fields ([#6249](https://github.com/kobotoolbox/kpi/pull/6249))
    > <!-- 📣 Summary -->
    > Use enums in the status and role fields for the invite schemas in the
    > drf-spectacular extensions

- **docs**: Use enum for organizations field request_user_role ([#6253](https://github.com/kobotoolbox/kpi/pull/6253))
    > <!-- 📣 Summary -->
    > Use an enum for the organization response field request_user_role
    > 
    > ### Preview steps
    > 1. Go to http://kf.kobo.local/api/v2/docs/
    > 2, Search for the endpoint /api/v2/organizations/{id}/
    > 3. See in the response schema that it shows enums for the field
    > request_user_role
    > 4. Check the orval file jsapp/js/api/models/organization.ts shows a enum
    > type for request_user_role

- **formBuilder**: matrix not keeping order of rows ([#6295](https://github.com/kobotoolbox/kpi/pull/6295))
    > <!-- 📣 Summary -->
    > 
    > Fixes issue when Matrix wasn't respecting the order in which the rows or
    > the options of "Select one" or "Select many" responses were added.
    > Doesn't work retroactively on existing forms.

- **frontend**: roboto font loading ([#6199](https://github.com/kobotoolbox/kpi/pull/6199))
- **import_tools**: accept non-image attachments in .zip imports - ([#6055](https://github.com/kobotoolbox/kpi/pull/6055))
- **nlp**: permission error in qualitative analysis UI ([#6135](https://github.com/kobotoolbox/kpi/pull/6135))
    > <!-- 📣 Summary -->
    > Fix an error in the transcription screen UI that expected the permission manage_asset to allow translation. It was replaced by the change_submissions permission. KPI also allows users with partial permissions to change the asset advanced_features data.

- **openApi**: reuse MemberRoleEnum and InviteResponse ([#6314](https://github.com/kobotoolbox/kpi/pull/6314))
- **organization**: remove inactive users from Multi-Member Organization member list ([#6335](https://github.com/kobotoolbox/kpi/pull/6335))
    > <!-- 📣 Summary -->
    > Exclude inactive accounts from MMO member lists and counts so
    > deactivated users no longer appear in management views.

- **permissions**: [**breaking**] fix mistake in long running job that deletes obsolete permissions ([#6308](https://github.com/kobotoolbox/kpi/pull/6308))
- **reactQuery**: handle empty requests by Orval ([#6306](https://github.com/kobotoolbox/kpi/pull/6306))
- **reactQuery**: use of RequireOrg out of ReactQuery context ([#6352](https://github.com/kobotoolbox/kpi/pull/6352))
    > <!-- 📣 Summary -->
    > This PR fix the loading of TOS and Invalidated Password views

- **restServices**: fields input and missing padding ([#6278](https://github.com/kobotoolbox/kpi/pull/6278))
    > <!-- 📣 Summary -->
    > 
    > Fields input allows setting question names again.

- **types**: adjust code to match actual /me/ endpoint response ([#6242](https://github.com/kobotoolbox/kpi/pull/6242))
- linter & schemas ([62f90c7](https://github.com/kobotoolbox/kpi/commit/62f90c7fbba819b15dc1b1ffdf8f34d662d3f741))
- fix linter after merge ([0b702aa](https://github.com/kobotoolbox/kpi/commit/0b702aa3e0532f970f56cd265dc633d8878c2dcd))
- linter ([1b6bd4b](https://github.com/kobotoolbox/kpi/commit/1b6bd4b42d1f009598dfd9bc44795b43b07e5acc))
- fix merge conflicts ([d725205](https://github.com/kobotoolbox/kpi/commit/d725205c6a21722bebf1a39b833ea32b50d5090d))
</details>

<details><summary>Continous Integration (11)</summary>

- **biome**: filter for and lint tsconfig.json also ([#6300](https://github.com/kobotoolbox/kpi/pull/6300))
- **openApi**: enforce drf-spectacular warnings as errors ([#6287](https://github.com/kobotoolbox/kpi/pull/6287))
- **openapi**: fix drf-spectacular job ([#6386](https://github.com/kobotoolbox/kpi/pull/6386))
- **releases**: variable typo for zulip messages ([#6272](https://github.com/kobotoolbox/kpi/pull/6272))
- **releases**: deploy to beta only newest release ([#6312](https://github.com/kobotoolbox/kpi/pull/6312))
- **releases**: don't spam non-release branches ([#6332](https://github.com/kobotoolbox/kpi/pull/6332))
- **releases**: release every 4 weeks, modulo 2 ([#6333](https://github.com/kobotoolbox/kpi/pull/6333))
- **releases**: release every 4 weeks, modulo 3 ([#6361](https://github.com/kobotoolbox/kpi/pull/6361))
- **releases**: clarify beta deploy notification ([#6377](https://github.com/kobotoolbox/kpi/pull/6377))
- **sast**: move SAST to github actions from gitlab INFRA-11 ([#6271](https://github.com/kobotoolbox/kpi/pull/6271))
- **storybook**: Prevent Storybook cache from interfering with CI runs ([#6260](https://github.com/kobotoolbox/kpi/pull/6260))
</details>

<details><summary>Testing (4)</summary>

- **backend**: mock invalid non-XLS URL import ([#6364](https://github.com/kobotoolbox/kpi/pull/6364))
- **storybook**: handle useOrganizationAssumed ([#6309](https://github.com/kobotoolbox/kpi/pull/6309))
- **storybook**: DeleteAccountBanner ([#6338](https://github.com/kobotoolbox/kpi/pull/6338))
- **storybook**: add missing return ([#6349](https://github.com/kobotoolbox/kpi/pull/6349))
</details>

<details><summary>Security (3)</summary>

- **deps**: bump mobx from 6.13.0 to 6.15.0 ([#6297](https://github.com/kobotoolbox/kpi/pull/6297))
- **deps-dev**: bump concurrently from 9.2.0 to 9.2.1 ([#6301](https://github.com/kobotoolbox/kpi/pull/6301))
- **deps-dev**: bump @types/leaflet.heat from 0.2.4 to 0.2.5 ([#6303](https://github.com/kobotoolbox/kpi/pull/6303))
</details>

<details><summary>Refactor (9)</summary>

- **billing**: simplify frontend handling of Stripe subscription data ([#6347](https://github.com/kobotoolbox/kpi/pull/6347))
- **frontend**: add typed recordKeys and friends ([#6296](https://github.com/kobotoolbox/kpi/pull/6296))
- **frontend**: Select template ([#6311](https://github.com/kobotoolbox/kpi/pull/6311))
- **mantine**: migrate nlp qa text input ([#6362](https://github.com/kobotoolbox/kpi/pull/6362))
- **reactQuery**: adopt Orval's useOrganizationsRetrieve ([#6299](https://github.com/kobotoolbox/kpi/pull/6299))
- **reactQuery**: useOrganizationsServiceUsageSummary ([#6305](https://github.com/kobotoolbox/kpi/pull/6305))
- **reactQuery**: adopt Orval's useAccessLogsList ([#6307](https://github.com/kobotoolbox/kpi/pull/6307))
- **ts**: handle scss imports ([#6294](https://github.com/kobotoolbox/kpi/pull/6294))
- **usageLimits**: remove unused parameter ([#6277](https://github.com/kobotoolbox/kpi/pull/6277))
</details>

<details><summary>Styling (1)</summary>

- linting and formating ([#6406](https://github.com/kobotoolbox/kpi/pull/6406))
</details>

<details><summary>Chores (9)</summary>

- **dependencies**: bump package-lock ([#6244](https://github.com/kobotoolbox/kpi/pull/6244))
- **deps**: bump tmp from 0.0.33 to 0.2.5 in the minor-and-patch group across 1 directory ([#6318](https://github.com/kobotoolbox/kpi/pull/6318))
- **deps**: bump the actions-deps group across 1 directory with 5 updates ([#6247](https://github.com/kobotoolbox/kpi/pull/6247))
- **deps**: bump the actions-deps group with 2 updates ([#6359](https://github.com/kobotoolbox/kpi/pull/6359))
- **openAPI**: update api schema ([#6383](https://github.com/kobotoolbox/kpi/pull/6383))
    > <!-- 📣 Summary -->
    > Update API schema on `main` to ensure all the documentation is
    > up-to-date.

- **openAPI**: update orval with main ([#6384](https://github.com/kobotoolbox/kpi/pull/6384))
- **reversion**: turn off reversion vacuum ([#6256](https://github.com/kobotoolbox/kpi/pull/6256))
- **sass**: update sass and sass-loader ([#6237](https://github.com/kobotoolbox/kpi/pull/6237))
- update PR template ([#6290](https://github.com/kobotoolbox/kpi/pull/6290))
</details>

<details><summary>Other (6)</summary>

- Frontend fixes ([d52fc7a](https://github.com/kobotoolbox/kpi/commit/d52fc7a31b53d0d668533ec9f5a58ad244228f28))
- Recover organizations.ts ([d7c5e62](https://github.com/kobotoolbox/kpi/commit/d7c5e62cbf158d07ecf0e5aa1b2b6a82d2701e96))
- Fix organization imports ([f4262ff](https://github.com/kobotoolbox/kpi/commit/f4262ffda5cabb607902f6ad7149d419e07be641))
- add comments ([e6ac791](https://github.com/kobotoolbox/kpi/commit/e6ac7915b45e82324442ab7dc4adad0a3488bff3))
- WIP merge release/2.025.37 in main ([f9f7de3](https://github.com/kobotoolbox/kpi/commit/f9f7de35333599d0f1f6be90cf530d85eb12a331))
- Fix uid key name ([5e91f09](https://github.com/kobotoolbox/kpi/commit/5e91f09fb68bf7b8f3a5a8db1789a249e9423621))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.025.37d-RC..2.025.43
<!-- generated by git-cliff -->
