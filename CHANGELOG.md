> ⚠️ **DRAFT** — this changelog is auto-generated on every push and may be inaccurate (e.g. include commits from untagged patches). It will be regenerated authoritatively at tag time. Please wait until after tagging before making manual edits.


<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (20)</summary>

- **SelectQuestion**: support text questions in NLP header selector ([#7560](https://github.com/kobotoolbox/kpi/pull/7560))
    > <!-- 📣 Summary -->
    > 
    > The question selector in Data processing now also lists text questions,
    > not just audio, so their responses can be translated and analyzed the
    > same way.

- **accounts**: support custom signup fields on headless API ([#7578](https://github.com/kobotoolbox/kpi/pull/7578))
    > <!-- 📣 Summary -->
    > Adds the two signup fields allauth doesn't know about,
    > `newsletter_subscription` and `terms_of_service`, to its headless signup
    > endpoint so the SPA registration screen can collect
    > 
    > <!-- 📖 Description -->
    > Registration collects two things beyond `username`/`email`/`password`
    > that have to be recorded when the account is created:
    > `newsletter_subscription` and `terms_of_service`. Both were declared
    > only on the form used by the Django HTML page
    > (`ACCOUNT_FORMS['signup']`), which allauth's headless API does not use.
    > 
    > `POST /api/v2/allauth/browser/v1/auth/signup` therefore accepted only
    > three fields, and because Django forms ignore unknown keys, anything
    > else was silently discarded with a success response. The SPA
    > registration screen needs both fields, and consent in particular cannot
    > be deferred until after signup.
    > 
    > This PR moves those two declarations to `ACCOUNT_SIGNUP_FORM_CLASS`, the
    > hook allauth provides for this: it injects the class as a base of every
    > signup form, so the HTML page, the SSO page and the headless API all get
    > the fields. allauth's own schema generator reads the same class, so they
    > land in the OpenAPI schema and the generated orval types with no manual
    > schema work.
    > 
    > The rest of the profile metadata (`name`, `organization`, `sector`,
    > `country`, `gender`) is deliberately left off the API. As agreed with
    > the frontend team, the SPA collects it after login through `PATCH /me/`,
    > which already validates required fields against `USER_METADATA_FIELDS`.
    > That also covers SSO users, who never see a signup form at all, so both
    > kinds of user end up completing their profile in the same place. Those
    > fields stay on `KoboSignupMixin`, which only the HTML and SSO forms use,
    > so the Django registration page is unchanged and keeps collecting
    > everything until future work removes it.
    > 
    > The new class lives in `signup_fields.py` rather than `forms.py` because
    > allauth resolves the setting while `allauth.account.forms` is still
    > importing; pointing it at `forms.py` is a circular import and the app
    > will not boot. `KoboSignupMixin` stays above allauth's classes on the
    > two form classes it is mixed into, which is what lets its
    > `clean_email()` and organization skip-logic keep overriding allauth's
    > behaviour exactly as before.

- **accounts**: send a distinct email when an activation link is resent ([#7605](https://github.com/kobotoolbox/kpi/pull/7605))
    > <!-- 📣 Summary -->
    > Adds a third confirmation email so a resent activation link no longer
    > arrives as an address-verification email, and moves the choice between
    > all three into `AccountAdapter`.
    > 
    > <!-- 📖 Description -->
    > `allauth` ships two confirmation templates and picks between them with a
    > single `signup` flag, so anyone re-requesting an activation link
    > received "KoboToolbox account email address verification" - the wrong
    > email for someone activating a new account.
    > `AccountAdapter.send_confirmation_mail()` now selects between three,
    > using the state of the account rather than the trigger:
    > 
    > | | Template |
    > | --- | --- |
    > | signup | `email_confirmation_signup` |
    > | no verified address yet | `email_confirmation_resend` *(new)* |
    > | already has a verified address | `email_confirmation` |
    > 
    > The rule is account state because the #7532 resend endpoint serves both
    > kinds of user which endpoint fired cannot decide it. That endpoint
    > previously made the same decision itself and passed it through `signup`;
    > it now passes `signup=False` and defers, so the rule lives in one place.
    > 
    > Copy in the new template (`email_confirmation_resend`) is interim.
    > replaces it and adds HTML bodies for
    > all three; the `.txt` files (`email_confirmation_resend_message.txt` and
    > `email_confirmation_resend_subject.txt`) remain as the plain-text
    > alternative.

- **attachments**: restore attachments retired by mistake ([#7596](https://github.com/kobotoolbox/kpi/pull/7596))
    > <!-- 📣 Summary -->
    > 
    > Support can now bring back, project by project, the files that
    > disappeared from a submission moments after being uploaded.
    > 
    > <!-- 📖 Description -->
    > 
    > A file could vanish from its submission right after being sent, with no
    > error and a success returned to the client. It happened whenever the
    > name stored with the file did not match the name written in the
    > submission, which several separate bugs could cause: a name sanitised on
    > the way in, an accented name stored in one unicode form and written in
    > another, or a question renamed between two versions of the form. Each of
    > those was fixed in turn, but none brought back the files already lost.
    > 
    > This adds a way to recover them for one project at a time, on request
    > rather than in bulk, so that a project can be inspected before anything
    > is written and the outcome can be checked against what its owner
    > expects. Restored files return to the data table, attached to their
    > question, with their storage back in the owner's quota.
    > 
    > ### 👷 Description for instance maintainers
    > 
    > Two ways in, both doing the same work on a single project.
    > 
    > A management command, for a shell on the instance:
    > 
    > ```
    > ./manage.py restore_soft_deleted_attachments --asset-uid aBcD1234
    > ./manage.py restore_soft_deleted_attachments --asset-uid aBcD1234 --no-dry-run
    > ./manage.py restore_soft_deleted_attachments --asset-uid aBcD1234 --no-dry-run --email you@example.org
    > ```
    > 
    > It reports without writing anything unless `--no-dry-run` is passed.
    > `--email` mails the log once the run is over, whether it succeeded or
    > not, and can be repeated for several recipients. `--no-resume` ignores
    > where an interrupted run stopped.
    > 
    > And Django admin, for support with no shell access, under a new
    > **Support tools** section: **Attachment restores**
    > (`/admin/support_tools/attachmentrestorejob/`). Adding a row is what
    > launches a run. Fill the project in, leave *Dry run* ticked to see what
    > would come back, untick it to actually restore. The log is written back
    > to the row as the run goes, so there is nothing to configure beyond the
    > project and nothing to go looking for afterwards. A row left unfinished,
    > by an OOM or by a project somebody else had taken, goes back to the
    > queue with the **Run again** action instead of being typed in again.

- **auth**: update SSO copy ([#7564](https://github.com/kobotoolbox/kpi/pull/7564))
- **auth**: shared building blocks for the auth screens ([#7568](https://github.com/kobotoolbox/kpi/pull/7568))
    > <!-- 📣 Summary -->
    > 
    > On instances with a custom login background, the photo is now there as
    > the page opens instead of appearing a moment after Kobo's own
    > background.

- **auth**: add the ResendVerificationLink component ([#7570](https://github.com/kobotoolbox/kpi/pull/7570))
    > <!-- 📣 Summary -->
    > 
    > The account creation and activation screens can now send you a fresh
    > confirmation email, with the address filled in already when they know
    > it.

- **auth**: username and email registration screen ([#7571](https://github.com/kobotoolbox/kpi/pull/7571))
    > <!-- 📣 Summary -->
    > 
    > A redesigned account creation screen: username, email and password,
    > whichever extra profile details the instance asks for, and a "check your
    > inbox" step once the account exists.

- **auth**: confirm email address screen ([#7572](https://github.com/kobotoolbox/kpi/pull/7572))
    > <!-- 📣 Summary -->
    > 
    > The link in your sign-up email opens a redesigned screen that confirms
    > your address and then takes you straight into Kobo, or to the login form
    > if your instance asks you to sign in again.

- **auth**: request a new link when activation fails ([#7573](https://github.com/kobotoolbox/kpi/pull/7573))
    > <!-- 📣 Summary -->
    > 
    > An expired or already used activation link can now be swapped for a new
    > one from the screen that turned it down, instead of starting the sign-up
    > over.

- **csrf**: allow distinct origin config ([#7574](https://github.com/kobotoolbox/kpi/pull/7574))
- **designSystem**: convert single processing view tabs to mantine ([#7356](https://github.com/kobotoolbox/kpi/pull/7356))
    > <!-- 📣 Summary -->
    > Part of series of changes to convert older components to new stylized
    > components. This one affects the tabs in the single processing view

- **frontend**: mantine spacing and label adjustments ([#7566](https://github.com/kobotoolbox/kpi/pull/7566))
    > <!-- 📣 Summary -->
    > 
    > Labels above form fields now scale with the size of the field they
    > belong to, instead of always being the smallest size.

- **frontend**: rename data related labels ([#7583](https://github.com/kobotoolbox/kpi/pull/7583))
    > <!-- 📣 Summary -->
    > 
    > Renamed the labels that used to talk about "data columns" and "XML
    > values" so they now say question, group, and choice names — in
    > Formbuilder, the data table settings, the single submission modal, and
    > the downloads form.

- **frontend**: improve error handling ([#7561](https://github.com/kobotoolbox/kpi/pull/7561))
    > <!-- 📣 Summary -->
    > 
    > Error messages no longer dump raw server output: you either get the
    > message the server actually wrote, or a plain "An error occurred".

- **organizations**: make sso column available to all ([#7562](https://github.com/kobotoolbox/kpi/pull/7562))
    > <!-- 📣 Summary -->
    > 
    > Every team now sees the `SSO` column in the Members table, showing which
    > members sign in through single sign-on.

- **processing**: hide Transcript tab for text questions ([#7512](https://github.com/kobotoolbox/kpi/pull/7512))
    > <!-- 📣 Summary -->
    > 
    > The Processing view now only shows the "Transcript" tab for questions
    > that actually have something to transcribe.

- **sidebar**: add text submission widget for processing view ([#7524](https://github.com/kobotoolbox/kpi/pull/7524))
    > <!-- 📣 Summary -->
    > Added a widget to view the full original response for text questions in
    > the submission processing view.

- **singleSubmissionView**: add Translate & analyze action for text responses ([#7575](https://github.com/kobotoolbox/kpi/pull/7575))
    > <!-- 📣 Summary -->
    > 
    > Text responses in the Single Submission Modal now have a "..." menu with
    > a "Translate & analyze" action, opening Processing for that response —
    > same as audio already offers.

- feat(theme): add 24px xl spacing and per-size input label sizes 
Mantine's spacing scale jumps from 20px to 32px, so there was no 24px rung
for the new auth designs. `xl` now fills it and `xxl` keeps the 32px that
used to be `xl`, which is why the existing `xl` call sites move to `xxl`.

Input labels also stop being a fixed 12px: `InputWrapper` derives the size
from the field's own `size` prop, so one theme entry covers TextInput,
Select, Textarea and the rest.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> ([3c1b004](https://github.com/kobotoolbox/kpi/commit/3c1b004030ef086d305dafb482784e143e01cff4))
</details>

<details><summary>Bug Fixes (13)</summary>

- **ProjectSettings**: disable outside click to close ([#7595](https://github.com/kobotoolbox/kpi/pull/7595))
    > <!-- 📣 Summary -->
    > Improve the UX to remove the ability to close the create new project
    > modal by clicking outside the modal.

- **accounts**: stop resending confirmation emails at headless login ([#7624](https://github.com/kobotoolbox/kpi/pull/7624))
    > <!-- 📣 Summary -->
    > Signing in with an unverified account through the new authentication API
    > no longer sends another activation email automatically. A new link is
    > only sent when it is explicitly asked for.
    > 
    > <!-- 📖 Description -->
    > Until now, every attempt to log in with an account whose email address
    > had not been confirmed quietly triggered a fresh activation email. Users
    > who tried a few times ended up with several near-identical messages in
    > their inbox and no clue which link was the live one.
    > 
    > The redesigned sign-in screen (React SPA + `allauth` headless) replaces
    > that with a button for requesting a new link,
    > so the automatic send is no longer needed and has been removed. Creating
    > an account still sends the activation email as before, and the current
    > sign-in page is unchanged; it keeps sending a fresh link on login until
    > it is retired.
    > 
    > `AccountAdapter.should_send_confirmation_mail()` now returns `False` for
    > headless requests unless the send is part of a signup.

- **backend**: return git version number ([#7597](https://github.com/kobotoolbox/kpi/pull/7597))
    > <!-- 📣 Summary -->
    > Superusers and instances that enable `EXPOSE_GIT_REV` can see the
    > server's git revision in the API again.
    > 
    > <!-- 📖 Description -->
    > The `git_rev` block in the `/me/` response came back as all `false` on
    > servers even with the setting turned on. It now contains the actual
    > commit hashes, branch and tag.

- **dataTable**: make audio accessible after question rename ([#7521](https://github.com/kobotoolbox/kpi/pull/7521))
    > <!-- 📣 Summary -->
    > 
    > Media files (images, audio, video) attached to a question that was later
    > renamed now show up in the data table and submission modal again, and
    > audio among them can be opened in the processing view.

- **formbuilder**: better handling of importing (un)translated blocks from Library ([#7602](https://github.com/kobotoolbox/kpi/pull/7602))
    > <!-- 📣 Summary -->
    > 
    > Fixed adding questions and blocks from the Library into a form: labels
    > are no longer replaced with question names, option labels stay with the
    > language they were written in, and the form still opens in the
    > Formbuilder afterwards.
    > 
    > <!-- 📖 Description -->
    > 
    > Dragging an item out of the Library into an open form means matching the
    > item's languages to the ones the form already has. Three things went
    > wrong there:
    > 
    > - when the item didn't have the form's default language, that column got
    > the question's name instead of the item's own label,
    > - when the form had no named language, the item's languages came along
    > anyway and left the form with an unnamed language next to named ones —
    > the Form Builder refuses to open such a form, and the downloaded XLSForm
    > has its translation columns scrambled,
    > - labels of select options were left behind whenever languages got
    > reordered or added, so they ended up under the wrong language.
    > 
    > Forms already saved in that state aren't repaired here — user needs to
    > name the unnamed language with "Manage translations" from the Project's
    > landing page. Project → Summary now shows "Unnamed language" instead of
    > a blank line, so it's easier to see what's wrong.

- **frontend**: drop audit column and place start-geopoint with metadata ([#7603](https://github.com/kobotoolbox/kpi/pull/7603))
    > <!-- 📣 Summary -->
    > 
    > The `audit` metadata question is no longer a column in Data Table nor a
    > row in a single submission, and the start geopoint column now sits with
    > the rest of the metadata at the end of the table.

- **hooks**: block redirect-based SSRF bypass in webhook delivery and media download ([#7627](https://github.com/kobotoolbox/kpi/pull/7627))
    > <!-- 📣 Summary -->
    > REST Services no longer follow redirects into the server's own network.
    > 
    > <!-- 📖 Description -->
    > The address of a REST Service is always checked before a call, so that
    > data is never sent to an address inside the server's own network. Only
    > the address written on the service was checked though: if it answered
    > with a redirect, the call followed it without a second look, so a public
    > endpoint could hand the delivery on to an internal address, and the
    > internal response ended up in the REST Service logs. Every address in
    > the redirect chain is checked now, and a delivery that redirects
    > somewhere forbidden fails with the usual "is not allowed" log entry.

- **library**: transfer uploaded library items to the organization and let admins delete them ([#7622](https://github.com/kobotoolbox/kpi/pull/7622))
    > <!-- 📣 Summary -->
    > Library items uploaded by a member of a Teams organization now belong to
    > the organization, and organization admins can delete library items from
    > My Library.
    > 
    > <!-- 📖 Description -->
    > In a Teams organization, whatever a member creates belongs to the
    > organization. That was already true for question blocks, templates and
    > collections created from the Library. Items added with the Upload button
    > were the exception: they stayed with the person who uploaded them. They
    > now go to the organization as well, and the uploader can still edit and
    > manage them.
    > 
    > Admins were also missing the Delete option on library items owned by
    > their organization, although they are allowed to delete them. The option
    > is now there, as it is for projects.

- **queryParser**: reserve every Django field lookup in list queries ([#7589](https://github.com/kobotoolbox/kpi/pull/7589))
    > <!-- 📣 Summary -->
    > 
    > Searching a list field with an operator the list syntax cannot run, for
    > example `summary__languages[]__istartswith:Eng`, now returns an error
    > instead of silently matching nothing.

- **sso**: handle toggling of sso-exempt ([#7584](https://github.com/kobotoolbox/kpi/pull/7584))
    > <!-- 📣 Summary -->
    > Enforce managed SSO restrictions on users who lose their sso-exempt
    > status, and remove restrictions/notifications when the exemption is
    > re/instated.
    > 
    > <!-- 📖 Description -->
    > If previously non-exempt users received a notification advising them to
    > link their SSO account, setting them to sso-exempt will remove the
    > notification. If previously exempt users are made non-exempt, they will
    > receive a notification if they do not have a linked account. If they
    > have a linked account, their password and any other SSO logins will be
    > disabled.

- **subscriptions**: handle unparseable values ([#7604](https://github.com/kobotoolbox/kpi/pull/7604))
- **trashBin**: record a real error when a trash deletion fails without one ([#7556](https://github.com/kobotoolbox/kpi/pull/7556))
    > <!-- 📣 Summary -->
    > Deletions from the trash bin that fail now always say why, and the ones
    > that failed silently in the past get one more automatic try.
    > 
    > <!-- 📖 Description -->
    > Some projects, accounts and attachments failed to be deleted from the
    > trash bin with a blank error. Superusers could see they had failed, but
    > not why, and nothing retried them. Every failure now records a message,
    > and the deletions that failed with a blank one are put back in the queue
    > so they run again at the usual pace.

- **usage**: simplify description text in usage page ([#7485](https://github.com/kobotoolbox/kpi/pull/7485))
    > <!-- 📣 Summary -->
    > Remove the dismissable banner from the usage page and have a simple
    > dynamic string explaining the usage page.

</details>

<details><summary>Continous Integration (3)</summary>

- **releases**: don't sometimes skip linear release linking ([#7592](https://github.com/kobotoolbox/kpi/pull/7592))
- **releases**: pin nonprod releases to custom helm version INFRA-592 ([#7639](https://github.com/kobotoolbox/kpi/pull/7639))
- **workflows**: set least-privilege token permissions, scope CodeQL to first-party code ([#7563](https://github.com/kobotoolbox/kpi/pull/7563))
    > <!-- 📣 Summary -->
    > 
    > Internal security hardening of the automated build and release
    > pipelines. Nothing changes in the app itself.
    > 
    > <!-- 📖 Description -->
    > 
    > Each automated job in the code repository now gets only the access it
    > needs to do its work, and the weekly security scan skips bundled
    > third-party libraries so alerts point at code we actually maintain.

</details>

<details><summary>Build & Dependencies (4)</summary>

- **deps**: bump joi ([#7598](https://github.com/kobotoolbox/kpi/pull/7598))
- **deps-dev**: bump @xmldom/xmldom from 0.9.10 to 0.9.12 in the minor-and-patch group across 1 directory ([#7529](https://github.com/kobotoolbox/kpi/pull/7529))
- **deps-dev**: bump svgo from 3.3.4 to 3.3.5 ([#7599](https://github.com/kobotoolbox/kpi/pull/7599))
- **deps-dev**: bump js-yaml from 3.15.1 to 3.15.2 ([#7600](https://github.com/kobotoolbox/kpi/pull/7600))
</details>

<details><summary>Refactor (5)</summary>

- **frontend**: tsify FormSubScreens ([#7581](https://github.com/kobotoolbox/kpi/pull/7581))
- **frontend**: tsify and move formLanding ([#7593](https://github.com/kobotoolbox/kpi/pull/7593))
- **library**: move new library item modal to mantine ([#7519](https://github.com/kobotoolbox/kpi/pull/7519))
    > <!-- 📣 Summary -->
    > Part of ongoing frontend upgrades. Moves old library modal for creating
    > a new library item to mantine

- **projectsettings**: move Replace Project wrapper to mantine ([#7541](https://github.com/kobotoolbox/kpi/pull/7541))
- **sso**: save in-app message on custom data object ([#7580](https://github.com/kobotoolbox/kpi/pull/7580))
</details>

<details><summary>Chores (1)</summary>

- **frontend**: create PasswordInput wrapper with stories ([#7481](https://github.com/kobotoolbox/kpi/pull/7481))
</details>

<details><summary>Revert (1)</summary>

- revert 3c1b004030ef086d305dafb482784e143e01cff4 ([#7565](https://github.com/kobotoolbox/kpi/pull/7565))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.37..2.026.39
<!-- generated by git-cliff -->
