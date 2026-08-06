> ⚠️ **DRAFT** — this changelog is auto-generated on every push and may be inaccurate (e.g. include commits from untagged patches). It will be regenerated authoritatively at tag time. Please wait until after tagging before making manual edits.


<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (17)</summary>

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

- **dataTable**: deduplicate non-audio attachment columns ([#7268](https://github.com/kobotoolbox/kpi/pull/7268))
    > <!-- 📣 Summary -->
    > 
    > Data Table now safely de-duplicates stale attachment columns not only
    > for audio, but also for image, video, and file questions, so users no
    > longer see duplicate columns after group/path changes.

- **designSystem**: use mantine Tabs component and deprecate our old component ([#7293](https://github.com/kobotoolbox/kpi/pull/7293))
    > <!-- 📣 Summary -->
    > Replace old tabs component with updated one

- **designSystem**: update project top tabs component ([#7335](https://github.com/kobotoolbox/kpi/pull/7335))
    > <!-- 📣 Summary -->
    > Update project top tabs to new component.

- **frontend**: improve Select and MultiSelect UX ([#7353](https://github.com/kobotoolbox/kpi/pull/7353))
    > <!-- 📣 Summary -->
    > 
    > Make all Selects and MultiSelects searchable by default. Also add
    > PageUp, PageDown, Home, and End keyboard navigation to them.

- **massEmails**: add llm requests to mass email queries ([#7303](https://github.com/kobotoolbox/kpi/pull/7303))
    > <!-- 📣 Summary -->
    > Add a Mass email config for sending emails to users who are above
    > various thresholds in LLM usage.

- **massEmails**: get rid of add to send option ([#7342](https://github.com/kobotoolbox/kpi/pull/7342))
    > <!-- 📣 Summary -->
    > Remove the 'Add to daily send' option from the Django admin list page
    > for mass email configs.

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

</details>

<details><summary>Bug Fixes (15)</summary>

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

- **frontend**: notification with multiple error lines layout ([#7297](https://github.com/kobotoolbox/kpi/pull/7297))
    > <!-- 📣 Summary -->
    > 
    > Improve layout of import error notification when multiple lines of text
    > needs to be displayed.

- **myLibrary**: menu overflowing ugly in single collection route ([#7393](https://github.com/kobotoolbox/kpi/pull/7393))
    > <!-- 📣 Summary -->
    > 
    > When viewing a single collection with a small amount of items, the "More
    > actions" menu was being displayed in small scrollable container making
    > it hard to use it. No more.

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

- **profile**: dropdown z-index ([#7304](https://github.com/kobotoolbox/kpi/pull/7304))
    > <!-- 📣 Summary -->
    > Fixes a bug that resulted in the profile dropdown from the nav header
    > being hidden by other components.

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

</details>

<details><summary>Continous Integration (2)</summary>

- **darker**: print the diff so formatting failures are self-explanatory ([#7341](https://github.com/kobotoolbox/kpi/pull/7341))
- **releases**: disambiguate linear keys ([#7399](https://github.com/kobotoolbox/kpi/pull/7399))
</details>

<details><summary>Build & Dependencies (4)</summary>

- **deps-dev**: bump eslint-plugin-storybook from 10.5.4 to 10.5.5 ([#7006](https://github.com/kobotoolbox/kpi/pull/7006))
- **deps-dev**: bump @storybook/addon-a11y from 10.5.4 to 10.5.5 ([#7004](https://github.com/kobotoolbox/kpi/pull/7004))
- **deps-dev**: bump @eslint/compat from 1.4.1 to 2.1.0 ([#7044](https://github.com/kobotoolbox/kpi/pull/7044))
- **deps-dev**: bump postcss-loader from 7.3.4 to 8.2.1 ([#7025](https://github.com/kobotoolbox/kpi/pull/7025))
</details>

<details><summary>Testing (2)</summary>

- **storybook**: concise CI output ([#7281](https://github.com/kobotoolbox/kpi/pull/7281))
- **storybook**: make tests more robust ([#7309](https://github.com/kobotoolbox/kpi/pull/7309))
    > <!-- 📣 Summary -->
    > 
    > Made the `AssetTagsModal` and `FormLanguagesManager` Storybook
    > interaction tests more reliable so they stop failing at random in CI.

</details>

<details><summary>Refactor (6)</summary>

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

- **map**: remove leaflet-omnivore ([#7301](https://github.com/kobotoolbox/kpi/pull/7301))
    > <!-- 📣 Summary -->
    > Replaces defunct leaflet-omnivore package with more targeted
    > dependencies for parsing map overlay data, while also removing support
    > for .wkt files in this context.

- **permissions**: mantineify sharing modal ([#7295](https://github.com/kobotoolbox/kpi/pull/7295))
    > <!-- 📣 Summary -->
    > 
    > Sharing settings were modernized to a Mantine modal flow, with clearer
    > public/anonymous sharing controls, better form validation feedback, and
    > accessibility fixes.

- **projectDownloads**: migrate to orval ([#7250](https://github.com/kobotoolbox/kpi/pull/7250))
</details>

<details><summary>Styling (1)</summary>

- **KMLExport**: sort import and add blank line for darker ([#7340](https://github.com/kobotoolbox/kpi/pull/7340))
</details>

<details><summary>Chores (6)</summary>

- **dependencies**: upgrade fantasticon to 4.1 ([#7321](https://github.com/kobotoolbox/kpi/pull/7321))
- **dependencies**: upgrade immutable package ([#7323](https://github.com/kobotoolbox/kpi/pull/7323))
- **deps**: bump formpack pin for missing-value NLP export fix ([#7345](https://github.com/kobotoolbox/kpi/pull/7345))
- **node**: drop support for node 20 ([#7308](https://github.com/kobotoolbox/kpi/pull/7308))
- **orval**: upgrade Orval to 7.21 ([#7305](https://github.com/kobotoolbox/kpi/pull/7305))
- upgrade drf-spectacular ([#7324](https://github.com/kobotoolbox/kpi/pull/7324))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.30..2.026.32
<!-- generated by git-cliff -->
