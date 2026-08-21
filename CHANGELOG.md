> ⚠️ **DRAFT** — this changelog is auto-generated on every push and may be inaccurate (e.g. include commits from untagged patches). It will be regenerated authoritatively at tag time. Please wait until after tagging before making manual edits.


<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (27)</summary>

- **KMLExport**: cleanup legacy KoboCAT KML logic ([#7299](https://github.com/kobotoolbox/kpi/pull/7299))
    > <!-- 📣 Summary -->
    > Removed legacy KML export generation from KoBoCAT in favor of routing
    > through our KPI Exports.

- **assetVersion**: add version_number to `/api/v2/assets/<uid>/versions/` ([#7300](https://github.com/kobotoolbox/kpi/pull/7300))
    > <!-- 📣 Summary -->
    > This PR adds a `version_number` field to the asset versions API,
    > returning "12" for deployed versions and "11.4" for undeployed versions
    > (numbered relative to the deployment that precedes them), computed
    > server-side so the numbering stays correct regardless of pagination.
    > 
    > <!-- 📖 Description -->
    > #### Why this needed to be done in the backend
    > The Form History UI (Project → Form tab) needs to label each version
    > like v12, v11.4, etc. - deployed versions get a whole "major" number,
    > and undeployed (draft) versions get a "minor" number counting up since
    > the last deployment.
    > 
    > The frontend currently derives this from array index, which only works
    > because the full list is loaded at once. We're moving this list to
    > paginated infinite scroll, and a version's correct number depends on the
    > entire history of the asset before it - not just the versions on the
    > current page. The frontend has no way to know, from a single page of
    > results, how many deployments happened earlier in history, so it can't
    > reliably compute this itself once pagination is introduced.
    > 
    > #### What changed
    > Added a `version_number` field to the versions serializer. For each
    > request, we fetch the asset's full version history as a lightweight (id,
    > deployed) list in a single ordered query, then walk it once in Python to
    > build a map of version id → label: deployed versions increment the major
    > number and reset the minor, undeployed versions increment the minor. The
    > serializer looks up each row's label from that map, so both the
    > paginated list endpoint and retrieve return identical,
    > pagination-independent numbers with no per-row queries.
    > 
    > #### Why computed on the fly instead of stored on the model
    > I considered storing these numbers as columns on AssetVersion, populated
    > at save time like the existing _content_hash field, but ruled it out
    > because the table has millions of rows and would need a long, risky
    > backfill migration for a display-only field. Version counts per asset
    > are in the low hundreds in practice, so fetching two integer columns for
    > one asset's history and looping over them is negligible work - it
    > requires no migration and is automatically correct for all existing
    > data. If per-asset version counts ever grow into the tens of thousands,
    > the stored-column approach becomes worth revisiting; at current scale it
    > isn't.

- **bulkProcessing**: disable bulk option if no data ([#7325](https://github.com/kobotoolbox/kpi/pull/7325))
    > <!-- 📣 Summary -->
    > 
    > The `Transcribe selected audio files` and `Translate selected
    > transcriptions` options in the data table column menu are now greyed out
    > when none of the selected submissions has anything to work with.

- **bulkProcessing**: consistent audio duration in UI ([#7320](https://github.com/kobotoolbox/kpi/pull/7320))
    > <!-- 📣 Summary -->
    > 
    > Audio durations in Project → Data → Table now match the durations used
    > by bulk transcription and translation.

- **bulkProcessing**: disable bulk approve option if nothing to approve ([#7322](https://github.com/kobotoolbox/kpi/pull/7322))
    > <!-- 📣 Summary -->
    > 
    > Disable "Approve all selected" option if none of selected submissions
    > has things to approve.

- **bulkProcessing**: improve UI blocking code based on bulk job status(es) ([#7346](https://github.com/kobotoolbox/kpi/pull/7346))
    > <!-- 📣 Summary -->
    > 
    > Fixed transcripts and translations being locked for review/save while
    > other rows from the same bulk job were still being processed.

- **bulkProcessing**: improve count for approving ([#7351](https://github.com/kobotoolbox/kpi/pull/7351))
    > <!-- 📣 Summary -->
    > 
    > The `Approve all selected` dialog now counts only the transcripts or
    > translations that still need approval, and tells you how many of your
    > selected submissions were already approved.

- **dataTable**: deduplicate non-audio attachment columns ([#7268](https://github.com/kobotoolbox/kpi/pull/7268))
    > <!-- 📣 Summary -->
    > 
    > Data Table now safely de-duplicates stale attachment columns not only
    > for audio, but also for image, video, and file questions, so users no
    > longer see duplicate columns after group/path changes.

- **dataTable**: freeze and hide for all ([#7343](https://github.com/kobotoolbox/kpi/pull/7343))
    > <!-- 📣 Summary -->
    > 
    > Users without editing permissions can now hide, show, and freeze columns
    > in Project → Data → Table for their own session, without changing what
    > anyone else sees.

- **designSystem**: use mantine Tabs component and deprecate our old component ([#7293](https://github.com/kobotoolbox/kpi/pull/7293))
    > <!-- 📣 Summary -->
    > Replace old tabs component with updated one

- **designSystem**: update project top tabs component ([#7335](https://github.com/kobotoolbox/kpi/pull/7335))
    > <!-- 📣 Summary -->
    > Update project top tabs to new component.

- **designSystem**: adjust Switch colors ([#7398](https://github.com/kobotoolbox/kpi/pull/7398))
- **frontend**: improve Select and MultiSelect UX ([#7353](https://github.com/kobotoolbox/kpi/pull/7353))
    > <!-- 📣 Summary -->
    > 
    > Make all Selects and MultiSelects searchable by default. Also add
    > PageUp, PageDown, Home, and End keyboard navigation to them.

- **frontend**: Make MultiSelect searchable by default ([#7397](https://github.com/kobotoolbox/kpi/pull/7397))
    > <!-- 📣 Summary -->
    > 
    > Every place that uses MultiSelect in UI will now allow searching for
    > options.

- **massEmails**: add llm requests to mass email queries ([#7303](https://github.com/kobotoolbox/kpi/pull/7303))
    > <!-- 📣 Summary -->
    > Add a Mass email config for sending emails to users who are above
    > various thresholds in LLM usage.

- **massEmails**: get rid of add to send option ([#7342](https://github.com/kobotoolbox/kpi/pull/7342))
    > <!-- 📣 Summary -->
    > Remove the 'Add to daily send' option from the Django admin list page
    > for mass email configs.

- **massEmails**: pace sends against the provider rate limit ([#7440](https://github.com/kobotoolbox/kpi/pull/7440))
    > <!-- 📣 Summary -->
    > 
    > Mass email campaigns now pace themselves to stay within the email
    > provider's sending limits, instead of risking being throttled or blocked
    > for sending too fast.
    > 
    > ### 👷 Description for instance maintainers
    > 
    > Two new environment variables control mass-email pacing and replace the
    > removed `MASS_EMAIL_SLEEP_SECONDS`:
    > 
    > - `MASS_EMAIL_SEND_RATE_RATIO` (default `0.35`): share of
    > `MASS_EMAIL_THROTTLE_PER_SECOND` actually claimed per second, leaving
    > headroom for transactional email and other instances sharing the same
    > provider account. `0.5` or below is recommended so two full budget
    > windows landing back to back still can't exceed the provider's rate
    > limit; a Django system check only blocks values outside `(0, 1]`, an
    > admin can go above `0.5` at the risk of bursting past the limit near a
    > window boundary.
    > - `MAILER_CONNECTION_IDLE_TIMEOUT` (default `10`): seconds a reused SMTP
    > connection can sit idle before it's proactively checked and reconnected
    > ahead of the next send.
    > 
    > `MASS_EMAIL_THROTTLE_PER_SECOND` and `MAX_MASS_EMAILS_PER_DAY` keep
    > their existing meaning, but should be reviewed per deployment: they must
    > reflect the actual provider's real limits, which differ between a main
    > SES account, a secondary SES account, SendGrid, or Office365. No
    > migrations.

- **massEmails**: re-validate recipient eligibility before sending stale records ([#7448](https://github.com/kobotoolbox/kpi/pull/7448))
    > <!-- 📣 Summary -->
    > 
    > Mass email recipients who no longer meet a campaign's criteria by the
    > time their email is about to be sent are now skipped instead of
    > receiving a message that's no longer relevant to them.
    > 
    > <!-- 📖 Description -->
    > 
    > A large mass email batch can take days to fully send because of the
    > daily send cap. During that time, a recipient can stop matching the
    > campaign's criteria (for example, buying a storage add-on that resolves
    > the over-limit condition that triggered the email), but until now the
    > system had no way to notice and would send the email anyway, sometimes
    > days later. Before sending any record that's been sitting in the queue
    > for a while, we now re-check that the recipient still matches the
    > campaign's criteria, and skip the send if they don't.

- **openRosa**: block superuser form submissions by default ([#7371](https://github.com/kobotoolbox/kpi/pull/7371))
    > <!-- 📣 Summary -->
    > 
    > Superuser accounts can no longer submit data to forms, preventing
    > accidental damage to projects from test submissions.
    > 
    > <!-- 📖 Description -->
    > 
    > Submitting data while signed in as a superuser can corrupt a project's
    > data. Superuser accounts are now blocked from submitting to any form —
    > whether through KoboCollect, Enketo web forms, or the API. Regular
    > accounts are unaffected; use one to submit or test data.
    > 
    > ### 👷 Description for instance maintainers
    > 
    > This restriction is **on by default**. Self-hosters who deliberately
    > rely on superuser submissions can re-enable them by setting the
    > environment variable `ALLOW_SUPERUSER_SUBMISSIONS=True`. Doing so
    > re-arms a known footgun — superuser submissions can break projects.

- **organizations**: org members api needs to expose sso status ([#7328](https://github.com/kobotoolbox/kpi/pull/7328))
    > <!-- 📣 Summary -->
    > Add a new user__has_sso_enabled field to organizations member serializer
    > and updated the open api docs

- **processing**: auto translation polling ([#7244](https://github.com/kobotoolbox/kpi/pull/7244))
    > <!-- 📣 Summary -->
    > 
    > Automatic translations now use per-language polling in the Translations
    > tab. If a translation is still processing, the tab shows an in-progress
    > screen and keeps polling until the result is available. This also works
    > when users navigate away and come back.

- **projectDownloads**: migrate KML to non-legacy ([#7256](https://github.com/kobotoolbox/kpi/pull/7256))
    > <!-- 📣 Summary -->
    > 
    > KML exports now use the modern downloads flow (same as CSV/XLS/GeoJSON)
    > instead of the legacy iframe path.

- **projectDownloads**: show media checkbox for GeoJSON ([#7296](https://github.com/kobotoolbox/kpi/pull/7296))
    > <!-- 📣 Summary -->
    > 
    > GeoJSON exports now include media URLs by default and have a matching
    > "Include media URLs" checkbox under Advanced options, just like XLS and
    > CSV exports.

- **projectHistoryLogs**: log when users view data ([#7339](https://github.com/kobotoolbox/kpi/pull/7339))
    > <!-- 📣 Summary -->
    > Log when users view data for a project.
    > 
    > <!-- 📖 Description -->
    > Create new project history logs whenever a user hits the
    > `/api/v2/assets/{uid}/data/` endpoint.
    > 
    > ### 👷 Description for instance maintainers
    > This is likely to add a ton more audit logs. It shouldn't be enough to
    > affect performance but it's worth noting.

- **stripe**: add webhook handling to update status of unpaid subscriptions ([#7254](https://github.com/kobotoolbox/kpi/pull/7254))
    > <!-- 📣 Summary -->
    > Update our Stripe billing integration so that certain subscription plans
    > (like Teams) can remain in an "unpaid" status indefinitely instead of
    > automatically canceling after payment retries fail.

- **stripe**: only run cleanup tasks on stripe-enabled instances ([#7395](https://github.com/kobotoolbox/kpi/pull/7395))
- **userReports**: add LLM usage to user reports ([#7386](https://github.com/kobotoolbox/kpi/pull/7386))
    > <!-- 📣 Summary -->
    > Add usage summaries for LLM requests to the user reports endpoint.

</details>

<details><summary>Bug Fixes (34)</summary>

- **admin**: correct CORS configuration guidance ([#7284](https://github.com/kobotoolbox/kpi/pull/7284))
- **admin**: allow creating ExtraUserDetail without a manual uid ([#7317](https://github.com/kobotoolbox/kpi/pull/7317))
    > <!-- 📣 Summary -->
    > Superusers can now add a user's extra details from the Django admin
    > without having to invent an ID by hand.
    > 
    > <!-- 📖 Description -->
    > Adding a new "extra user detail" record from the Django admin was
    > effectively impossible. The form demanded a `uid` that the admin was
    > supposed to generate automatically, and it rejected the empty `{}` value
    > for the `data` field even though that is the field's own default. Both
    > fields now behave as expected: the `uid` is generated on save and is no
    > longer editable, and `{}` is accepted for `data`.

- **attachments**: use root_uuid for media folder naming ([#7394](https://github.com/kobotoolbox/kpi/pull/7394))
    > <!-- 📣 Summary -->
    > Media files for edited submissions could end up in an export folder that
    > no longer matches the submission, making them hard to find.

- **bulkProcessing**: hide transcript language from bulk translation modal ([#7403](https://github.com/kobotoolbox/kpi/pull/7403))
    > <!-- 📣 Summary -->
    > 
    > The language a transcript is already in is no longer offered when
    > creating a translation, so you can't accidentally translate English into
    > English and end up with a blank column you can't get rid of.

- **bulkProcessing**: translations tab alert ([#7402](https://github.com/kobotoolbox/kpi/pull/7402))
    > <!-- 📣 Summary -->
    > 
    > The "this submission is already being processed by another job" warning
    > now also appears on the Translations tab, not just on the Transcript
    > tab.

- **darker**: fail the linter job when darker crashes ([#7316](https://github.com/kobotoolbox/kpi/pull/7316))
    > <!-- 📣 Summary -->
    > 
    > No user-facing change — this fixes an internal code-quality check that
    > was reporting success even when it had not actually run.
    > 
    > <!-- 📖 Description -->
    > 
    > The automated Python style check that runs on every code change could
    > fail to start and still report a green result, so problems it was meant
    > to catch could slip through unnoticed. It now reports a clear failure
    > whenever it cannot complete.

- **dataTable**: improve select_x data displaying ([#7362](https://github.com/kobotoolbox/kpi/pull/7362))
    > <!-- 📣 Summary -->
    > 
    > Data Table now shows all selected options of a `select_many` question,
    > falling back to the raw value for options that were renamed or removed
    > in a later version of the form.

- **dataTable**: handle out-of-bounds translation index ([#7419](https://github.com/kobotoolbox/kpi/pull/7419))
    > <!-- 📣 Summary -->
    > 
    > Fixed a crash that prevented the data table from loading for projects
    > where the saved display-language setting referred to a language that no
    > longer exists in the form.

- **datatable**: fallback values for missing choice names ([#7381](https://github.com/kobotoolbox/kpi/pull/7381))
    > <!-- 📣 Summary -->
    > 
    > Fixes the select one/many column filter dropdown on the data table to
    > handle choices with a missing `name` by falling back to `$autoname` then
    > `$autovalue` before dropping value from list.

- **digestAuth**: use a fixed content type on auth failure ([#7352](https://github.com/kobotoolbox/kpi/pull/7352))
    > <!-- 📣 Summary -->
    > 
    > Fixed a server error (HTTP 500) that could occur when authentication
    > failed while downloading a submission attachment.
    > 
    > <!-- 📖 Description -->
    > 
    > When a client tried to download a submission attachment (for example
    > over ODK Briefcase) with invalid credentials, the server could respond
    > with an unexpected error instead of a proper "authentication required"
    > response. It now consistently returns a 401.

- **formbuilder**: preserve manual skip logic and validation inputs ([#7347](https://github.com/kobotoolbox/kpi/pull/7347))
    > <!-- 📣 Summary -->
    > 
    > Fixed an issue where skip logic and validation criteria entered manually
    > could be lost after closing and reopening the question settings panel.

- **formbuilder**: crash with unsupported type ([#7392](https://github.com/kobotoolbox/kpi/pull/7392))
    > <!-- 📣 Summary -->
    > 
    > Fixed Form Builder failing to open forms that contain question types it
    > can't edit, and no longer dropping those questions when the form is
    > saved.
    > 
    > <!-- 📖 Description -->
    > 
    > Some valid XLSForm question types have no editor in Form Builder.
    > Opening such a form used to break the editor, and saving it - silently
    > deleted the question.
    > 
    > Now those questions show up as a card explaining that they can't be
    > edited here and will be left alone when you save. The rest of the form
    > works normally. Affected types include `select_one_external`, `email`,
    > `osm`, `percentage`, `phone number`, `number of days in last month`/`six
    > months`/`year`, `q select`, `q select1`, and the `uri:*` metadata types.
    > 
    > A card:
    > 
    > <img width="1056" height="315" alt="Screenshot 2026-08-05 at 16 16 51"
    > src="https://github.com/user-attachments/assets/4080a91f-2a7b-41e7-9d79-61a315b6b547"
    > />

- **frontend**: notification with multiple error lines layout ([#7297](https://github.com/kobotoolbox/kpi/pull/7297))
    > <!-- 📣 Summary -->
    > 
    > Improve layout of import error notification when multiple lines of text
    > needs to be displayed.

- **frontend**: AccountMenu language selector ([#7451](https://github.com/kobotoolbox/kpi/pull/7451))
    > <!-- 📣 Summary -->
    > 
    > Fixes the UI of language selector.

- **library**: more actions dropdown menu ([#7461](https://github.com/kobotoolbox/kpi/pull/7461))
    > <!-- 📣 Summary -->
    > 
    > Fixes a bug where the "More actions" dropdown menu in the detail view
    > for collections would not stay open when moving the mouse from the
    > trigger button to the menu.

- **mailer**: classify SES per-session message limit ([#7456](https://github.com/kobotoolbox/kpi/pull/7456))
    > <!-- 📣 Summary -->
    > 
    > A mass email recipient whose send happened to hit SES's per-session
    > message limit was never getting emailed, silently, with no retry.
    > 
    > <!-- 📖 Description -->
    > 
    > SES closes the SMTP connection after it's carried a certain number of
    > messages in one session — a normal connection-lifecycle event, not a
    > problem with the recipient or the message. The code already reconnects
    > correctly when this happens, but it didn't recognize this specific SES
    > response, so it fell back to treating it like any other send failure:
    > the recipient's record was marked permanently failed and never retried,
    > even though nothing was actually wrong with their address.

- **massEmails**: reduce mass email send lag ([#7431](https://github.com/kobotoolbox/kpi/pull/7431))
    > <!-- 📣 Summary -->
    > 
    > Some account emails, like storage limit warnings, were arriving days
    > after they were triggered.

- **massEmails**: don't resend after an ambiguous SMTP drop ([#7435](https://github.com/kobotoolbox/kpi/pull/7435))
    > <!-- 📣 Summary -->
    > 
    > Under a rare connection hiccup, a mass account email could occasionally
    > be sent twice to the same recipient.

- **massEmails**: stop OOM when generating send lists at scale ([#7437](https://github.com/kobotoolbox/kpi/pull/7437))
    > ## 📣 Summary
    > Automated emails, like usage limit alerts, go out again on very large
    > servers.
    > 
    > ## 📖 Description
    > On servers with millions of accounts, the daily job that prepares email
    > recipient lists ran out of memory and stopped, so no emails were sent.
    > The job now uses a fraction of the memory and the emails are sent as
    > expected.
    > 
    > ## 💭 Notes
    > - The pipeline loaded full User/Organization objects and built a dict
    > per org for the whole fleet: several GB of memory on large instances,
    > worker OOM-killed, failure silent (transaction rolls back, "done for
    > today" flag never set, send task skips).
    > - Fix: ids via `values_list`, one shared default limits/dates dict (the
    > addon merge copies before mutating; a test pins that), no giant `IN`
    > clauses (`None` now means "all orgs"; per-user usage queries run in
    > batches via `USAGE_QUERY_USER_ID_BATCH_SIZE`, default 20000 and clamped
    > to at least 1), records enqueued by `user_id` in batches.
    > - Repro at 50k users: peak went from 94.4 MB to 22.5 MB, same 50,010
    > records.
    > 
    > ## 👀 Preview steps
    > Backend only. Seed 50k users and run `enqueue_mass_email_records` under
    > `tracemalloc`:
    > 1. 🔴 on the base branch: peak ~94 MB for 50k recipients, growing ~2 KB
    > per user, so several GB at production scale
    > 2. 🟢 on this PR: peak ~22 MB, identical records created

- **massEmails**: exclude deactivated users from mass emails ([#7445](https://github.com/kobotoolbox/kpi/pull/7445))
    > <!-- 📣 Summary -->
    > 
    > Deactivated accounts no longer receive mass emails.
    > 
    > <!-- 📖 Description -->
    > 
    > Deactivated accounts could still show up as recipients of mass emails.
    > That includes accounts moved to a private server, which stay around for
    > months before their data is deleted. They're now left out of the
    > recipient lists, and an account deactivated after a list was built won't
    > get the email either.

- **massEmails**: migration conflicts ([9fb6a98](https://github.com/kobotoolbox/kpi/commit/9fb6a9881c95938c25d1f06cffb9ee003230a4bc))
- **massEmails**: add missing autoqa eligibility checks after .30→.33 merge ([#7457](https://github.com/kobotoolbox/kpi/pull/7457))
    > <!-- 📣 Summary -->
    > 
    > Fixes a gap left over from the `release/2.026.30` → `release/2.026.33`
    > merge: three mass-email queries had no matching eligibility check.
    > 
    > <!-- 📖 Description -->
    > 
    > `release/2.026.33` already had AutoQA usage mass-email queries
    > (`users_above_{80,90,100}_percent_autoqa_usage`) that predate
    > `release/2.026.30`'s stale-record eligibility recheck (), so
    > those three queries had no matching single-user eligibility check once
    > the branches merged.

- **openapi**: type validation error responses as ErrorValidation ([#7275](https://github.com/kobotoolbox/kpi/pull/7275))
    > <!-- 📣 Summary -->
    > 
    > The API reference now documents validation errors with their real shape
    > — a map of field name to error messages — instead of an untyped
    > placeholder.
    > 
    > <!-- 📖 Description -->
    > 
    > When a request fails validation, the KoboToolbox API returns each
    > field's errors as a list of messages. Until now the API reference
    > described this `400` response as an untyped `detail` object, which
    > didn't match what the API actually sends. It is now documented
    > accurately, so anyone building against the API — or relying on the types
    > generated from its schema — gets the correct shape for validation
    > errors.

- **organizations**: return displayable error details for invites and members ([#7332](https://github.com/kobotoolbox/kpi/pull/7332))
    > <!-- 📣 Summary -->
    > 
    > Error messages shown when managing team or organization members now
    > explain what actually went wrong, instead of a generic "there was an
    > error" message.
    > 
    > <!-- 📖 Description -->
    > 
    > Some screens in the **Members** and **Usage** sections replaced the
    > server's explanation with their own wording — changing the role on an
    > invitation that had already been accepted just said *"There was an error
    > updating this invitation."* They now show the specific reason. When the
    > server can't be reached at all, a single plain message is shown instead
    > of a technical status code.

- **permissions**: drop django guardian constraints and tables ([#7453](https://github.com/kobotoolbox/kpi/pull/7453))
    > <!-- 📣 Summary -->
    > The migration `main.0019` in kobocat database should have removed the
    > guardian contraints, but it seems it's not the case in some
    > circumstances which blocks users deletion actions. We introduce a new
    > migration to handle any remanining guardian constraints.
    > 
    > <!-- 📖 Description -->
    > To ensure constraints and tables are removed, we use the same approach
    > used in the migration `main.0021` that dynamically inspects constraints
    > on `guardian_userobjectpermission` and `guardian_groupobjectpermission`
    > tables in the Kobocat DB.

- **profile**: dropdown z-index ([#7304](https://github.com/kobotoolbox/kpi/pull/7304))
    > <!-- 📣 Summary -->
    > Fixes a bug that resulted in the profile dropdown from the nav header
    > being hidden by other components.

- **projectDownloads**: kml exporting bug ([#7442](https://github.com/kobotoolbox/kpi/pull/7442))
    > <!-- 📣 Summary -->
    > 
    > Fixed an error that blocked KML exports in projects where a GeoJSON
    > export was created earlier.
    > 
    > <!-- 📖 Description -->
    > 
    > Options that apply to a single export format no longer follow you when
    > you switch format. Before this fix, exporting GeoJSON and then KML sent
    > the GeoJSON-only "Flatten GeoJSON" option along with the KML request,
    > and the server refused it. Projects already in that state recover on
    > their next export, nothing to clean up.

- **projectOwnership**: stop false transfer failures and improve admin transfer details ([#7294](https://github.com/kobotoolbox/kpi/pull/7294))
    > <!-- 📣 Summary -->
    > 
    > Project ownership transfers are no longer reported as failed when the
    > transfer actually completed successfully.
    > 
    > <!-- 📖 Description -->
    > 
    > Transferring projects could end as "failed" even though everything had
    > moved correctly — a single already-deleted file among thousands was
    > enough. A file that no longer exists cannot be moved, so it no longer
    > counts as a failure, and the same now applies when an internal retry
    > re-runs a step that had already finished. Genuine problems are still
    > reported, and a new log page shows what happened for a given project.

- **projectViews**: allow filtering by owner organization ([#7283](https://github.com/kobotoolbox/kpi/pull/7283))
- **projectViews**: crash on owners without organization and hide inactive accounts ([#7423](https://github.com/kobotoolbox/kpi/pull/7423))
    > <!-- 📣 Summary -->
    > 
    > Project views no longer fail to load when they contain a project owned
    > by a deactivated account, and deactivated accounts and their projects
    > are now hidden from project views.
    > 
    > <!-- 📖 Description -->
    > 
    > Opening a project view could return an error instead of the project
    > list, depending on which accounts owned the projects it covered. That no
    > longer happens.
    > 
    > Deactivated accounts were also being listed in the users tab of a
    > project view, and their projects appeared in the projects tab and in
    > both CSV exports. They are now excluded everywhere in project views, so
    > the API and the exports show the same thing.

- **qualitativeAnalysis**: allow duplicate casing in QA tags questions ([#7298](https://github.com/kobotoolbox/kpi/pull/7298))
    > <!-- 📣 Summary -->
    > Updated tag duplication logic to allow different casings of the same tag
    > to be added (and suggested) as separate tags.
    > 
    > 1. ℹ️ have an account and a project with multiple audio submissions
    > 2. add a tags QA question
    > 3. add tags "Poverty" and "poverty"
    > 4. 🔴 [on main] notice that "poverty" doesn't get added
    > 5. go to a new submission
    > 6. add tag "poverty" here
    > 7. 🟢 [on main] notice that "poverty" gets added
    > 8. go to a new submissions
    > 9. try adding both "Poverty" and "poverty" from the tags suggestions
    > 10. 🔴 [on main] notice that both tags don't get added
    > 11. 🟢 [on PR] notice that both tags can be added

- **submissions**: reject trailing slash on OpenRosa endpoints with 404 ([#7361](https://github.com/kobotoolbox/kpi/pull/7361))
    > <!-- 📣 Summary -->
    > 
    > Calling an OpenRosa endpoint (form list or submission) with an
    > accidental trailing slash now returns a clear "not found" message
    > instead of a confusing security error.
    > 
    > <!-- 📖 Description -->
    > 
    > The OpenRosa endpoints are meant to be called without a trailing slash.
    > Adding one (e.g. `/submission/`) used to surface a misleading CSRF
    > error. They now respond with an explicit 404 that names the correct URL
    > to retry. The official clients (Collect, Enketo) are unaffected — they
    > already build the correct slash-less URLs. This only helps people
    > writing their own integrations or curl commands.
    > 
    > ### 👷 Description for instance maintainers
    > 
    > New `OpenRosaTrailingSlashMiddleware`, ordered ahead of
    > `CsrfViewMiddleware`, intercepts any request whose path ends in
    > `/submission/` or `/formList/` — covering the authenticated, per-user,
    > data-collector and asset-snapshot variants — and returns a 404 pointing
    > at the slash-less URL. Honoring the slash was deliberately rejected:
    > OpenRosa clients build slash-less URLs, and Django's `APPEND_SLASH`
    > redirect would drop the POST body on submissions.

- **tags**: return each tag once from `/api/v2/tags/` ([#7315](https://github.com/kobotoolbox/kpi/pull/7315))
    > <!-- 📣 Summary -->
    > `TagViewSet.get_queryset()` filters across the `taggit_taggeditem` join
    > table, so a tag attached to N accessible assets was emitted N times,
    > `.distinct()` collapses it back to one row per tag.
    > 
    > <!-- 📖 Description -->
    > `TagViewSet.get_queryset()` filters `Tag` on
    > `taggit_taggeditem_items__*` to restrict tags to assets the user may
    > view. Because that filter spans a multi-valued relationship, the
    > underlying SQL joins `taggit_tag` onto `taggit_taggeditem` and returns
    > one row per tag/asset pairing so a tag applied to two accessible assets
    > came back twice, with an identica `name` and `url`.

- **trashBin**: restart trash bin tasks which failed on transient errors ([#7390](https://github.com/kobotoolbox/kpi/pull/7390))
    > <!-- 📣 Summary -->
    > This PR makes trash bin deletion jobs that fail on a transient
    > infrastructure error retry themselves automatically, by leaving them
    > in-progress so the existing task restarter picks them up, and fixes
    > three pre-existing bugs in that restarter including one that deleted
    > accounts a superuser was supposed to approve first.
    > 
    > <!-- 📖 Description -->
    > #### Problem
    > Trash bin deletion jobs (accounts, projects, attachments) that died on
    > an infrastructure error (MongoDB unreachable, a PostgreSQL deadlock, a
    > Celery time limit, an OOM kill) were marked FAILED and left there.
    > Nothing retried them, so half-deleted objects lingered until someone
    > noticed and restarted them by hand.
    > 
    > #### What this changes 
    > When a job fails, its error is matched against a list of known-transient
    > patterns. If it matches, the object is left `IN_PROGRESS` instead of
    > `FAILED` which is exactly what the existing `task_restarter` already
    > looks for, so it gets restarted with no new machinery. Any other failure
    > still goes to FAILED and waits for a human.
    > 
    > Attempts are counted and capped: once an object exceeds
    > TRASH_BIN_MAX_AUTO_RESTARTS it is flagged FAILED and stops retrying, so
    > it can't loop forever and becomes visible to a human.
    > 
    > #### Three pre-existing bugs on main 
    > 1. The stuck check was effectively dead for started deletions. It
    > required an object to be roughly twice its retention period old before
    > being eligible. (e.g., 7-day-retention project failing on day 7 was only
    > restarted on day 14; 360 days for accounts)
    > 2. Accounts held for manual deletion were deleted automatically. Their
    > scheduled time is computed into the past, and the restarter reads that
    > timestamp rather than the disabled Celery schedule so it force-started
    > the deletion ~75–105 minutes after trashing, voiding the "a superuser
    > must approve this" guarantee.
    > 3. A manual deletion that genuinely got stuck was never restarted. The
    > mirror image: once retention is changed to a normal value, that same
    > past timestamp fails the check, so a superuser-started deletion whose
    > worker died sat half-complete in IN_PROGRESS for months.
    > 
    > The fix for all three: a deletion that is already in progress has by
    > definition passed its scheduled time, so that time is no longer
    > consulted for it. Only objects that never started still get the "is it
    > due yet?" check, and those are additionally never auto-started when
    > they're waiting for a superuser.

</details>

<details><summary>Performance (1)</summary>

- **massEmails**: fewer per-record queries when sending ([#7452](https://github.com/kobotoolbox/kpi/pull/7452))
    > <!-- 📣 Summary -->
    > 
    > Sending mass emails now does fewer database queries per recipient, and
    > no longer risks crashing if a recipient's account is deleted mid-send.
    > 
    > <!-- 📖 Description -->
    > 
    > Sending a batch of mass emails looks up each recipient's profile details
    > and their organization's plan name separately for every single email,
    > most of which doesn't need to be a fresh, individual lookup. This change
    > batches those lookups together where it's safe to do so, while still
    > reading a recipient's active status fresh right before sending each
    > email — a large batch can take close to an hour to fully send, so an
    > account status still needs to be checked close to send time, not just
    > once at the start. It also makes sure a recipient whose account was
    > deleted partway through a send doesn't cause the sending process to
    > fail.

</details>

<details><summary>Continous Integration (4)</summary>

- **darker**: print the diff so formatting failures are self-explanatory ([#7341](https://github.com/kobotoolbox/kpi/pull/7341))
- **release**: maybe fix a false-positive transifex diff ([#7429](https://github.com/kobotoolbox/kpi/pull/7429))
- **releases**: auto-create linear issues ([#7401](https://github.com/kobotoolbox/kpi/pull/7401))
- **releases**: idempotent transifex pull ([#7466](https://github.com/kobotoolbox/kpi/pull/7466))
</details>

<details><summary>Build & Dependencies (9)</summary>

- **deps**: bump the actions-deps group across 1 directory with 7 updates ([#7407](https://github.com/kobotoolbox/kpi/pull/7407))
- **deps-dev**: bump eslint-plugin-storybook from 10.5.4 to 10.5.5 ([#7006](https://github.com/kobotoolbox/kpi/pull/7006))
- **deps-dev**: bump @storybook/addon-a11y from 10.5.4 to 10.5.5 ([#7004](https://github.com/kobotoolbox/kpi/pull/7004))
- **deps-dev**: bump @eslint/compat from 1.4.1 to 2.1.0 ([#7044](https://github.com/kobotoolbox/kpi/pull/7044))
- **deps-dev**: bump postcss-loader from 7.3.4 to 8.2.1 ([#7025](https://github.com/kobotoolbox/kpi/pull/7025))
- **deps-dev**: bump postcss from 8.5.22 to 8.5.25 in the minor-and-patch group across 1 directory ([#7376](https://github.com/kobotoolbox/kpi/pull/7376))
- **deps-dev**: bump brace-expansion from 1.1.16 to 1.1.18 ([#7377](https://github.com/kobotoolbox/kpi/pull/7377))
- **deps-dev**: bump undici from 7.28.0 to 7.29.0 ([#7378](https://github.com/kobotoolbox/kpi/pull/7378))
- **deps-dev**: bump fast-uri from 3.1.4 to 3.1.5 ([#7379](https://github.com/kobotoolbox/kpi/pull/7379))
</details>

<details><summary>Testing (2)</summary>

- **storybook**: concise CI output ([#7281](https://github.com/kobotoolbox/kpi/pull/7281))
- **storybook**: make tests more robust ([#7309](https://github.com/kobotoolbox/kpi/pull/7309))
    > <!-- 📣 Summary -->
    > 
    > Made the `AssetTagsModal` and `FormLanguagesManager` Storybook
    > interaction tests more reliable so they stop failing at random in CI.

</details>

<details><summary>Refactor (10)</summary>

- **RESTServices**: mantineify code ([#7302](https://github.com/kobotoolbox/kpi/pull/7302))
    > <!-- 📣 Summary -->
    > 
    > Migrated REST Services feature to use Mantine components.

- **dataTable**: mantineify table settings modal ([#7288](https://github.com/kobotoolbox/kpi/pull/7288))
    > <!-- 📣 Summary -->
    > 
    > Migrated Table Settings modal to Mantine Modal, migrated the in-modal
    > component to TypeScript and made it a functional component that uses
    > Mantine components. Also fixed "Reset" button to use proper defaults.

- **dataTable**: mantineify table media preview ([#7289](https://github.com/kobotoolbox/kpi/pull/7289))
    > <!-- 📣 Summary -->
    > 
    > Migrates Table Media Preview modal and Text Modal to the Mantine modal
    > flow, removes the legacy BigModal path for table media preview, and adds
    > stable offline-safe DataTableCell stories for media behaviors.

- **frontend**: replace ToggleSwitch with Mantine Switch ([#7387](https://github.com/kobotoolbox/kpi/pull/7387))
    > <!-- 📣 Summary -->
    > 
    > Using Mantine Switch throughout the app, which has a better colors than
    > our old component.

- **frontend**: switch KoboDropdown instances to Mantine Menu ([#7380](https://github.com/kobotoolbox/kpi/pull/7380))
    > <!-- 📣 Summary -->
    > 
    > The sorting and options menus in the project list, per-project usage
    > table, data table and qualitative analysis now use Mantine Menu.

- **map**: remove leaflet-omnivore ([#7301](https://github.com/kobotoolbox/kpi/pull/7301))
    > <!-- 📣 Summary -->
    > Replaces defunct leaflet-omnivore package with more targeted
    > dependencies for parsing map overlay data, while also removing support
    > for .wkt files in this context.

- **massEmails**: fold the send-rate ratio into a single throttle setting ([#7464](https://github.com/kobotoolbox/kpi/pull/7464))
- **myProjects**: replace react-infinite-scroller with in-house solution ([#7391](https://github.com/kobotoolbox/kpi/pull/7391))
    > <!-- 📣 Summary -->
    > 
    > Scrolling through a long list of projects now loads the next batch more
    > reliably, and a failed load offers a Retry button instead of just an
    > error message.

- **permissions**: mantineify sharing modal ([#7295](https://github.com/kobotoolbox/kpi/pull/7295))
    > <!-- 📣 Summary -->
    > 
    > Sharing settings were modernized to a Mantine modal flow, with clearer
    > public/anonymous sharing controls, better form validation feedback, and
    > accessibility fixes.

- **projectDownloads**: migrate to orval ([#7250](https://github.com/kobotoolbox/kpi/pull/7250))
</details>

<details><summary>Styling (4)</summary>

- **KMLExport**: sort import and add blank line for darker ([#7340](https://github.com/kobotoolbox/kpi/pull/7340))
- **imports**: fix formpack/pyxform import classification ([#7460](https://github.com/kobotoolbox/kpi/pull/7460))
- **organizations**: reformat sso_subquery for darker ([#7405](https://github.com/kobotoolbox/kpi/pull/7405))
- py formatting ([#7432](https://github.com/kobotoolbox/kpi/pull/7432))
</details>

<details><summary>Chores (10)</summary>

- **dependencies**: upgrade fantasticon to 4.1 ([#7321](https://github.com/kobotoolbox/kpi/pull/7321))
- **dependencies**: upgrade immutable package ([#7323](https://github.com/kobotoolbox/kpi/pull/7323))
- **deps**: bump formpack pin for missing-value NLP export fix ([#7345](https://github.com/kobotoolbox/kpi/pull/7345))
- **frontend**: rename route file ([#7382](https://github.com/kobotoolbox/kpi/pull/7382))
- **frontend**: fix button text casing around Data Table ([#7409](https://github.com/kobotoolbox/kpi/pull/7409))
    > <!-- 📣 Summary -->
    > 
    > Fix few buttons to use `Sentence case` instead of `lower case` or `Title
    > Case`. Also changed bulk related text to more sensible one.

- **node**: drop support for node 20 ([#7308](https://github.com/kobotoolbox/kpi/pull/7308))
- **orval**: upgrade Orval to 7.21 ([#7305](https://github.com/kobotoolbox/kpi/pull/7305))
- upgrade drf-spectacular ([#7324](https://github.com/kobotoolbox/kpi/pull/7324))
- pull transifex translations for 2.026.30b ([064bd30](https://github.com/kobotoolbox/kpi/commit/064bd307fa248b3824950e442b0dbbdecaac3a00))
- pull transifex translations for 2.026.30b ([4cf79f0](https://github.com/kobotoolbox/kpi/commit/4cf79f0b693322b1272efd7cba6baffd3877a1cd))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.30a..2.026.33
<!-- generated by git-cliff -->
