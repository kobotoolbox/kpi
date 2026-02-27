<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (24)</summary>

- **db**: enforce PostgreSQL timeout per environment and worker type ([#6758](https://github.com/kobotoolbox/kpi/pull/6758))
    > <!-- 📣 Summary -->
    > 
    > Adds a PostgreSQL `statement_timeout` to prevent long-running queries
    > from blocking the database, with separate limits for web requests and
    > Celery workers.

- **massEmails**: exclude trashed users from email lists ([#6615](https://github.com/kobotoolbox/kpi/pull/6615))
    > <!-- 📣 Summary -->
    > Ensure users who cannot log in do not receive emails.
    > 
    > <!-- 📖 Description -->
    > Filter out any user who is already in the trash bin or who has been
    > explicitly set to not active (as distinguished from users who we
    > determine to be inactive by a lack of activity).

- **massEmails**: exclude users who have submitted from inactive emails ([#6618](https://github.com/kobotoolbox/kpi/pull/6618))
    > <!-- 📣 Summary -->
    > Exclude users who have recently made submissions to any project from
    > receiving inactive user emails.
    > 
    > <!-- 📖 Description -->
    > Previously we only counted users as active if they submitted to their
    > own projects, but not projects owned by others.

- **processing**: handle new subsequences API on frontend ([#6657](https://github.com/kobotoolbox/kpi/pull/6657))
- **processing**: handle non-blocking UI for NLP answers ([#6671](https://github.com/kobotoolbox/kpi/pull/6671))
    > <!-- 📣 Summary -->
    > 
    > Allow users to enter QA answers very fast while they are saved in
    > background.

- **processing**: handle "in_progress" status ([#6677](https://github.com/kobotoolbox/kpi/pull/6677))
- **processing**: toast on saving transcripts and translations ([#6681](https://github.com/kobotoolbox/kpi/pull/6681))
- **processing**: handle failure errors ([#6678](https://github.com/kobotoolbox/kpi/pull/6678))
- **qa**: rename qual to manual_qual ([#6555](https://github.com/kobotoolbox/kpi/pull/6555))
    > <!-- 📣 Summary -->
    > Rename the "qual" action to "manual_qual."

- **qual**: show most recently created qual answers instead of most recently accepted ([#6575](https://github.com/kobotoolbox/kpi/pull/6575))
    > <!-- 📣 Summary -->
    > Display the most recent QA answers in the data table and exports rather
    > than the most recently accepted.

- **qual**: add new automatic QA action ([#6567](https://github.com/kobotoolbox/kpi/pull/6567))
    > <!-- 📣 Summary -->
    > Update advanced features API to allow requesting LLM answers to QA
    > questions.
    > 
    > <!-- 📖 Description -->
    > Add a new "automated_chained_qual" action to the advanced features API
    > endpoints. It is currently only a stub and will return canned answers
    > rather than actually hitting an LLM.

- **submissions**: support `rootUuid` as `{id}` parameter for data detail endpoints ([#6660](https://github.com/kobotoolbox/kpi/pull/6660))
    > <!-- 📣 Summary -->
    > Allow data detail endpoints to be accessed using rootUuid as the primary
    > identifier.
    > 
    > ### Description
    > This feature adds support for using `rootUuid` as the `{id} parameter
    > when accessing data detail endpoints. This makes it possible to retrieve
    > a submission directly by its root UUID. The change improves flexibility
    > and consistency when working with submission identifiers, without
    > altering existing behavior for clients that continue to use the original
    > primary key format.

- **subsequences**: add model and new endpoints for advanced actions ([#6492](https://github.com/kobotoolbox/kpi/pull/6492))
- **subsequences**: show supplemental columns in data table ([#6523](https://github.com/kobotoolbox/kpi/pull/6523))
    > <!-- 📣 Summary -->
    > Add supplemental NLP columns to data table.
    > 
    > <!-- 📖 Description -->
    > This is just for adding the columns to the data table. They may not be
    > populated correctly. If an NLP action is enabled, there will be a column
    > for it, even if there are presently no responses.

- **subsequences**: stop using _advanced_features field ([#6503](https://github.com/kobotoolbox/kpi/pull/6503))
- **subsequences**: implement `get_output_fields` and `transform_data_for_output` for `QualAction` ([#6504](https://github.com/kobotoolbox/kpi/pull/6504))
    > <!-- 📣 Summary -->
    > Add implementation of `get_output_fields()` and
    > `transform_data_for_output()` in `QualAction`.
    > 
    > <!-- 📖 Description -->
    > This update enables qualitative analysis results to appear correctly in
    > exports or the table view.
    > The new logic:
    > - Defines the output fields for each qualitative question (including
    > labels, types, and choices).
    > - Converts stored qualitative results into export-ready values,
    > including expanding choice UUIDs into readable label objects.

- **subsequences**: migrate old advanced_features ([#6545](https://github.com/kobotoolbox/kpi/pull/6545))
- **subsequences**: migrate old SubmissionExtras to SubmissionSupplemental ([#6422](https://github.com/kobotoolbox/kpi/pull/6422))
- **subsequences**: allow hiding of QA questions ([#6550](https://github.com/kobotoolbox/kpi/pull/6550))
- **subsequences**: add OpenAPI schema for advanded features ([#6547](https://github.com/kobotoolbox/kpi/pull/6547))
    > <!-- 📣 Summary -->
    > Add OpenAPI schema for the `/api/v2/assets/{uid_asset}/advanced-features/` endpoint.
    > 
    > <!-- 📖 Description -->
    > The API schema output files and the generated Orval types have been
    > updated with the schema details for the action parameters in the
    > `QuestionAdvancedFeature` model.

- **subsequences**: show again in formpack exports ([#6561](https://github.com/kobotoolbox/kpi/pull/6561))
- **subsequences**: do not allow users to un-accept automatic NLP responses ([#6628](https://github.com/kobotoolbox/kpi/pull/6628))
    > <!-- 📣 Summary -->
    > Do not allow users to un-accept an automatic NLP response.

- **subsequences**: add `locale` field to NLP actions documentation ([#6620](https://github.com/kobotoolbox/kpi/pull/6620))
    > <!-- 📣 Summary -->
    > Updated the API documentation to explicitly include the `locale`
    > parameter for NLP actions.

- **subsequences**: do not allow translation of deleted transcripts ([#6649](https://github.com/kobotoolbox/kpi/pull/6649))
    > <!-- 📖 Description -->
    > This PR implements a new validation rule within the subsequence
    > processing flow. It ensures that a translation action cannot proceed if
    > its source transcription (Manual or Automatic) has been explicitly
    > deleted, regardless of whether a previously accepted version exists in
    > the history.

</details>

<details><summary>Bug Fixes (71)</summary>

- **ci**: pin pip<25.3 to restore compatibility with pip-tools 7.x ([#6435](https://github.com/kobotoolbox/kpi/pull/6435))
    > <!-- 📣 Summary -->
    > Fixes a CI installation issue caused by an incompatibility between `pip` 25.3 and `pip-tools` 7.x.

- **datacollectors**: remove links on group delete ([#6650](https://github.com/kobotoolbox/kpi/pull/6650))
- **dev**: fix formpack version in dependencies files ([#6616](https://github.com/kobotoolbox/kpi/pull/6616))
    > <!-- 📣 Summary -->
    > Ran pip-compile script to update the formpack version to the latest
    > commit

- **drawer**: icon size ([#6654](https://github.com/kobotoolbox/kpi/pull/6654))
- **formbuilder**: update tooltips under some formbuilder buttons ([#6582](https://github.com/kobotoolbox/kpi/pull/6582))
    > <!-- 📣 Summary -->
    > Formbuilder header buttons had some incorrect tooltip, this PR updates
    > them to at least be relevant to the button they're associated with

- **frontend**: ensure useOrganizationAssumed assumption holds ([#6608](https://github.com/kobotoolbox/kpi/pull/6608))
    > <!-- 📣 Summary -->
    > 
    > Don't sometimes crash the website at the data table route.

- **hub**: [**breaking**] fix hub merge conflict ([#6687](https://github.com/kobotoolbox/kpi/pull/6687))
    > <!-- 📣 Summary -->
    > Fixes a migration conflict in the hub app

- **languages**: unauthorize languages endpoint ([#6699](https://github.com/kobotoolbox/kpi/pull/6699))
    > <!-- 📣 Summary -->
    > Allow anonymous users to access the languages endpoint

- **migration**: prevent OOM crashes and race conditions in long running migrations ([#6720](https://github.com/kobotoolbox/kpi/pull/6720))
- **openAPI**: improve schema for assets list response ([#6622](https://github.com/kobotoolbox/kpi/pull/6622))
- **openApi**: use proper query param name ([#6664](https://github.com/kobotoolbox/kpi/pull/6664))
- **openapi**: fix advancedfeaturesresponse schema ([#6624](https://github.com/kobotoolbox/kpi/pull/6624))
- **openapi**: advanced feature response action prop should be an enum ([#6626](https://github.com/kobotoolbox/kpi/pull/6626))
- **openapi**: allow nullable `value` for transcription and translation in DataSupplementPayload ([#6629](https://github.com/kobotoolbox/kpi/pull/6629))
- **openapi**: update `DataSupplementResponse` to use manual_qual ([#6634](https://github.com/kobotoolbox/kpi/pull/6634))
- **openapi**: fix nested array in advanced features response ([#6635](https://github.com/kobotoolbox/kpi/pull/6635))
- **openapi**: fix dataresponse schema ([#6625](https://github.com/kobotoolbox/kpi/pull/6625))
- **openapi**: add query parameter to AssetsDataListParams ([#6639](https://github.com/kobotoolbox/kpi/pull/6639))
- **openapi**: update qual to be manual_qual in all of the subsequences schema ([#6637](https://github.com/kobotoolbox/kpi/pull/6637))
- **openapi**: add and explain deleted option ([#6636](https://github.com/kobotoolbox/kpi/pull/6636))
- **openapi**: openapi qual params missing option ([#6645](https://github.com/kobotoolbox/kpi/pull/6645))
- **openapi**: update `/api/v2/advanced-features` PATCH API schema ([#6642](https://github.com/kobotoolbox/kpi/pull/6642))
    > <!-- 📣 Summary -->
    > Add `action` and `question_xpath` to the advanced-features PATCH API
    > OpenAPI schema.

- **openapi**: fix data supplement response qualitative items data schema ([#6640](https://github.com/kobotoolbox/kpi/pull/6640))
- **organizations**: add long-running migration to remove organizations owned by deleted users ([#6751](https://github.com/kobotoolbox/kpi/pull/6751))
    > <!-- 📣 Summary -->
    > Added a long-running migration task to remove empty organizations that
    > were left behind by permanently deleted users.
    > 
    > <!-- 📖 Description -->
    > Previously, an issue caused empty organizations to remain in the system
    > after an account was permanently deleted. Following the resolution of
    > that issue, a background cleanup process has been introduced to safely
    > remove those older, orphaned organizations. This process ensures that
    > only organizations with no active members are deleted, keeping the
    > system clean and running efficiently.

- **processing**: optimistically update automated transx ([#6662](https://github.com/kobotoolbox/kpi/pull/6662))
- **processing**: assorted tiny polish and code cleanup ([#6663](https://github.com/kobotoolbox/kpi/pull/6663))
- **processing**: deselect qa question after acting on it ([#6666](https://github.com/kobotoolbox/kpi/pull/6666))
- **processing**: saving indicator in analysis tab ([#6670](https://github.com/kobotoolbox/kpi/pull/6670))
- **processing**: prev/next arrows for edited submissions ([#6672](https://github.com/kobotoolbox/kpi/pull/6672))
- **processing**: preselect latest translation (automatic or manual) ([#6668](https://github.com/kobotoolbox/kpi/pull/6668))
- **processing**: prefix "generated" to dates correctly ([#6673](https://github.com/kobotoolbox/kpi/pull/6673))
- **processing**: confirm on deleting transcript/translation ([#6674](https://github.com/kobotoolbox/kpi/pull/6674))
- **processing**: uuid prefix messed up caching keys ([#6675](https://github.com/kobotoolbox/kpi/pull/6675))
- **processing**: isMutating count includes itself ([#6676](https://github.com/kobotoolbox/kpi/pull/6676))
- **processing**: update audio player source when media url change ([#6682](https://github.com/kobotoolbox/kpi/pull/6682))
- **processing**: type error on analysis tab ([#6683](https://github.com/kobotoolbox/kpi/pull/6683))
- **processing**: display _dateAccepted timestamp if present ([#6684](https://github.com/kobotoolbox/kpi/pull/6684))
- **processing**: avoid a flicker in translation tab ([#6688](https://github.com/kobotoolbox/kpi/pull/6688))
- **processing**: disable edit button for anonymous users ([#6695](https://github.com/kobotoolbox/kpi/pull/6695))
- **processing**: don't flicker auto transcribe approval ([#6694](https://github.com/kobotoolbox/kpi/pull/6694))
- **qual**: prevent overriding answers with failures ([#6583](https://github.com/kobotoolbox/kpi/pull/6583))
    > <!-- 📣 Summary -->
    > Prevent LLM failures from overriding existing QA answers.

- **sidebar**: settings styling and options sorting ([#6696](https://github.com/kobotoolbox/kpi/pull/6696))
- **style**: better disable state for NumberInput, RadioInput and TagsInput ([#6698](https://github.com/kobotoolbox/kpi/pull/6698))
- **subsequences**: return schema if not migrated ([7299c28](https://github.com/kobotoolbox/kpi/commit/7299c28fe6a4bdfe0f4d2ea8ad57497bf9ed72e3))
- **subsequences**: fix nlp actions in data table ([#6530](https://github.com/kobotoolbox/kpi/pull/6530))
    > <!-- 📣 Summary -->
    > Ensure transcriptions and translations are displayed in the data table.
    > 
    > <!-- 📖 Description -->
    > Only accepted transcriptions/translations will be displayed.

- **subsequences**: better error from creation of features with incorrect params ([#6548](https://github.com/kobotoolbox/kpi/pull/6548))
    > <!-- 📣 Summary -->
    > Validate `params` before creating new advanced features.

- **subsequences**: update background processing to support new `_data` structure ([#6549](https://github.com/kobotoolbox/kpi/pull/6549))
    > <!-- 📣 Summary -->
    > Restore background and NLP processing by reading values from the new
    > `_data` field.
    > 
    > <!-- 📖 Description -->
    > This fix updates the background processing logic to support the new data
    > structure where value, language, and status (when present) are now
    > nested under a `_data` dictionary. Some automated NLP actions were
    > broken because they were still looking for these fields at the top
    > level, where they can no longer exist.

- **subsequences**: generate accurate OpenAPI schemas ([#6535](https://github.com/kobotoolbox/kpi/pull/6535))
- **subsequences**: avoid setting `_dateAccepted` when deleting an action result ([#6551](https://github.com/kobotoolbox/kpi/pull/6551))
    > <!-- 📣 Summary -->
    > Prevent `_dateAccepted` from being added during deletion of an action
    > result.
    > 
    > <!-- 📖 Description -->
    > This fix corrects the subsequences logic so that `_dateAccepted` is not
    > set when an action result is deleted. Previously, the deletion path
    > could incorrectly mark the result as accepted by adding `_dateAccepted`,
    > which conflicted with the intended semantics of a removal. The updated
    > behavior ensures that deletion strictly removes the result without
    > recording any acceptance metadata, keeping action histories consistent
    > and accurate.
    > 
    > ### Preview Steps
    > 
    > Use the snippet provided in the linear task description. 
    > Try it with `refactor-subsequences-2025` and see ` _dateAccepted` is
    > added to the version.
    > With this PR is not present. 
    > You can try other actions (`manual_translation`, `automatic_*` and
    > `qual`) and get the same results.

- **subsequences**: remove SubsequencesExtras reference and rename model ([#6584](https://github.com/kobotoolbox/kpi/pull/6584))
    > <!-- 📣 Summary -->
    > Remove SubsequencesExtras reference and rename model

- **subsequences**: fix 500 error when value is missing in supplement data ([#6611](https://github.com/kobotoolbox/kpi/pull/6611))
    > <!-- 📣 Summary -->
    > Fix to gracefully handle missing value fields in failed
    > transcription/translation entries instead of crashing with a 500 error
    > when loading the data API endpoint

- **subsequences**: return consistent _supplementData for list and detail endpoints ([#6617](https://github.com/kobotoolbox/kpi/pull/6617))
- **subsequences**: fix OpenAPI schemas with dynamic properties ([#6614](https://github.com/kobotoolbox/kpi/pull/6614))
- **subsequences**: throw error when deleting a null value in supplement API ([#6607](https://github.com/kobotoolbox/kpi/pull/6607))
    > <!-- 📣 Summary -->
    > This PR adds validation to prevent setting value: null on non-existent
    > transcriptions and translations in the submission supplement API.

- **subsequences**: fix data attachment schema ([#6623](https://github.com/kobotoolbox/kpi/pull/6623))
- **subsequences**: ensure deleted actions are removed from _supplementalDetails in data endpoint ([#6619](https://github.com/kobotoolbox/kpi/pull/6619))
    > <!-- 📣 Summary -->
    > Fix inconsistency where deleted actions were still visible in
    > `_supplementalDetails`.
    > 
    > <!-- 📖 Description -->
    > This fix addresses an inconsistency in the data endpoint where deleting
    > an action did not fully remove it from the `_supplementalDetails`
    > property. As a result, clients could still see stale action data even
    > after the action was deleted. The cleanup logic has been corrected so
    > that deletions are properly reflected everywhere the supplement data is
    > exposed, ensuring the data endpoint always returns an accurate and
    > up-to-date view.
    > 
    > Note this PR does not handle the case where the user requests a
    > translation after deleting a transcription. Right now it will send off
    > an empty string for translation. This will be addressed in a future PR
    > (see in Linear)

- **subsequences**: require default in labels ([#6632](https://github.com/kobotoolbox/kpi/pull/6632))
- **subsequences**: [**breaking**] enforce UUID format in JSON Schema validation ([#6641](https://github.com/kobotoolbox/kpi/pull/6641))
    > <!-- 📣 Summary -->
    > Validate subsequence identifiers strictly as UUIDs to prevent invalid
    > data from being accepted
    > 
    > <!-- 📖 Description -->
    > This change enforces proper UUID format validation in the JSON Schema
    > used by subsequences. Previously, invalid or malformed identifiers could
    > pass validation, leading to inconsistent data

- **subsequences**: exclude XML content-type for Orval while preserving dual schemas for Swagger UI ([#6656](https://github.com/kobotoolbox/kpi/pull/6656))
    > <!-- 📣 Summary -->
    > Keep both JSON and XML schemas in OpenAPI for documentation, but ensure
    > Orval generates types from the JSON schema only.

- **subsequences**: neighboring submission query same-time handling ([#6651](https://github.com/kobotoolbox/kpi/pull/6651))
    > <!-- 📣 Summary -->
    > Ensures users can navigate all submissions in processing view even if
    > submissions have same submission time.

- **subsequences**: typo in URLs ([d9f50f6](https://github.com/kobotoolbox/kpi/commit/d9f50f6a0b7495dda8fd0a1ffa7974833e4541aa))
- **subsequences**: fix translation blocking to allow transcript replacement ([#6686](https://github.com/kobotoolbox/kpi/pull/6686))
    > <!-- 📣 Summary -->
    > Prevents new translations from being created when a transcript has been
    > deleted, while ensuring they remain available if a new transcript is
    > provided later.
    > 
    > <!-- 📖 Description -->
    > This PR introduces a robust validation rule for transcriptions and
    > translations to ensure that deleted data is never accidentally used for
    > new translations.
    > 
    > The system now utilizes a timestamp based arbitration logic. It compares
    > the most recent time a transcript was deleted against the most recent
    > time a transcript was accepted across all sources (Manual or Automatic).
    > - If the latest event is a deletion: The system considers the question
    > to have no valid transcript and will block any new translation requests.
    > - If the latest event is an acceptance: Even if a deletion occurred
    > previously, the system recognizes that the data has been replaced and
    > allows translations to proceed normally using the newest valid text.
    > 
    > This ensures data integrity by preventing the use of ghost transcripts
    > while maintaining a flexible workflow for users who need to delete or
    > re-transcribe their audio.

- **subsequences**: fix null bucket name infinite processing ([#6697](https://github.com/kobotoolbox/kpi/pull/6697))
    > <!-- 📖 Description -->
    > This PR fixes an issue where automatic transcription and translation
    > subsequences could remain indefinitely in the "in_progress" state when
    > `GS_BUCKET_NAME` was not configured.
    > 
    > The backend now detects missing Google Cloud Storage configuration early
    > and returns a clear failed status instead of triggering async processing
    > and background polling. This prevents infinite retries caused by
    > configuration errors and makes failures explicit and actionable.

- **translations**: flicker on translation operations ([#6693](https://github.com/kobotoolbox/kpi/pull/6693))
- **usage**: remove misleading "last update" text ([#6665](https://github.com/kobotoolbox/kpi/pull/6665))
    > <!-- 📣 Summary -->
    > 
    > Remove misleading "Last update: <time>" text from usage page.

- align migrations with production state (mostly no-op) ([#6598](https://github.com/kobotoolbox/kpi/pull/6598))
- fix supplement unit tests ([7e601f7](https://github.com/kobotoolbox/kpi/commit/7e601f741d242a3c9f8c02a030535238616a945e))
- linter ([19e1d0f](https://github.com/kobotoolbox/kpi/commit/19e1d0f7ebfbe2ede804f80b583d0c9926be0f03))
- fix merge artifacts ([038fa91](https://github.com/kobotoolbox/kpi/commit/038fa91a77e825b9f78321756910af740bc5875d))
- do not create asset version where migrating advanced features schema ([3857c71](https://github.com/kobotoolbox/kpi/commit/3857c718ed7eccefe97dd835577a2ec9e6f4b4c6))
- fix sidebar displays not filtering out transcript ([72953b3](https://github.com/kobotoolbox/kpi/commit/72953b360585132cfa7ebc5607c7cfd91bd6db10))
</details>

<details><summary>Documentation (2)</summary>

- **openApi**: explain workaround and link Orval issue ([#6554](https://github.com/kobotoolbox/kpi/pull/6554))
- **subsequences**: update README and API docs ([#6658](https://github.com/kobotoolbox/kpi/pull/6658))
    > <!-- 📣 Summary -->
    > Improve documentation of advanced features.

</details>

<details><summary>Build & Dependencies (1)</summary>

- **docker**: build node app in a separate docker build stage ([#6498](https://github.com/kobotoolbox/kpi/pull/6498))
</details>

<details><summary>Testing (3)</summary>

- **subsequences**: fix broken unit tests ([#6491](https://github.com/kobotoolbox/kpi/pull/6491))
- **subsequences**: port old unit tests ([#6448](https://github.com/kobotoolbox/kpi/pull/6448))
- **subsequences**: replace hardcoded UUIDs with named constants ([#6646](https://github.com/kobotoolbox/kpi/pull/6646))
</details>

<details><summary>Security (2)</summary>

- **deps**: bump lodash from 4.17.21 to 4.17.23 in the minor-and-patch group across 1 directory ([#6652](https://github.com/kobotoolbox/kpi/pull/6652))
- **deps-dev**: bump webpack from 5.101.3 to 5.105.0 in the minor-and-patch group across 1 directory ([#6700](https://github.com/kobotoolbox/kpi/pull/6700))
</details>

<details><summary>Refactor (10)</summary>

- **addOns**: decouple addOns from plans page ([#6574](https://github.com/kobotoolbox/kpi/pull/6574))
- **dataCollectors**: cleanup ([#6612](https://github.com/kobotoolbox/kpi/pull/6612))
- **drawer**: remove dead code and migrate to TS ([#6601](https://github.com/kobotoolbox/kpi/pull/6601))
    > ### 🗒️ Checklist
    > 
    > 1. [x] run linter locally
    > 2. [x] update developer docs (API, README, inline, etc.), if any
    > 3. [x] for user-facing doc changes create a Zulip thread at `#Support
    > Docs Updates`, if any
    > 4. [x] draft PR with a title `<type>(<scope>)<!>: <title> `
    > 5. [x] assign yourself, tag PR: at least `Front end` and/or `Back end`
    > or `workflow`
    > 6. [x] fill in the template below and delete template comments
    > 7. [x] review thyself: read the diff and repro the preview as written
    > 8. [x] open PR & confirm that CI passes & request reviewers, if needed
    > 9. [ ] delete this section before merging
    > 
    > <!-- 📣 Summary -->
    > 
    > Internal code cleanup around the left Sidebar.

- **formBuilder**: migrate editableForm and connected files to TypeScript ([#6588](https://github.com/kobotoolbox/kpi/pull/6588))
    > <!-- 📣 Summary -->
    > 
    > Internal refactor of piece(s) of code that connects Form Builder
    > (Backbone x CoffeeScript app) with the rest of the UI (React x
    > JavaScript x TypeScript app).

- **hooks**: remove verbose info logs from send method ([#6754](https://github.com/kobotoolbox/kpi/pull/6754))
    > <!-- 📣 Summary -->
    > 
    > Removes three verbose `logging.info` calls from the REST service hook
    > send method that were logging hook/submission processing steps at info
    > level.

- **qual**: rename automatic qual action ([#6593](https://github.com/kobotoolbox/kpi/pull/6593))
- **subsequences**: rename "automated" to "automatic" ([#6446](https://github.com/kobotoolbox/kpi/pull/6446))
- **subsequences**: update advanced features to use `UniqueConstraint` ([#6534](https://github.com/kobotoolbox/kpi/pull/6534))
- **subsequences**: refactor data table for consistency ([#6559](https://github.com/kobotoolbox/kpi/pull/6559))
    > <!-- 📣 Summary -->
    > Updates the /data endpoint to return the answers to QA questions in a
    > different format.

- **subsequences**: [**breaking**] clean up codebase, restructure API, and improve backend logic ([#6511](https://github.com/kobotoolbox/kpi/pull/6511))
    > <!-- 📣 Summary -->
    > This PR cleans up the subsequences codebase by removing unused/broken
    > code, restructuring the API with better endpoints, simplifying backend
    > logic, updating the frontend to use the new API structure, and adding
    > comprehensive documentation.
    > 
    > <!-- 📖 Description -->
    > This comprehensive refactoring addresses multiple aspects of the
    > subsequences system to improve code quality, API design, and overall
    > maintainability. The primary focus has been on cleaning up accumulated
    > technical debt while modernizing the architecture for better long-term
    > sustainability.
    > 
    > **Code Cleanup and Backend Simplification**
    > 
    > The refactoring begins with a thorough cleanup of the subsequences
    > codebase, removing significant amounts of dead code, unused functions,
    > and broken implementations that were no longer serving any purpose.
    > Complex backend logic has been simplified and streamlined, reducing
    > unnecessary complexity in data processing workflows. The code quality
    > improvements include better type annotations, enhanced error handling,
    > and improved maintainability patterns throughout the entire module.
    > 
    > **Frontend Integration and User Experience**
    > 
    > The frontend components have been thoroughly updated to integrate
    > seamlessly with the restructured API endpoints, ensuring that users
    > experience no disruption in functionality while benefiting from improved
    > performance. The processing workflows for transcription, translation,
    > and qualitative analysis have been enhanced with better error handling
    > and more informative user feedback.
    > 
    > **Documentation and Migration Support**
    > 
    > A comprehensive README has been added to the subsequences module,
    > providing detailed documentation about the new API structure, usage
    > patterns, and clear guidelines for developers. The documentation
    > includes a complete API reference with accurate parameter descriptions
    > and response formats, along with practical examples showing how to
    > transition from old to new endpoints. This documentation serves as both
    > a reference for current development and a guide for external integrators
    > who need to update their implementations.

</details>

<details><summary>Styling (3)</summary>

- **subsequences**: linter ([#6586](https://github.com/kobotoolbox/kpi/pull/6586)) 
- **subsequences**: fix darker ([#6647](https://github.com/kobotoolbox/kpi/pull/6647))
- linter ([74bb1be](https://github.com/kobotoolbox/kpi/commit/74bb1be9b6c59d2de9813ef48c83be825fb9f2b2))
</details>

<details><summary>Chores (1)</summary>

- **mfa**: skip unit test about mfa and token authentication ([#6759](https://github.com/kobotoolbox/kpi/pull/6759))
</details>

<details><summary>Revert (3)</summary>

- revert mistakenly committed hack ([06d7213](https://github.com/kobotoolbox/kpi/commit/06d72134078001381484855155ca32ad5b4bfb50))
- revert "fix(qual): prevent overriding answers with failures " ([#6590](https://github.com/kobotoolbox/kpi/pull/6590))
- revert "Revert "fix(qual): prevent overriding answers with failures "" ([#6592](https://github.com/kobotoolbox/kpi/pull/6592))
</details>

<details><summary>Other (113)</summary>

- Make NumberDoubler action class work ([3a6d582](https://github.com/kobotoolbox/kpi/commit/3a6d5822dcdb5e067d497fbfdec25346276f365b))
- send number_doubler to formpack in super hacky way ([23d3b22](https://github.com/kobotoolbox/kpi/commit/23d3b22e15e21b848803c0df56f6da9941295aea))
- Add WIP edits to subsequences README ([b8eb530](https://github.com/kobotoolbox/kpi/commit/b8eb530f710196c7e4083814ca1d642257f0a7fc))
- yay ([fba697e](https://github.com/kobotoolbox/kpi/commit/fba697e90052a49fe6c0510f31c63010ab8cbf24))
- wip ([678e8ec](https://github.com/kobotoolbox/kpi/commit/678e8ec1db563e27a523c4678b4b0a54e83f3f8b))
- Make unit tests pass again after merging `main` ([6f1a982](https://github.com/kobotoolbox/kpi/commit/6f1a98269d855eca7e42a5534993d612f4598016))
- Add grievances to README.md ([91ad964](https://github.com/kobotoolbox/kpi/commit/91ad964098856729fb742195e5587e3b22b25ea1))
- Start drafting new README based on what we want

…and with less tiptoeing around what's already there ([24a07b4](https://github.com/kobotoolbox/kpi/commit/24a07b4afa7f519010d6484ee57204e746019f91))
- Begin rewriting manual transcription action ([3421691](https://github.com/kobotoolbox/kpi/commit/3421691f1d185dfce2546eae0408d286c46cae9a))
- Continue rewriting manual transcription action ([5cd5896](https://github.com/kobotoolbox/kpi/commit/5cd5896ace322c475edf73bee817c0afc6444e83))
- Create fresh `subsequences` directory, and move…

previous work to `subsequences__old` ([4b85d2f](https://github.com/kobotoolbox/kpi/commit/4b85d2fd86048b9fcf95e0db3220a85288a3dad4))
- Remove unused `load_params()` ([5091c64](https://github.com/kobotoolbox/kpi/commit/5091c6421d9d2bf362b30c9b9d80ddc227efd7af))
- Add preliminary manual transcription tests ([81d4d6c](https://github.com/kobotoolbox/kpi/commit/81d4d6cedbed1b532deda052c0cb668fb4858431))
- Move new work to subsequence__new instead, restore previous Django app ([7d53d2a](https://github.com/kobotoolbox/kpi/commit/7d53d2a9c78cb074244faa64f3277dd25e7200f3))
- Update revise_field to support new structure ([249abad](https://github.com/kobotoolbox/kpi/commit/249abadad474d9b7319cc71a6e501ec8e7c02f5e))
- More manual transcription tests, tweaks to `revise_field` ([dc067cc](https://github.com/kobotoolbox/kpi/commit/dc067cc753d483d06cbeabe84943ad35e0f368cf))
- typo ([4bfdc04](https://github.com/kobotoolbox/kpi/commit/4bfdc04aedb7e0209b0d515fabc7c5a3c0fc6eba))
- wip ([aaa17f1](https://github.com/kobotoolbox/kpi/commit/aaa17f1ce1feab5d380da9560f0b454db6772d10))
- Use data schema to build result schema ([c03ee57](https://github.com/kobotoolbox/kpi/commit/c03ee570a6917358ff3a62a0c06e8daabe1ddf9c))
- Make result schema more dynamic ([9f51715](https://github.com/kobotoolbox/kpi/commit/9f51715da2a5a05666b4a00d8b3e197526947cba))
- more ([36e864b](https://github.com/kobotoolbox/kpi/commit/36e864b4bb4f1106f37917ab4c7a9c5d5c3d99d9))
- even more ([e82b0ec](https://github.com/kobotoolbox/kpi/commit/e82b0ec80827b86fae8d0e0e318da4336832f454))
- Comment out timezone detection in "utc_datetime_to_simplified_iso8601" ([5602de6](https://github.com/kobotoolbox/kpi/commit/5602de64653d71bf210570050a125fdd5c0b4cdd))
- Move result_schema to base class ([ac0ae75](https://github.com/kobotoolbox/kpi/commit/ac0ae7557acaca09ce2f1eb01841b39a716289ce))
- clean ([24cfa0d](https://github.com/kobotoolbox/kpi/commit/24cfa0d7659a27a49c4e161481f69a24a53acb54))
- add example data for manual translations ([9b012f7](https://github.com/kobotoolbox/kpi/commit/9b012f7da143f1daff142286c2a5f9b767c682bf))
- Add stripped-down SubmissionExtras model ([97a5b7e](https://github.com/kobotoolbox/kpi/commit/97a5b7e04fe22d06e3d9dc8ddad09512ef0cd9ab))
- WIP new viewset ([17ea9e2](https://github.com/kobotoolbox/kpi/commit/17ea9e2c4eb0c1219d53d1e6bea5d37202c658b1))
- add subsequences router thing to process incoming…

data for actions. doesn't do much yet, though, because you can't save a
useful `advanced_schema` into any asset because of the outdated
`ADVANCED_FEATURES_PARAMS_SCHEMA` ([2f5c531](https://github.com/kobotoolbox/kpi/commit/2f5c53104372cb5461fb3540eb731b9fdd1384f8))
- note that submission uuid will be removed from POST data ([c2ed328](https://github.com/kobotoolbox/kpi/commit/c2ed3280e0af8bd6143b971c803f2a916844aec8))
- PoC action-generated asset-level params schema…

and saving action data into (for now) the old SubmissionExtras model ([371801a](https://github.com/kobotoolbox/kpi/commit/371801add6128b30e6cdc557583b868f818a83b7))
- Make result_schema an abstract method ([8772830](https://github.com/kobotoolbox/kpi/commit/8772830338a6860f014975ce395cb1ec139d4996))
- Add usage limit check to action class ([91628ca](https://github.com/kobotoolbox/kpi/commit/91628ca9ed5d7ddd9eb90b97aa95cf1921c0ddec))
- Add comments ([36f1449](https://github.com/kobotoolbox/kpi/commit/36f1449c9744de36aced9aea91e83a98df3a59d5))
- More comments ([7fe16c5](https://github.com/kobotoolbox/kpi/commit/7fe16c5510fb534e99304672e412afb34bde4cad))
- WIP new endpoint ([3f79f0e](https://github.com/kobotoolbox/kpi/commit/3f79f0e200b0e0e1bae592146db97bfde77dcb07))
- add forgotten base.py ([7529ada](https://github.com/kobotoolbox/kpi/commit/7529adaf5a2c398fcc7045f8b276e024e72ed8f4))
- continue cleanup from forgetting to add base.py ([e28efb2](https://github.com/kobotoolbox/kpi/commit/e28efb2342ec55b18c6cae9b8dc2a0f7251045cf))
- rename `_schema` to `_actionConfigs`; expect…

`submission_uuid` as argument from nested view instead of POST data ([36ecc7b](https://github.com/kobotoolbox/kpi/commit/36ecc7bf9120c2d4253a8f27f5d193ae185015c2))
- add method for retrieving supplemental data at…

the submission level, and fix method for storing it ([c8a9c65](https://github.com/kobotoolbox/kpi/commit/c8a9c65bb194f1843fab3f765c6fba42fc7a6c8d))
- Add submission arg to tests for `revise_field()` ([7ef30fb](https://github.com/kobotoolbox/kpi/commit/7ef30fb95b910bb62961687b8320548316dcbf4e))
- Replace the lookup field of data endpoint with "submission_id_or_root_uuid" ([01248d1](https://github.com/kobotoolbox/kpi/commit/01248d1251cc4559b7b02af81fc96ee11b1d5862))
- Fix `handle_incoming_data()`, again… ([121341a](https://github.com/kobotoolbox/kpi/commit/121341a2a152f9c1733fb28ebded549da2741c07))
- Make `handle_incoming_data()` return something, …

effectively the same thing as if `retrieve_supplemental_data()` were
called immediately afterwards ([6289e4a](https://github.com/kobotoolbox/kpi/commit/6289e4a6b4a19daf14a98b6d9b982012fa2c0ef3))
- Draft documentation ([8561cda](https://github.com/kobotoolbox/kpi/commit/8561cda327b794b79ddbce99117c124b2b3d9b0e))
- Validate the entire submission supplement ([5a303b5](https://github.com/kobotoolbox/kpi/commit/5a303b57581d3bc0277dc25bd7aac2781a0548a6))
- Add forgotten file…again ([0eef859](https://github.com/kobotoolbox/kpi/commit/0eef8596c8d5424b1b595e69e4d145201b299813))
- Draft data supplement endpoint documentation ([5d65175](https://github.com/kobotoolbox/kpi/commit/5d6517557e56733e687fb6545be9973d2c1a68aa))
- Refactor 'routers' logic into new proxy model ([598b000](https://github.com/kobotoolbox/kpi/commit/598b00049e13c242dfe959bd2e742b71a27f2b3a))
- Update exceptions import ([fe9811d](https://github.com/kobotoolbox/kpi/commit/fe9811d021f33fc5afb636770c7db2df179b8229))
- Warn about deprecation; clean a few things ([178589b](https://github.com/kobotoolbox/kpi/commit/178589b3f607f087dc98bc288ac8c310f79592fc))
- add drf-spectular schema and documentation ([54daa42](https://github.com/kobotoolbox/kpi/commit/54daa42037046719f2c6ee2cda543c62c89fe8c4))
- Replace "transcript" with "value" to be consistent with other actions ([976e7b5](https://github.com/kobotoolbox/kpi/commit/976e7b52a8b4fb8e85fc2d51c609c64f2cd476be))
- Draft manual_translation ([2ee23e2](https://github.com/kobotoolbox/kpi/commit/2ee23e20664a2ed1e9f27d5872b8fafd4d6ddfd5))
- Make BaseAction.revise_data support lists ([3f701bb](https://github.com/kobotoolbox/kpi/commit/3f701bbd3d3d7f3cd789140a6046eb484f49e47f))
- Make SubmissionSupplement.revise_data support lists ([9d9e46d](https://github.com/kobotoolbox/kpi/commit/9d9e46d2ce95e060c86d91e930a8662a8fdc2a5f))
- Shuffle ([fa636b8](https://github.com/kobotoolbox/kpi/commit/fa636b829d252cbda64b836bbc0877ffc3b5457a))
- Rename subsequences to subsequences__old and…

subsequences__new to subsequences ([8787be2](https://github.com/kobotoolbox/kpi/commit/8787be258ae38ad32c4d5fe8c814943949462a57))
- Rip out old subsequences references ([725d15d](https://github.com/kobotoolbox/kpi/commit/725d15d094f5a8b2583e8174fd17e600c518933d))
- Get data API working minimally ([ba36142](https://github.com/kobotoolbox/kpi/commit/ba361423cb420be8b3aabd596e80e9b66aa3b365))
- Take teeny, tiny step toward reconnecting formpack ([122e0d3](https://github.com/kobotoolbox/kpi/commit/122e0d343fcf0fbbf94fba095be2d9ee6bcd8092))
- Clean up ([8f39d01](https://github.com/kobotoolbox/kpi/commit/8f39d0166a7b2c05ef2e3012bf65583484eace35))
- Lint and format ([d73dd89](https://github.com/kobotoolbox/kpi/commit/d73dd89bfd870bf388577449cea1056b351b8f8f))
- Stop mutating incoming data ([4612f4c](https://github.com/kobotoolbox/kpi/commit/4612f4c1206252a6eacb7613b6e3c3b4a40d0655))
- Add FIXME for `revise_data()` bug ([7dedf27](https://github.com/kobotoolbox/kpi/commit/7dedf2766bec284ac33e900cba38ad548e406798))
- Add forgotten staticmethod decorator ([06df33a](https://github.com/kobotoolbox/kpi/commit/06df33aace476e2e290480fceaabe6f0b9fee23b))
- Remove `uuid:` prefix in `revise_data()` ([7222f8b](https://github.com/kobotoolbox/kpi/commit/7222f8ba35b44f278a4713b2363cf977837712a2))
- Kill a little bit more old subsequence django app ([f1a5fe1](https://github.com/kobotoolbox/kpi/commit/f1a5fe1666cee52938bcbbd6b8086bed00ee7f77))
- Make unit tests for refactored subsequence pass ([7c806f0](https://github.com/kobotoolbox/kpi/commit/7c806f066c002633fd66cef4274b67daba5139d3))
- Unit tests, unit tests everywhere!!! ([b4c8b46](https://github.com/kobotoolbox/kpi/commit/b4c8b466aad11677b63734c6c982647352181229))
- Introduce LookupConfig dataclass, remove "item_reference_property" ([5172321](https://github.com/kobotoolbox/kpi/commit/517232137ecd9bbb2a90822f83a244fb4c287d5c))
- Prepare and arbitrate supplemental data for output ([b5f28e0](https://github.com/kobotoolbox/kpi/commit/b5f28e073fc57e68365b513d0b1c3da5d96fe292))
- Update formpack requirement for new supplemental…

format ([9945e56](https://github.com/kobotoolbox/kpi/commit/9945e565d2d94cac918c5f84ae5a23e43338bc9e))
- WIP Draft automatic translation with Google ([8eba576](https://github.com/kobotoolbox/kpi/commit/8eba576b63c75fe543595e01ddc881125a374139))
- Use Base class for language related actions ([5e9700b](https://github.com/kobotoolbox/kpi/commit/5e9700b454383d1204b358de93b2b23ddfa908ef))
- Make unit tests support dateAccepted ([75e42b6](https://github.com/kobotoolbox/kpi/commit/75e42b69e4c35155bf5d29f889d34ce2cd949125))
- Update formpack requirement for qualitative…

analysis simplification ([89c486c](https://github.com/kobotoolbox/kpi/commit/89c486cded674585f9bd8b60c4c8784160213301))
- Deduplicate in `supplemental_output_fields` ([43afcf9](https://github.com/kobotoolbox/kpi/commit/43afcf9313db17c7359403491e9f657a0a248091))
- Add support for locale ([4e61470](https://github.com/kobotoolbox/kpi/commit/4e614703a0b6f452a70997db408a12a8e0ec3d57))
- Improved process flow for automated actions ([f567a4f](https://github.com/kobotoolbox/kpi/commit/f567a4fdc9e8cf849b7fe180bb0fd61c804adb10))
- Make automatic process an intern call in revise_data ([ad18e8d](https://github.com/kobotoolbox/kpi/commit/ad18e8d35977f73484ac4f231f17fcbc1cd465d6))
- Unit tests for automatic Google transcription ([3b1122d](https://github.com/kobotoolbox/kpi/commit/3b1122dc2887c2a725cc8ba702e01ee7096e856e))
- add more base classes and mixins ([3250c21](https://github.com/kobotoolbox/kpi/commit/3250c218bdd7425b74dbcea5c6be85a744ff107f))
- Update docstrings to make base classes and mixins purpose more obvious ([7d2f5be](https://github.com/kobotoolbox/kpi/commit/7d2f5bea160896be4fd58039fa89f25d2993e20d))
- Refactor for automatic external services ([858d0c3](https://github.com/kobotoolbox/kpi/commit/858d0c3b0cc0d133619fc1afbe29648b20793db0))
- Make Automatic Google Translation a real thing ([d5713fd](https://github.com/kobotoolbox/kpi/commit/d5713fd59cf73817fd7194eaa9e6fbf288d6788e))
- Fix rootUuid with suffix ([4215c6d](https://github.com/kobotoolbox/kpi/commit/4215c6dee3acf4acbd2400a1d46fca12cdb4995d))
- linter ([0dbf074](https://github.com/kobotoolbox/kpi/commit/0dbf07453bc37d0168a4f19735e58b019ea632d9))
- Add unit tests for automatic_google_translation ([72f3395](https://github.com/kobotoolbox/kpi/commit/72f3395cb6ae0ca9fe618ce64c77889b6f445b0f))
- Add validation unit tests on automatic google translation ([0e32221](https://github.com/kobotoolbox/kpi/commit/0e3222148308aba199cfa07e353e9f4d73e92893))
- Create new README ([98f551d](https://github.com/kobotoolbox/kpi/commit/98f551d2712300a6bd49bcb2ad7b0ac220432074))
- Update validation unit tests ([1112b75](https://github.com/kobotoolbox/kpi/commit/1112b75ce44c46bae9a2d59abcfd0d3680fd0c16))
- replace Automatic with Automated ([f92da1d](https://github.com/kobotoolbox/kpi/commit/f92da1d76ec4ebd8db918b4febce35f7da642128))
- Change content JSON structure from _revisions to _version ([d7ac2ca](https://github.com/kobotoolbox/kpi/commit/d7ac2ca5443f9e1336adc225637c94ef79df56a2))
- Comments ([3202533](https://github.com/kobotoolbox/kpi/commit/3202533cb1215dffa7eb76bbea671f16385407db))
- Add comments and draft logic for background updates ([2fd5770](https://github.com/kobotoolbox/kpi/commit/2fd57700264567086a1ba5c5762feb1642a69be9))
- Correct a few typos ([fe7c88e](https://github.com/kobotoolbox/kpi/commit/fe7c88e6e3f25d6fab542d903df41e14e225a445))
- Add an unique identifier for each version ([ef08781](https://github.com/kobotoolbox/kpi/commit/ef087812b07974da32a115bfa7ecd2265a17643f))
- Add dependency and more comments ([39dd383](https://github.com/kobotoolbox/kpi/commit/39dd383a2015fe34ce3dcde0df7cf1d959c7975d))
- Correct a few typos ([e81416c](https://github.com/kobotoolbox/kpi/commit/e81416cae8985870d1ee91851af93dd43b94c136))
- Fixed typo ([7ee999e](https://github.com/kobotoolbox/kpi/commit/7ee999e28c4180182c10b9b8b9b4808dc229dd1b))
- WIP - With Celery ([9d3680c](https://github.com/kobotoolbox/kpi/commit/9d3680c77066136917dbcdf7b5a6c80755a6f124))
- Save errors when Google Timeout is reached ([8a78a77](https://github.com/kobotoolbox/kpi/commit/8a78a77daffb1d6bf59ca663a91b03e7552c94f8))
- Refactor dependencies system ([b7134ed](https://github.com/kobotoolbox/kpi/commit/b7134edf07c8b7a537a5c6bcf26728b8106474ef))
- Persist action dependency ([d70fc40](https://github.com/kobotoolbox/kpi/commit/d70fc4047c33dac1b41d076da6b93c575e110025))
- Test Celery is triggered when task is in progress ([0f29748](https://github.com/kobotoolbox/kpi/commit/0f29748d60158f582b04651cb3ef8f4fc43a0263))
- Fix dependency field on error ([1beb46f](https://github.com/kobotoolbox/kpi/commit/1beb46f6149b2952f830a023dec22e7a6e8fb958))
- Update README ([4d6abfc](https://github.com/kobotoolbox/kpi/commit/4d6abfc4b6e0ef7080c41b15edb8e52a3e0e968a))
- Update README ([b42f23d](https://github.com/kobotoolbox/kpi/commit/b42f23dd2ca65e0cf0e28d115402c2cfd263ba2a))
- migrate advanced_features and submission supplements ([f550303](https://github.com/kobotoolbox/kpi/commit/f550303a9f3c9230c56360f1d1408a788ccccaf8))
- Reactivate limits ([0a92a24](https://github.com/kobotoolbox/kpi/commit/0a92a24b339eb791f605e453a941a054333d56b0))
- Add schemas for qualitative analysis and nest…

action data within `_data` attribute for each version

Two tests are failing as they were already on 0a92a24b339eb791f605e453a941a054333d56b0:

 FAILED test_models.py::SubmissionSupplementTestCase::test_retrieve_data_from_migrated_data - KeyError: '_version'
 FAILED test_models.py::SubmissionSupplementTestCase::test_retrieve_data_with_stale_questions - AssertionError: assert {'group_name/question_name': {'manual_translation': {'en': {'_versions': [{'_uuid': '22b04ce8-61c2-4383-836f-5d5f0ad73645', 'value': 'berserk',... ([548008b](https://github.com/kobotoolbox/kpi/commit/548008b073ba68181059aa70167e7085f691cef3))
- Correct name of patched method ([7023d27](https://github.com/kobotoolbox/kpi/commit/7023d277f9a23a9cd97167d63827f37b03e2be47))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.03c..2.026.07
<!-- generated by git-cliff -->
