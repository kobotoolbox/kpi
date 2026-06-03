<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (5)</summary>

- **auth**: environment internal endpoint openapi docs ([#6978](https://github.com/kobotoolbox/kpi/pull/6978))
    > <!-- 📣 Summary -->
    > Added `/environment` endpoint to the OpenAPI docs 
    > 
    > <!-- 📖 Description -->
    > Created EnvironmentResponseSerializer (along with SocialAppSerializer
    > and MetadataFieldSerializer) to explicitly type out all configuration
    > properties. Added markdown documentation describing what the endpoint
    > provides. The view get() method was then decorated with @extend_schema
    > to formally document the endpoint using Kobo's standardized
    > open_api_200_ok_response format, and added APIV2Versioning so the V2
    > schema generator picks it up.

- **bulkProcessing**: mark in progress cells ([#7055](https://github.com/kobotoolbox/kpi/pull/7055))
    > <!-- 📣 Summary -->
    > 
    > Marks Project → Data → Table cells as in progress when a bulk action is
    > undergoing. This change is hidden behind a feature flag.

- **dataTable**: add processing columns ([#7065](https://github.com/kobotoolbox/kpi/pull/7065))
    > <!-- 📣 Summary -->
    > 
    > Display transcription/translation columns even if there is no data, but
    > bulk processes are in progress. This change is part of incomplete
    > feature, thus it is hidden behind a feature flag.

- **formSummary**: always display extra metadata fields in summary ([#7070](https://github.com/kobotoolbox/kpi/pull/7070))
    > <!-- 📣 Summary -->
    > Summary now displays extra metadata fields even with the value is null
    > or empty

- **frontend**: create a reflux to react-query (orval) bridge ([#7040](https://github.com/kobotoolbox/kpi/pull/7040))
</details>

<details><summary>Bug Fixes (3)</summary>

- **billing**: use metadata to identify community plan ([#7099](https://github.com/kobotoolbox/kpi/pull/7099))
    > <!-- 📣 Summary -->
    > Adjusts plans page logic to identify only products marked as
    > "default_free_plan" as the default community plan for users without a
    > subscription.

- **frontend**: ensure proper hash navigation in few components ([#6999](https://github.com/kobotoolbox/kpi/pull/6999))
    > <!-- 📣 Summary -->
    > 
    > Clicking the app logo, the "Back to REST Services" button, or the "See
    > plans" link no longer reloads the whole page.

- **languages**: correct Orval-generated types for language services fields and LanguagesListParams ([#7067](https://github.com/kobotoolbox/kpi/pull/7067))
    > <!-- 📣 Summary -->
    > This PR corrects two OpenAPI schema inaccuracies in the language
    > endpoints that caused incorrect Orval-generated TypeScript types for the
    > frontend.
    > 
    > <!-- 📖 Description -->
    > This PR addresses two schema issues reported by the frontend against the
    > language API endpoints.
    > 
    > **Issue 1: Incorrect schema for `transcription_services` /
    > `translation_services` on the retrieve endpoint**
    > 
    > The list (`/api/v2/languages/`) and retrieve
    > (`/api/v2/languages/{code}/`) endpoints return different shapes for the
    > services fields, but both serializers were annotated with the same
    > `@extend_schema_field(ServicesField)`, causing drf-spectacular to emit
    > one schema for both, which matched only the list endpoint. This led
    > Orval to generate an incorrect array type for the retrieve endpoint's
    > response.
    > 
    > This is resolved by introducing a dedicated `ServicesDetailField` marker
    > class and a corresponding `ServicesDetailFieldExtension` that emits the
    > correct nested-object schema (`{ [serviceCode]: { [regionCode]: string }
    > }`).
    > 
    > `LanguageSerializer` (retrieve) is updated to use `ServicesDetailField`,
    > while `LanguageListSerializer` (list) continues to use the existing
    > `ServicesField`.
    > 
    > **Issue 2: Missing `q` query parameter in `LanguagesListParams`**
    > 
    > The `LanguageViewSet` relied on `BaseViewSet`'s `SearchFilter` backend
    > to handle the `q` parameter at runtime, but drf-spectacular requires
    > explicit `OpenApiParameter` declarations to include query params in the
    > schema. As a result, `q` was absent from the generated
    > `LanguagesListParams` type, forcing the frontend to cast hook calls with
    > `as any`. This is resolved by adding an explicit
    > `OpenApiParameter(name='q', ...)` declaration to the `list` action
    > schema, consistent with the pattern already used in
    > `TranscriptionServiceViewSet`.

</details>

<details><summary>Refactor (7)</summary>

- **formLanguagesManager**: improve flaky tests ([#7091](https://github.com/kobotoolbox/kpi/pull/7091))
    > <!-- 📣 Summary -->
    > Improve form language manager Storybook tests

- **frontend**: drop react-debounced-input in favor of mantine based component ([#7019](https://github.com/kobotoolbox/kpi/pull/7019))
- **frontend**: migrate Languages/Translations modal to Mantine and react-query ([#7042](https://github.com/kobotoolbox/kpi/pull/7042))
    > <!-- 📣 Summary -->
    > Migrates the project languages and translations modal interface to Mantine components and react-query

- **languageSelector**: update and replace old language selector ([#7039](https://github.com/kobotoolbox/kpi/pull/7039))
    > <!-- 📣 Summary -->
    > Update old language selector into a new component

- **libraryAssetForm**: remove mixins ([#7068](https://github.com/kobotoolbox/kpi/pull/7068))
- **libraryAssetForm**: migrate to TypeScript ([#7069](https://github.com/kobotoolbox/kpi/pull/7069))
- **regionSelector**: update and replace old region selector ([#7073](https://github.com/kobotoolbox/kpi/pull/7073))
    > <!-- 📣 Summary -->
    > Updates the region selector UI in the automated
    > transcription/translation step

</details>

<details><summary>Chores (1)</summary>

- **api**: [**breaking**] remove all legacy v1 API endpoints ([#7098](https://github.com/kobotoolbox/kpi/pull/7098))
    > <!-- 📣 Summary -->
    > 
    > The legacy `/api/v1/` API has been fully removed. Requests to removed
    > endpoints now receive an HTTP 410 Gone response with a link to the
    > migration guide.
    > 
    > <!-- 📖 Description -->
    > 
    > All remaining `/api/v1/` endpoints have been removed:
    > - `/api/v1/user`, `/api/v1/users`
    > - `/api/v1/notes`
    > - `/api/v1/forms`, `/api/v1/formlist`
    > - `/api/v1/data` (submissions, metadata, media)
    > - `/api/v1/briefcase`
    > - KPI v1 endpoints
    > 
    > Any request to a removed endpoint returns **HTTP 410 Gone** (HTML, JSON,
    > XML depending on `Accept` header) with a link to the migration article:
    > https://support.kobotoolbox.org/migrating_api.html

</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.21..2.026.22
<!-- generated by git-cliff -->
