<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (2)</summary>

- **nlp**: implement Google API US/EU region routing for Speech-to-Text and Translation ([#7128](https://github.com/kobotoolbox/kpi/pull/7128))
    > <!-- 📣 Summary -->
    > This PR implements the server-wide Google ASR/MT location setting to
    > enforce strict EU data residency or utilize global US infrastructure for
    > Speech-to-Text (v2) and Translation (v3) APIs.
    > 
    > <!-- 📖 Description -->
    > Following the parallel switch to Google Cloud Speech-to-Text v2 and
    > Translation v3, the previous ASR/MT region control setting (from
    > ) was no longer functional. This PR re-establishes the
    > server-wide US/EU location toggle and ensures requests are routed to the
    > correct regional or global endpoints based on that configuration.
    > 
    > #### Speech-to-Text (ASR) Updates:
    > - The Google location is dynamically set to `us` or `eu` depending on
    > the server-wide `ASR_MT_GOOGLE_REGION` setting.
    > 
    > #### Translation (MT) Updates:
    > - EU traffic is explicitly routed through the dedicated
    > `translate-eu.googleapis.com` multi-regional gateway and processed in
    > `europe-west1`. This guarantees that TLS termination, processing, and
    > data-in-transit remain entirely within European borders.
    > - US traffic is routed through `translate-us.googleapis.com` +
    > `us-west1`.
    > 
    > #### Constance setting:
    > - Consolidated the legacy `ASR_MT_GOOGLE_TRANSLATION_LOCATION` setting
    > (which tracked granular locations like `us-central1` or `europe-west1`)
    > into a new `ASR_MT_GOOGLE_REGION` Constance setting that provides a
    > straightforward US or EU toggle.
    > 
    > #### Region code fallback fix (pre-existing bug):
    > 
    > - `TranscriptionService.get_language_code()` and `get_configuration()`
    > previously raised `LanguageNotSupported` for any region code not
    > explicitly listed in the database (e.g. `fr-BE`, `de-AT`). The check
    > `language_set.filter(code='fr-BE')` always returned false because
    > `fr-BE` is a region code, not a language code.
    > - Fixed: both methods now extract the parent language code (`fr` from
    > `fr-BE`) as a fallback. If the parent language is supported, the
    > original region code is passed through to Google STT unchanged, allowing
    > it to apply the best available model for that regional variant.

- **nlp**: ensure maximum language support with per-language STT routing and GLOBAL/EU toggle ([#7154](https://github.com/kobotoolbox/kpi/pull/7154))
    > <!-- 📣 Summary -->
    > Extends the Google ASR/MT location handling from
    > [kpi#7128](https://github.com/kobotoolbox/kpi/pull/7128) to support
    > every language Google offers. Instead of a fixed `us`/`eu` endpoint for
    > all languages, the code now routes each language to whichever Google
    > endpoint hosts its best available model. A new `GLOBAL`/`EU` Constance
    > toggle replaces the old `US`/`EU` toggle: `GLOBAL` (default) uses
    > per-language routing for maximum coverage; `EU` restricts all processing
    > to EU-hosted endpoints for data residency compliance.
    > 
    > <!-- 📖 Description -->
    > [kpi#7128](https://github.com/kobotoolbox/kpi/pull/7128) re-implemented
    > the server-wide Google ASR/MT region setting (`ASR_MT_GOOGLE_REGION`)
    > and simplified routing to use a single fixed location: `us` for all
    > languages on non-EU servers and `eu` on EU servers.
    > 
    > However, this caused 24 languages to lose ASR support, languages like
    > Irish, Belarusian, Bosnian, and Somali that only have `chirp_2` model
    > support in specific Google sub-regions (`us-central1`, `europe-west4`)
    > and no model at all in the `us`/`eu` multi-region endpoints.
    > 
    > Because we cannot lose support for these 24 languages, we decided to
    > implement the following approach instead:
    > 1. Global mode (default): Support every language that Google supports by
    > routing each language to the endpoint that provides the best available
    > model.
    > 2. EU mode: Use the best available model within EU-hosted endpoints
    > only. Languages that are not available in any EU endpoint are considered
    > unsupported on EU servers.
    > 
    > In `GLOBAL` mode, the code reads `location_code` per language from the
    > database (populated by the language spreadsheet, which stores the
    > correct global location for each model). In EU mode, the code overrides
    > the DB location at runtime using the table above via
    > `EU_LOCATION_BY_MODEL` in `locations.py`.

</details>

<details><summary>Bug Fixes (2)</summary>

- **assets**: fix deletion of projects with long names ([#7147](https://github.com/kobotoolbox/kpi/pull/7147))
    > <!-- 📣 Summary -->
    > Fixes a bug that was causing errors when users tried to delete a project
    > with a particularly long name.

- **qual**: export qual questions correctly ([#7124](https://github.com/kobotoolbox/kpi/pull/7124))
    > <!-- 📣 Summary -->
    > Fixes the qualitative manual multiple select data export
    > 
    > <!-- 📖 Description -->
    > The one hot data export for manual qualitative multiple select data was
    > [fixed on formpack](https://github.com/kobotoolbox/formpack/pull/347).
    > In `import_export_task.py`, the
    > `SubmissionExportTaskBase.get_export_object` we pass for_output=True
    > down to `get_submissions` in order to resolve the choice UUIDs into
    > their corresponding human-readable labels. We have also added `_uuid`
    > and `meta/rootUuid` to the additional_fields list in
    > `_get_fields_and_groups()` to retrieve the qualitative payload
    > correctly.

</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.21c..2.026.21d
<!-- generated by git-cliff -->
