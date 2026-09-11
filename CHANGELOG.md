> ⚠️ **DRAFT** — this changelog is auto-generated on every push and may be inaccurate (e.g. include commits from untagged patches). It will be regenerated authoritatively at tag time. Please wait until after tagging before making manual edits.


<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (45)</summary>

- **AudioCell**: add view details and open action buttons for audio cells ([#7490](https://github.com/kobotoolbox/kpi/pull/7490))
    > <!-- 📣 Summary -->
    > 
    > Audio responses in the submissions table now have two separate action
    > buttons — "View details" and "Open" — and the inline audio player's
    > timer now shows hours for all recordings.
    > 
    > <!-- 📖 Description -->
    > 
    > The single "Open" button on audio response cells has been split into two
    > icon buttons: a new "View details" icon (placeholder for now) and an
    > "Open" icon that keeps launching the transcript/translation editor as
    > before. The inline mini audio player's time display is now always
    > visible — showing `00:00:00` while the duration isn't known yet, and
    > `--:--:--` if playback fails — and switches to an `HH:MM:SS` format for
    > consistency with the newest designs.

- **AudioCell**: add details dialog for audio responses ([#7492](https://github.com/kobotoolbox/kpi/pull/7492))
    > <!-- 📣 Summary -->
    > 
    > Clicking "View details" on an audio response now opens a dialog with an
    > audio player and a "Translate & analyze" action, instead of doing
    > nothing.
    > 
    > <!-- 📖 Description -->
    > 
    > Adds a reusable `ProcessingPromptModal` dialog and wires it up to the
    > "View details" button on the audio submission data cell. The dialog
    > shows the question label, an inline audio player for the response, and a
    > "Translate & analyze" button that takes the user into the existing
    > Processing view for that submission/question.

- **SSO**: hide password/SSO disable for managed SSO users ([#7489](https://github.com/kobotoolbox/kpi/pull/7489))
    > <!-- 📣 Summary -->
    > Hide password update and disable SSO UI for users with a managed SSO
    > social account.

- **SSO**: confirm modal for managed SSO signup ([#7498](https://github.com/kobotoolbox/kpi/pull/7498))
    > <!-- 📣 Summary -->
    > Adds a confirmation modal for connecting to a managed SSO provider.

- **TextCell**: add NLP action buttons for text questions ([#7494](https://github.com/kobotoolbox/kpi/pull/7494))
    > <!-- 📣 Summary -->
    > 
    > Text question answers in the submissions table now get the same "View
    > details" preview and NLP actions that audio responses already have.

- **accounts**: require re-authentication before email change ([#7525](https://github.com/kobotoolbox/kpi/pull/7525))
    > <!-- 📣 Summary -->
    > Changing the account email now requires the user to have authenticated
    > recently with their password, and also with 2FA when it is enabled.
    > 
    > <!-- 📖 Description -->
    > POST `/me/emails/` already bundled the whole change into one call: add
    > the new address, promote it on confirmation, drop the old one, and send
    > a confirmation link to the new address.
    > 
    > This PR adds the missing piece from the Authentication Redesign spec:
    > re-authentication before a sensitive account change.
    > 
    > #### Browser sessions:
    > Browser sessions re-authenticate through allauth, which records each
    > step in the session. allauth's own `did_recently_authenticate()` was not
    > sufficient because it inspects only the timestamp of the most recent
    > authentication record, whichever method produced it. As a result, a
    > password-only step would satisfy the check even for an account with 2FA
    > enabled.
    > 
    > `kobo/apps/accounts/reauthentication.py` therefore requires every
    > authentication method available to the account to be fresh within
    > `ACCOUNT_REAUTHENTICATION_TIMEOUT` (5 minutes,
    > environment-configurable).
    > 
    > MFA is resolved through KPI's own `MfaAdapter`, so the `MFA_ENABLED`
    > constance flag and active `MfaMethodsWrapper` rows are honoured.
    > 
    > #### Stateless credentials:
    > Stateless credentials such as token, Basic, and OAuth2 authentication
    > have no session for allauth to record a re-authentication in, so there
    > is nothing they can do to satisfy the session check.
    > 
    > Instead, they prove their identity through the request body:
    > ```
    > {
    >  "email": "new@example.com",
    >  "current_password": "…",
    >  "mfa_code": "123456"
    > }
    > ```
    > 
    > `current_password` is required whenever the account has a usable
    > password. `mfa_code` is additionally required when MFA is enabled and
    > accepts either a TOTP code or a recovery code.

- **accounts**: add endpoint for requesting another confirmation email ([#7532](https://github.com/kobotoolbox/kpi/pull/7532))
    > <!-- 📣 Summary -->
    > Adds POST `/api/v2/email-confirmations/`, an unauthenticated endpoint
    > that resends a confirmation link to a registered, unverified email
    > address without revealing whether the address is registered.
    > 
    > <!-- 📖 Description -->
    > Confirmation links expire after a day. Currently, a replacement is sent
    > as a side effect of an unverified user trying to log in; that will be
    > removed, so users need an explicit way to request a new one. The caller
    > has just followed a dead link and has no session, so the endpoint is
    > anonymous. `allauth` has no equivalent: its resend endpoints require
    > either authentication or verification-by-code, which we don't use.
    > 
    > - Enumeration: The same 200 and body are returned whether the address is
    > unverified, already verified, or unknown. Mail is sent only in the first
    > case. Delivery failures are logged rather than raised, since a 5xx would
    > itself confirm
    > that the address is registered.
    > 
    > - Which email: An account with nothing verified yet is being activated
    > and gets the activation email; one that already has a verified address
    > is mid-email-change and gets the address verification email.
    > 
    > - Throttling: ACCOUNT_RATE_LIMITS = False disables allauth's own
    > cooldown, so without a limit this is an open mail relay. Throttling is
    > per requested address, not per caller, so rotating source addresses
    > can't flood one inbox. The limit is the
    > `EMAIL_CONFIRMATION_REQUESTS_PER_HOUR` Constance option (default 5; 0
    > disables).

- **auth**: add auth redesign feature flag ([#7446](https://github.com/kobotoolbox/kpi/pull/7446))
- **auth**: add server configuration props to `/environment` ([#7472](https://github.com/kobotoolbox/kpi/pull/7472))
    > <!-- 📣 Summary -->
    > The settings that control how the sign-in and account creation pages
    > look are now published through the `/environment` API, ahead of those
    > pages being rebuilt in the main application interface. Nothing changes
    > for users yet.
    > 
    > <!-- 📖 Description -->
    > The sign-in and account creation pages are being rebuilt as part of the
    > main application interface rather than as separate server-rendered
    > pages. Those pages currently read their appearance settings, the logo,
    > the background image, the text shown beside the account creation form,
    > directly from the server while the page is being assembled. The rebuilt
    > pages are assembled in the browser instead, so that route is no longer
    > available to them.
    > This publishes the same values through the `/environment` API, which the
    > application already reads when it starts, so the new pages can pick them
    > up. The existing pages are untouched and keep working exactly as they do
    > today.
    > Two values are added that the new designs call for and the server did
    > not previously hold: an image displayed beside the account creation
    > form, and a setting controlling whether the KoboToolbox logo appears.

- **auth**: main skeleton ([#7501](https://github.com/kobotoolbox/kpi/pull/7501))
    > <!-- 📣 Summary -->
    > 
    > Groundwork for the redesigned sign-in and account creation screens.
    > Hidden behind a feature flag.

- **auth**: intermediate confirmation screen for managed SSO domains modifications ([#7522](https://github.com/kobotoolbox/kpi/pull/7522))
    > <!-- 📣 Summary -->
    > This PR introduces an intermediate confirmation page in
    > `SocialAppCustomDataAdmin` when toggling managed SSO or modifying
    > domains.
    > 
    > <!-- 📖 Description -->
    > This includes the following changes: 
    > * Admin confirmation flow (`kobo/apps/accounts/admin.py`):
    > `SocialAppCustomDataAdmin.changeform_view` intercepts saves when managed
    > is toggled or domains are modified under a managed app. The confirmation
    > screen displays status changes (Enabling/Disabling Managed SSO),
    > added/removed domain lists, and plain account counts.
    > * Reusable Queryset Logic (`kobo/apps/accounts/utils.py`):
    > `get_managed_sso_track_1_queryset` returns linked accounts, skipping
    > `sso_exempt=True` and anonymous users.
    > `get_managed_sso_track_2_queryset` returns unlinked accounts with
    > matching email domains. These exclude users with existing InAppMessage
    > records matching `message_type=MessageType.MANAGED_SSO_REMINDER` for
    > idempotence.

- **auth**: read-only REGISTRATION_SSO_ALLOWED_EMAIL_DOMAINS aggregate in Constance ([#7470](https://github.com/kobotoolbox/kpi/pull/7470))
    > <!-- 📣 Summary -->
    > Added a display-only constance setting
    > `REGISTRATION_SSO_MANAGED_EMAIL_DOMAINS` that displays a list of all
    > email domains configured across managed SocialApps. It is located under
    > General Options next to the other `REGISTRATION_*` settings in the
    > Constance Config screen
    > 
    > <!-- 📖 Description -->
    > Registered `REGISTRATION_SSO_MANAGED_EMAIL_DOMAINS` setting in
    > `CONSTANCE_CONFIG` with field type `disabled_textarea` and a note
    > explaining per-app management in Admin > SocialApp. The
    > `disabled_textarea` field type was added to
    > `CONSTANCE_ADDITIONAL_FIELDS`. The signal `
    > update_managed_sso_email_domains()` helper function aggregates email
    > domains from managed SocialApp objects (social_app__managed=True) when
    > they are modified and stores them in the new read only setting in
    > constance.
    > I've also created a data migration to initialize
    > `REGISTRATION_SSO_MANAGED_EMAIL_DOMAINS` for existing database
    > deployments.
    > 
    > ### 👀 Preview Steps
    > 
    > 1. ℹ️ Log in with a superuser / admin account.
    > 2. Navigate to Django Admin > Constance > Config
    > 3. 🟢 Confirm `REGISTRATION_SSO_MANAGED_EMAIL_DOMAINS` is placed directly
    > after `REGISTRATION_BLACKLIST_ERROR_MESSAGE`
    > 4. Navigate to Account Extras > Social app custom datas
    > 6. Toggle `Managed` for a SocialApp and add an email domain
    > 7. Return to Django Admin > Constance > Config
    > 8. 🟢 Confirm `REGISTRATION_SSO_MANAGED_EMAIL_DOMAINS` lists the new
    > domain in read-only format

- **auth**: custom mutator for allauth endpoints ([#7549](https://github.com/kobotoolbox/kpi/pull/7549))
    > <!-- 📣 Summary -->
    > Adds a custom mutator for allauth endpoints to handle expected,
    > non-server-error 4xx responses.

- **bulkProcessing**: improve language blocking ([#7412](https://github.com/kobotoolbox/kpi/pull/7412))
    > <!-- 📣 Summary -->
    > 
    > Fixed bulk translation blocking languages it shouldn't: when a project
    > has transcripts in more than one language for the same question, all of
    > those languages became unavailable as translation targets.
    > 
    > <!-- 📖 Description -->
    > 
    > If some submissions were transcribed in English and others in Spanish
    > for the same question, both English and Spanish disappeared from the
    > language list when starting a bulk translation, leaving no way to
    > translate one into the other. Now only the transcript you're actually
    > translating from counts.

- **designSystem**: move dynamic data attachments modal to mantine ([#7410](https://github.com/kobotoolbox/kpi/pull/7410))
    > <!-- 📣 Summary -->
    > Part of ongoing design system changes to move old components to new
    > themed components. The dynamic data attachment modal has been updated to
    > use mantine

- **designSystem**: update bulk edit submissions form modal to mantine ([#7455](https://github.com/kobotoolbox/kpi/pull/7455))
    > <!-- 📣 Summary -->
    > Update the bulk edit submissions form modal to mantine

- **frontend**: override Switch styles for Formbuilder ([#7426](https://github.com/kobotoolbox/kpi/pull/7426))
- **frontend**: standalone error pages app ([#7438](https://github.com/kobotoolbox/kpi/pull/7438))
    > <!-- 📣 Summary -->
    > 
    > New upcoming 404 and 500 error pages. Not visible to users until
    > switches the error handlers over.

- **frontend**: standalone UI language selector ([#7449](https://github.com/kobotoolbox/kpi/pull/7449))
    > <!-- 📣 Summary -->
    > 
    > A new component for selectin interface language.

- **frontend**: style textarea to match other inputs ([#7285](https://github.com/kobotoolbox/kpi/pull/7285))
    > <!-- 📣 Summary -->
    > 
    > Kobo text inputs now look and behave consistently across `TextInput`,
    > `Textarea`, `NumberInput`, and `PasswordInput`.

- **map**: display points across antimeridian ([#7475](https://github.com/kobotoolbox/kpi/pull/7475))
    > <!-- 📣 Summary -->
    > 
    > Project → Data → Map now keep submissions collected on both sides of the
    > 180th meridian together, and keep showing them while you pan around the
    > world.
    > 
    > <!-- 📖 Description -->
    > 
    > A project with points on both sides of the 180th meridian used to open
    > zoomed out to the whole world, with the data split between the far left
    > and far right edges of the map. The map now reads those coordinates the
    > short way round and opens on the area the data actually covers.
    > 
    > Panning sideways no longer leaves the data behind either: markers,
    > clusters and heat map are drawn in every copy of the world on screen.
    > Auto-fitting also leaves a small margin now, so points on the outer edge
    > of a project's area aren't cut in half by the edge of the map.

- **organizations**: enable sorting for organizations members API ([#7329](https://github.com/kobotoolbox/kpi/pull/7329))
    > <!-- 📣 Summary -->
    > Adds an ordering parameter to the organization members API
    > 
    > <!-- 📖 Description -->
    > The combined list of members and invitees is sorted in
    > `OrganizationMemberViewSet.get_queryset`. The new parameter is also
    > documented and the schema docs were updated. Since the get_queryset
    > method converts the data to lists, the sorting is not done with the ORM
    > but with a call to the sorted funcion.

- **organizations**: add sorting to Members Table ([#7424](https://github.com/kobotoolbox/kpi/pull/7424))
    > <!-- 📣 Summary -->
    > 
    > The Members table columns can now be sorted by name, status, date added,
    > and role.

- **organizations**: display SSO column in Members Table ([#7411](https://github.com/kobotoolbox/kpi/pull/7411))
    > <!-- 📣 Summary -->
    > 
    > The Members table now has an SSO column showing which members sign in
    > through single sign-on.

- **organizations**: add search parameter to org members API ([#7404](https://github.com/kobotoolbox/kpi/pull/7404))
    > <!-- 📣 Summary -->
    > Adding the q parameter query parsing solution to the organizations
    > members API so that frontend can have search filters for the members.
    > 
    > <!-- 📖 Description -->
    > Inside OrganizationMemberViewSet.get_queryset(), when the q parameter is
    > present, we now run parse() twice:
    > * For existing members: Parsed q against `OrganizationUser fields
    > (user__username__icontains, user__email__icontains,
    > user__first_name__icontains, user__last_name__icontains)`
    > * For pending invites: Parsed q against `OrganizationInvitation fields
    > (invitee__username__icontains, invitee__email__icontains,
    > invitee__first_name__icontains, invitee__last_name__icontains,
    > invitee_identifier__icontains)`
    > We explicitly bypassed the global field denylist for this view by
    > specifying custom allowed_lookup_fields (allowing kobo_auth.user fields
    > like first_name and last_name and others mentioned in the ticket). I
    > also include the parameter definition @extend_schema_view to get the
    > correct documentation for the endpoint auto generated.
    > 
    > Since the members API uses two different models (`user` for active
    > members and `invitee` for pending invites), the lookups work like so:
    > * To search ONLY active members: ?q=user__email:luis@example.com
    > * To search ONLY pending invites: ?q=invitee__email:luis@example.com
    > * To search across both groups simultaneously use the generic query
    > (e.g., `q=luis@example.com` which will match any of the allowed fields
    > using `icontains`) without specifying prefixes.

- **organizations**: support q search on organization asset usage ([#7515](https://github.com/kobotoolbox/kpi/pull/7515))
    > ## 📣 Summary
    > Projects in the organization usage table can now be searched by name.
    > 
    > ## 📖 Description
    > The usage page lists every project in the organization. This adds name
    > search to the data behind that table, so the search box coming in
    > can narrow the list instead of always showing everything.
    > 
    > ## 💭 Notes
    > - Reuses the existing `SearchFilter`, chained before
    > `AssetOrganizationUsageFilter` in `OrganizationViewSet.asset_usage`.
    > Bare `q` terms search `name__icontains`.
    > - Fielded queries still go through the query parser's allowlist, and the
    > queryset was already scoped to the org owner, so nothing new is exposed.
    > - Schema and orval client regenerated.
    > 
    > ## 👀 Preview steps
    > 1. Log in as an owner or admin of an org with a few projects.
    > 2. Open `/api/v2/organizations/<org_id>/asset_usage/?q=<part of a
    > project name>`.
    > 
    > 🔴 On main: `q` is ignored and every project comes back.
    > 🟢 On this PR: only projects whose name contains the term (case
    > insensitive). A `q` under 3 characters returns a 400.

- **organizations**: members table search ([#7523](https://github.com/kobotoolbox/kpi/pull/7523))
    > <!-- 📣 Summary -->
    > 
    > The members list of a team or organization can now be searched.
    > 
    > <!-- 📖 Description -->
    > 
    > A search field sits next to the "Members" title. Typing at least three
    > characters filters the list; the search covers name, username and email.
    > When nothing matches, the table says so instead of showing an empty
    > header.

- **queryParser**: filter assets by multiple tags ([#7388](https://github.com/kobotoolbox/kpi/pull/7388))
    > <!-- 📣 Summary -->
    > 
    > Filtering projects by several tags now returns only the projects that
    > have all of them.
    > 
    > <!-- 📖 Description -->
    > 
    > Combining tags in a search (e.g. "foo" and "bar") used to return
    > nothing. It now returns the projects tagged with every tag asked for.
    > Single-tag and "any of these tags" searches are unchanged.

- **sidebar**: add text submission component and update display settings for question types ([ac8dfa7](https://github.com/kobotoolbox/kpi/commit/ac8dfa7f58fa98b01422c84203ab5b983414ecdb))
- **sso**: add managed sso properties ([#7434](https://github.com/kobotoolbox/kpi/pull/7434))
    > <!-- 📣 Summary -->
    > Add necessary fields for managed SSO work to Django admin.
    > 
    > <!-- 📖 Description -->
    > Allows admins to toggle the `managed` property of Social App Custom Data
    > and add/remove associated email domains, as well as mark users as `SSO
    > exempt`. These properties are not currently functional but are added
    > here for ease of development.

- **sso**: do not allow blocked domains in managed sso ([#7444](https://github.com/kobotoolbox/kpi/pull/7444))
    > <!-- 📣 Summary -->
    > Do not allow users to create managed SSO domains using domains that are
    > on the blocklist or, if one is present, not in the allowlist.

- **sso**: restrict how users with managed sso domains can register ([#7447](https://github.com/kobotoolbox/kpi/pull/7447))
    > <!-- 📣 Summary -->
    > Ensure users with an SSO-managed email cannot register using a username
    > and password but can still register with SSO even if registration is
    > otherwise closed.

- **sso**: expose managed sso fields in /environment endpoint ([#7463](https://github.com/kobotoolbox/kpi/pull/7463))
    > <!-- 📣 Summary -->
    > Include information about managed SSO domains in the `/environment`
    > endpoint.

- **sso**: restrict account management of sso-managed accounts ([#7483](https://github.com/kobotoolbox/kpi/pull/7483))
    > <!-- 📣 Summary -->
    > Restrict account management for users with SSO-managed accounts.
    > 
    > <!-- 📖 Description -->
    > Users with SSO-managed accounts are forbidden from setting or changing a
    > password or unlinking their account. An admin cannot add another social
    > account or set a password either, but they may unlink.

- **sso**: add functional index for email domains ([#7508](https://github.com/kobotoolbox/kpi/pull/7508))
    > <!-- 📣 Summary -->
    > Adds a new index to lookup email domains used by the enforce task and
    > the registration checks
    > 
    > <!-- 📖 Description -->
    > When searching for users with specific domains, this index built using
    > the expression `split_part(lower(email), '@', 2)` will help reduce the
    > query execution time by around 21x compared to a sequential scan. This
    > is important for registration checks and also for a enforce background
    > task that will be triggered when an organization adds a managed domain.
    > This task will query auth_user to find all existing user accounts with
    > that domain and enforce SSO restriction rules on them.
    > 
    > ### 👷 Description for instance maintainers
    > Note that the index creation is going to block writes to the auth_user
    > table, so you will have to disable heavy migrations manually if this is
    > a concern for your instance.
    > 
    > **IMPORTANT NOTE:** This index won't be supported by SQLite, only by
    > Postgres.

- **sso**: update InAppMessage for managed sso ([#7516](https://github.com/kobotoolbox/kpi/pull/7516))
- **sso**: actions on adding managed domain ([#7517](https://github.com/kobotoolbox/kpi/pull/7517))
    > <!-- 📣 Summary -->
    > Update users who have managed SSO accounts to limit their login
    > capabilities to that SSO, and notify users with the corresponding domain
    > who do not yet have SSO set up that they need to do so.

- **sso**: optional and customizable in-app message on confirmation page ([#7531](https://github.com/kobotoolbox/kpi/pull/7531))
    > <!-- 📣 Summary -->
    > When enabling managed SSO, admins can now choose whether to send the
    > in-app "connect your SSO account" message, and edit its text before
    > confirming.
    > 
    > <!-- 📖 Description -->
    > When a superuser enables managed SSO or adds a managed domain, the
    > confirmation screen now has a "Send in-app message" checkbox and an
    > editable message prefilled with the default text. Unchecking the box
    > skips the message. When it is checked, the message cannot be empty.

- **sso**: run update task on save managed SSO custom data ([#7528](https://github.com/kobotoolbox/kpi/pull/7528))
    > <!-- 📣 Summary -->
    > Update/notify affected users when SSOs are set to be managed or new
    > domains are added.

- **sso**: enforce SSO restrictions on connecting a managed account ([#7542](https://github.com/kobotoolbox/kpi/pull/7542))
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
    > 9. [x] act on any greptile review below a 5/5 score or leave comment
    > explaining why you won't
    > 10. [ ] delete this checklist section from the final squash commit
    > before merging
    > 
    > <!-- 📣 Summary -->
    > When a user of a managed domain connects their SSO account, disable
    > other login methods and remove any in-app notifications.

- **sso**: add provider detail endpoint ([#7496](https://github.com/kobotoolbox/kpi/pull/7496))
    > <!-- 📣 Summary -->
    > This PR adds a public API endpoint that resolves an SSO provider's URL
    > identifier into its display name, so the upcoming React login screens
    > can render the "Log in with …" page that Django templates render today.
    > 
    > <!-- 📖 Description -->
    > This PR adds GET `/api/v2/social-apps/<provider_id>/`, which returns the
    > `provider_id` and `name` for a configured Social Application.
    > 
    > Some organizations sign in through an SSO provider that is deliberately
    > not shown on the public login page. Its Social Application has
    > `is_public` unchecked, and they distribute a direct link to their own
    > staff, for example: `https://<kobo-server>/accounts/oidc/nca/login/`.
    > Only the `nca` part varies. Today, that URL renders a shared Django
    > template titled "Log in with {{ SocialApp.name }}". The same template is
    > used for every provider on every server.
    > 
    > The Authentication Redesign deletes that template and rebuilds the
    > screen in the SPA. To render it at a route like
    > `#/login/oidc/<provider_id>`, the frontend needs to turn `provider_id`
    > into a display name and distinguish a real provider from a typo so it
    > can show the appropriate 404. The frontend cannot read the database
    > directly, so it needs this endpoint.
    > 
    > Nothing changes for users yet. The existing login pages are untouched.

- **sso**: withdraw reminders when managed SSO is turned off ([#7545](https://github.com/kobotoolbox/kpi/pull/7545))
    > <!-- 📣 Summary -->
    > Turning managed SSO off, removing a managed email domain, or deleting
    > the SSO provider now withdraws the in-app reminders it sent.
    > 
    > <!-- 📖 Description -->
    > When an organization's SSO provider stops being managed, or one of its
    > email domains is removed, users on those domains no longer see the
    > "Update your account" reminder asking them to link their SSO account.
    > They can set a password and link other social accounts again. Deleting
    > the provider itself has the same effect. Reminders left behind by
    > earlier changes are cleared by the nightly job.

- **sso**: make the signup-closed message configurable ([#7544](https://github.com/kobotoolbox/kpi/pull/7544))
    > <!-- 📣 Summary -->
    > Admins can now customize the message shown on the sign-up page when
    > registration is closed.
    > 
    > <!-- 📖 Description -->
    > When account registration is turned off, anyone opening the sign-up page
    > sees a fixed "Sign Up Closed" notice. Admins can now replace that text
    > with their own, for example to point people to their organization's SSO
    > login. If nothing is configured, the default notice stays as it was.

- **subsequences**: run automatic qualitative analysis on text questions ([#7458](https://github.com/kobotoolbox/kpi/pull/7458))
    > <!-- 📣 Summary -->
    > 
    > Automatic qualitative analysis and translation now run on text
    > questions, without needing a transcript first.
    > 
    > <!-- 📖 Description -->
    > 
    > Both features used to read their input from a transcript, so they only
    > worked on audio and video questions. A text question has nothing to
    > transcribe, so they were unavailable there.
    > 
    > They now read the answer straight from the submission when the question
    > is a text question. Audio and video keep working as before, through the
    > transcript. Enabling an action on a question type that doesn't support
    > it, like transcription on a text question, is now refused up front
    > instead of failing later.
    > 
    > Nobody declares what language a typed answer is in, so translation uses
    > the form's own language when it knows it, and otherwise lets the
    > translation service detect it. Very long answers are the exception: they
    > go through a batch API that cannot detect a language, so those ask for
    > the form language to be set.

- **usage**: add support link ([#7459](https://github.com/kobotoolbox/kpi/pull/7459))
    > <!-- 📣 Summary -->
    > 
    > Adds a link to support.

</details>

<details><summary>Bug Fixes (19)</summary>

- **account**: after updating password leave form ([#7478](https://github.com/kobotoolbox/kpi/pull/7478))
    > <!-- 📣 Summary -->
    > 
    > After successfully updating account password, we now redirect back to
    > Security route.

- **accounts**: restrict users to one linked SSO account ([#7224](https://github.com/kobotoolbox/kpi/pull/7224))
    > <!-- 📣 Summary -->
    > 
    > You can now only connect one single-sign-on (SSO) provider to your
    > account at a time; attempting to link a second while one is already
    > connected is blocked with a clear error.
    > 
    > <!-- 📖 Description -->
    > 
    > Previously the "connect SSO" action was only hidden in the UI once an
    > account was linked, but the underlying link was still reachable, so a
    > user could connect a second SSO provider by navigating to it directly.
    > This change enforces the one-SSO-per-account rule on the server, so the
    > restriction holds regardless of how the request is made.
    > 
    > ### 👷 Description for instance maintainers
    > 
    > Adds a `SocialAccountAdapter` (`kobo.apps.accounts.adapter`) overriding
    > `pre_social_login`, registered via the new `SOCIALACCOUNT_ADAPTER`
    > setting. On a `connect` flow, if the authenticated user already has a
    > `SocialAccount` for a *different* provider/uid, the link is rejected and
    > a dedicated error page is rendered via allauth's own
    > `render_authentication_error()` helper (the same helper allauth uses for
    > its other SSO errors) explaining that only one SSO account can be linked
    > at a time. Reconnecting the same account, normal SSO login, and signup
    > are unaffected. The guard sits in allauth's `complete_login` before the
    > account is created, so it covers both the classic redirect flow and the
    > headless API (`/api/v2/allauth/…`).

- **api**: fix schema for Imports Create to support XLS/base64 library upload payload ([#7150](https://github.com/kobotoolbox/kpi/pull/7150))
    > <!-- 📣 Summary -->
    > Fixed the ImportCreateRequestSerializer schema definition to include the
    > missing fields `base64Encoded`, `library`, `desired_type`, `totalFiles`.
    > The OpenAPI and Orval output files were updated to reflect this change.

- **attachments**: match media filenames across unicode normalization forms ([#7467](https://github.com/kobotoolbox/kpi/pull/7467))
    > <!-- 📣 Summary -->
    > 
    > Media files with accented characters in their name now upload and play
    > back instead of vanishing from the data table.
    > 
    > <!-- 📖 Description -->
    > 
    > A recording called something like `Guérisseur.ogg` would upload without
    > any error, then land in the data table as plain text with no way to play
    > or download it. Same thing on edits, and re-uploading never helped.
    > Those files stay attached to their question now.

- **bulkProcessing**: use rootUuid in bulk processing code ([#7420](https://github.com/kobotoolbox/kpi/pull/7420))
    > <!-- 📣 Summary -->
    > 
    > Fixes bulk transcription, translation and approval failing with an
    > "Unknown submission UUIDs" error when the selection included submissions
    > that had been edited.

- **bulkProcessing**: review button showing up wrongly ([#7425](https://github.com/kobotoolbox/kpi/pull/7425))
    > <!-- 📣 Summary -->
    > 
    > The "Review" button for an automatic transcription now appears only in
    > the column of the language it was transcribed into, instead of in every
    > transcript column of that row.

- **celery**: schedule trash bin and project ownership dispatchers on `kpi_queue` ([#7513](https://github.com/kobotoolbox/kpi/pull/7513))
    > <!-- 📖 Description -->
    > Moves four scheduled orchestration tasks from `kpi_low_priority_queue`
    > to `kpi_queue`:
    > 
    > - trash_bin.task_restarter
    > - trash_bin.garbage_collector
    > - project_ownership.task_restarter
    > - project_ownership.garbage_collector
    > 
    > These tasks only enqueue work and finish in milliseconds, but they were
    > scheduled onto the same queue as the long-running deletions and
    > transfers they dispatch. When that queue backs up, the recovery path is
    > stuck behind the backlog it exists to clear.
    > 
    > The deletion and transfer tasks themselves are unchanged and stay on
    > `kpi_low_priority_queue`.

- **designSystem**: change project top tabs to old component ([#7416](https://github.com/kobotoolbox/kpi/pull/7416))
    > <!-- 📣 Summary -->
    > Brings back the old project top tabs compoenent

- **formbuilder**: duplicate imported question name ([#7428](https://github.com/kobotoolbox/kpi/pull/7428))
    > <!-- 📣 Summary -->
    > 
    > Fixed a bug where adding the same question or block from the Library
    > multiple times gave every copy the same data column name in Formbuilder.

- **organizations**: sort role by level of privilege instead of alphabetically ([#7430](https://github.com/kobotoolbox/kpi/pull/7430))
    > <!-- 📣 Summary -->
    > Organizations members are now sorted by level of privilege in the
    > members API when using `ordering=role` (previously they were sorted
    > alphabetically)

- **qrcode**: drop qrcode.react in favour of react-qr-code ([#7499](https://github.com/kobotoolbox/kpi/pull/7499))
    > <!-- 📣 Summary -->
    > Internal frontend updates

- **sso**: allow users to unlink unamanged accounts ([#7539](https://github.com/kobotoolbox/kpi/pull/7539))
    > <!-- 📣 Summary -->
    > Fixes a bug that was preventing users from unlinking unmanaged SSO
    > accounts

- **sso**: fix label in constance ([#7558](https://github.com/kobotoolbox/kpi/pull/7558))
    > <!-- 📣 Summary -->
    > Corrects a label in Constance, pointing users to the correct place to
    > edit managed domains.

- **storybook**: broken test ([#7469](https://github.com/kobotoolbox/kpi/pull/7469))
- **tos**: hide fields for MMO users ([#7491](https://github.com/kobotoolbox/kpi/pull/7491))
    > <!-- 📣 Summary -->
    > 
    > Members of a multi-member organization can now accept the Terms of
    > Service — the form no longer asks them for organization details they
    > aren't allowed to change.

- **trashBin**: give each trash type its own restart budget ([#7514](https://github.com/kobotoolbox/kpi/pull/7514))
    > <!-- 📣 Summary -->
    > Splits `MAX_RESTARTED_TASKS` into three per-type settings for trash bin
    > deletions, and stops `task_restarter` from swallowing its own soft time
    > limit.
    > 
    > <!-- 📖 Description -->
    > Implements the findings from #7422 and supersedes it.
    > 
    > The investigation showed that limiting how many deletions
    > `task_restarter` enqueues does not limit DB pressure: concurrency is set
    > by the size of the worker pool, not by how many messages are published.
    > Two things from #7422 are worth keeping on their own merits, and this PR
    > is just those two.
    > 
    > 1. Per-type restart budgets. _restart_stuck_tasks() sliced all three
    > trash types with settings.MAX_RESTARTED_TASKS, which
    > project_ownership/tasks.py also uses with a different "batch per run"
    > meaning - one shared name, two unrelated behaviours. Each trash type now
    > has its own setting:
    > 
    > - MAX_RESTARTED_ACCOUNT_DELETIONS
    > - MAX_RESTARTED_PROJECT_DELETIONS
    > - MAX_RESTARTED_ATTACHMENT_DELETIONS
    > 
    > All default to 100, so behaviour is unchanged. They are separate because
    > the three deletions do not cost the same.
    > 
    > 2. Do not swallow `SoftTimeLimitExceeded`. In the enqueue block it was
    > caught by the generic except Exception and logged as Could not restart
    > <Model> #<id>, which is wrong on both counts: nothing is wrong with the
    > object, and the restarter had already claimed it, so it sat untouched
    > until the next stuck threshold ~76 minutes later. It now restores
    > `date_modified` and re-raises.

- **trashBin**: suspend owner submissions during project deletion ([#7553](https://github.com/kobotoolbox/kpi/pull/7553))
    > <!-- 📣 Summary -->
    > 
    > Permanently deleting a project or an account no longer fails when that
    > account keeps receiving submissions while the deletion runs.
    > 
    > <!-- 📖 Description -->
    > 
    > While a project is being permanently deleted, incoming submissions for
    > all projects of that project's owner are paused. Data collection apps
    > get the usual "temporarily unavailable" answer and retry on their own,
    > so no data is lost. The pause is lifted as soon as the deletion ends,
    > whether it succeeded or not. Until now a submission arriving in the
    > middle of a deletion could make the deletion fail and get rescheduled.

- **xlsImport**: match project languages to XLSForm languages ([#7417](https://github.com/kobotoolbox/kpi/pull/7417))
    > <!-- 📣 Summary -->
    > 
    > Re-uploading an XLSForm now sets the project languages to exactly the
    > languages of the uploaded file, instead of keeping languages that were
    > removed from it.
    > 
    > <!-- 📖 Description -->
    > 
    > Uploading a form with three languages and re-uploading it with two used
    > to leave the third language defined with empty strings, and removing all
    > languages created an unnamed language. Project languages now always
    > match the file: a language stays only if at least one `survey` or
    > `choices` column still uses it, and a file with plain `label` columns
    > brings the project back to "no languages defined".

- **xlsImport**: block translated XLSForm missing language-specific columns ([#7473](https://github.com/kobotoolbox/kpi/pull/7473))
    > <!-- 📣 Summary -->
    > 
    > Uploading an XLSForm that has translations but leaves some columns
    > untranslated (like a plain `hint` next to `label::English (en)`) is now
    > blocked with a clear error instead of creating a broken project.
    > 
    > <!-- 📖 Description -->
    > 
    > Until now, importing such a form quietly added an "Unnamed language" to
    > the project, which could break the form builder, or silently dropped the
    > missing translations. The import now fails right away with a message
    > naming the column, e.g. "The `hint` column is not translated". Forms
    > with no translations at all import as before.

</details>

<details><summary>Performance (1)</summary>

- **attachments**: parse form media xpaths with ElementTree ([#7579](https://github.com/kobotoolbox/kpi/pull/7579))
    > <!-- 📣 Summary -->
    > 
    > Submitting to a large project is faster, and a malformed form no longer
    > fails the submission it was carrying.
    > 
    > <!-- 📖 Description -->
    > 
    > Every submission that arrives has its form read to find out which
    > questions can hold a file. That reading was rebuilding the whole form
    > each time, work that was thrown away immediately afterwards. It now
    > reads only what it needs, which takes about a tenth of the time on a big
    > project.

</details>

<details><summary>Continous Integration (1)</summary>

- **du**: remove du as a pipeline trigger INFRA-598 ([#7484](https://github.com/kobotoolbox/kpi/pull/7484))
</details>

<details><summary>Build & Dependencies (5)</summary>

- **deps**: bump the actions-deps group across 1 directory with 3 updates ([#7471](https://github.com/kobotoolbox/kpi/pull/7471))
- **deps**: bump the actions-deps group across 1 directory with 2 updates ([#7547](https://github.com/kobotoolbox/kpi/pull/7547))
- **deps-dev**: bump fast-uri from 3.1.5 to 3.1.7 ([#7530](https://github.com/kobotoolbox/kpi/pull/7530))
- **frontend**: bump insecure js-yaml versions ([#7427](https://github.com/kobotoolbox/kpi/pull/7427))
    > <!-- 📣 Summary -->
    > 
    > Updated the `js-yaml` dependency to patch a set of denial-of-service
    > advisories.

- **frontend**: bump mobx-react ([#7480](https://github.com/kobotoolbox/kpi/pull/7480))
</details>

<details><summary>Testing (2)</summary>

- **storybook**: improve map stories ([#7503](https://github.com/kobotoolbox/kpi/pull/7503))
- **storybook**: even sturdier fix for flaky map test ([#7518](https://github.com/kobotoolbox/kpi/pull/7518))
</details>

<details><summary>Refactor (9)</summary>

- **assets**: drop deprecated calls to ReactDOM.findDOMnode ([#7495](https://github.com/kobotoolbox/kpi/pull/7495))
    > <!-- 📣 Summary -->
    > Internal improvements for frontend

- **auth**: move sessionStore logout handling to RQ ([#7550](https://github.com/kobotoolbox/kpi/pull/7550))
    > <!-- 📣 Summary -->
    > Removes logout handling from sessionStore and moves it to react query
    > hooks called by components.

- **frontend**: SSOT for columns order ([#7389](https://github.com/kobotoolbox/kpi/pull/7389))
    > <!-- 📣 Summary -->
    > 
    > Columns are now listed in the same order in every place that shows them:
    > Data Table, "hide fields" menu, Single Submission modal, and the field
    > picker in Downloads.

- **frontend**: replace KoboSelect with Mantine Select ([#7408](https://github.com/kobotoolbox/kpi/pull/7408))
    > <!-- 📣 Summary -->
    > 
    > Migrated multiple different selects from deprecated `KoboSelect` to
    > Mantine's `Select`.

- **frontend**: replace react-select with Mantine Select ([#7462](https://github.com/kobotoolbox/kpi/pull/7462))
    > <!-- 📣 Summary -->
    > 
    > A few dropdowns are now unified to look like all the other dropdowns.

- **frontend**: remove TextBox use Mantine ([#7487](https://github.com/kobotoolbox/kpi/pull/7487))
    > <!-- 📣 Summary -->
    > 
    > Text fields across the app now share one consistent look and size, and
    > password fields — including your API key — are revealed with a toggle
    > inside the field itself.

- **library**: typescriptize and de-mixin LibraryNewItemForm ([#7497](https://github.com/kobotoolbox/kpi/pull/7497))
    > <!-- 📣 Summary -->
    > 
    > Update icons in Library "NEW" modal.

- **library**: move template and collection creation modals to mantine ([#7506](https://github.com/kobotoolbox/kpi/pull/7506))
    > <!-- 📣 Summary -->
    > Part of ongoing process to modernize old frontend components. Updates
    > the modals for library creation of collections and templates.

- **project**: typescriptize formSummary ([#7507](https://github.com/kobotoolbox/kpi/pull/7507))
</details>

<details><summary>Styling (2)</summary>

- darker formatting ([0733e62](https://github.com/kobotoolbox/kpi/commit/0733e62762ebea4c670cc125189762a6b7c79ee8))
- format & lint ([9364eeb](https://github.com/kobotoolbox/kpi/commit/9364eebec103f2b5b87c7940e5a079603251b6ef))
</details>

<details><summary>Chores (6)</summary>

- **CODEOWNERS**: add James K to replace Kalvis, remove Jackie, reduce John ([#7505](https://github.com/kobotoolbox/kpi/pull/7505))
- **bulkProcessing**: remove feature flag ([#7439](https://github.com/kobotoolbox/kpi/pull/7439))
- **constants**: refactor loose interval constants into one place ([#7465](https://github.com/kobotoolbox/kpi/pull/7465))
    > <!-- 📣 Summary -->
    > Internal refactor

- **frontend**: drop use-immer ([#7479](https://github.com/kobotoolbox/kpi/pull/7479))
- **frontend**: drop unused dependencies ([#7482](https://github.com/kobotoolbox/kpi/pull/7482))
- **mfa**: remove the django-trench backend dependency ([#7396](https://github.com/kobotoolbox/kpi/pull/7396))
    > <!-- 📣 Summary -->
    > 
    > Internal cleanup — removed an old, unused authentication library. No
    > change to how two-step verification (MFA) works.
    > 
    > <!-- 📖 Description -->
    > 
    > Two-step verification already runs on our current authentication stack;
    > an older library it used to depend on was left behind with no live data
    > still using it. This removes that old library and its leftover database
    > tables. Nothing changes for you — enabling, using, and disabling
    > two-step verification all behave exactly as before.

</details>

<details><summary>Revert (3)</summary>

- revert "remove bulk processing feature flags" ([c5a03a6](https://github.com/kobotoolbox/kpi/commit/c5a03a6712f25202499a1cd1ba5380265e4e8fbe))
- revert "drop unused dependencies" ([465a1e5](https://github.com/kobotoolbox/kpi/commit/465a1e5fd98b6cd38ded424d409be3511049cb72))
- revert "feat(sidebar): add text submission component and update display settings for question types" ([e05ec0f](https://github.com/kobotoolbox/kpi/commit/e05ec0f99602799080bc5f0071d0db2f32f96943))
</details>

<details><summary>Other (2)</summary>

- remove bulk processing feature flags ([3432526](https://github.com/kobotoolbox/kpi/commit/343252668925ace6e67094c3c2be51fff50ec0c7))
- drop unused dependencies ([3c85be5](https://github.com/kobotoolbox/kpi/commit/3c85be544a209c9c208c9c78631af7eb93bb40bd))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.33a..2.026.37
<!-- generated by git-cliff -->
