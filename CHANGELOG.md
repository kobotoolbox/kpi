> ⚠️ **DRAFT** — this changelog is auto-generated on every push and may be inaccurate (e.g. include commits from untagged patches). It will be regenerated authoritatively at tag time. Please wait until after tagging before making manual edits.


<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (42)</summary>

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

- **accounts**: expose `validated_password` on the session endpoint ([#7649](https://github.com/kobotoolbox/kpi/pull/7649))
    > <!-- 📣 Summary -->
    > Adds `has_validated_password` to the allauth session endpoint so the
    > frontend can read the invalidated-password signal there instead of
    > `/me`.
    > 
    > <!-- 📖 Description -->
    > An administrator can invalidate a user's password from the admin, which
    > locks them out of KPI until they reset it. The SPA shows a blocker for
    > this, and today it reads the flag from `/me`, which is why `/me` is
    > exempt from the permission
    > class that enforces it.
    > 
    > We settled that `/me` is a profile endpoint and the session endpoint
    > owns authentication state. This flag was the one thing still breaking
    > that rule.
    > 
    > This PR adds `data.user.has_validated_password` to `GET
    > /api/v2/allauth/browser/v1/auth/session`, via a `HeadlessAdapter` wired
    > up through allauth's documented `HEADLESS_ADAPTER` setting. Declaring it
    > on the
    > user dataclass (rather than overriding `serialize_user()`) is what
    > allauth's docs prescribe, and it means the field lands in the OpenAPI
    > schema and the generated orval types automatically.
    > 
    > Nothing about how the flag is set or enforced changes. `/me` keeps
    > returning `validated_password` for API back-compat.

- **admin**: add bulk action to mark users active ([#7692](https://github.com/kobotoolbox/kpi/pull/7692))
    > <!-- 📣 Summary -->
    > Superusers can now reactivate several user accounts at once from the
    > Django admin, just as they can already deactivate them.
    > 
    > <!-- 📖 Description -->
    > On the Django admin users page, the "Action" dropdown had "Mark selected
    > users inactive" but no way to undo it in bulk. Each account had to be
    > opened and reactivated one by one. A new action, "Mark selected users
    > active", now reactivates all selected accounts in one go.
    > 
    > The dropdown also adapts to the "By active" filter. When you're looking
    > at inactive users, it offers only "Mark selected users active". When
    > you're looking at active users, it offers only "Mark selected users
    > inactive".
    > 
    > Accounts that are in the trash bin, or have already been removed, are
    > never reactivated by this action. The admin gets a warning saying how
    > many were skipped, with a link to the trash bin, where they can be
    > restored properly.

- **audioPlayer**: add tooltips to play and pause buttons in audio players ([#7705](https://github.com/kobotoolbox/kpi/pull/7705))
    > <!-- 📣 Summary -->
    > 
    > Audio play and pause buttons now show a tooltip on hover, both in the
    > Data Table and in the audio player used in "View details" and other
    > submission views.

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

- **auth**: update activation email copy ([#7653](https://github.com/kobotoolbox/kpi/pull/7653))
    > <!-- 📣 Summary -->
    > Updates copy in activation email to draw attention to our free
    > KoboToolbox essentials course.

- **auth**: login form ([#7630](https://github.com/kobotoolbox/kpi/pull/7630))
    > <!-- 📣 Summary -->
    > 
    > New sign-in screen. Hidden behind the `authRedesignEnabled` feature
    > flag.

- **auth**: reset password form ([#7636](https://github.com/kobotoolbox/kpi/pull/7636))
    > <!-- 📣 Summary -->
    > 
    > The redesigned sign-in screens can now recover a forgotten password: ask
    > for a reset link by email, then pick a new password from the link in
    > that email.

- **auth**: allow switching accounts via headless login ([#7682](https://github.com/kobotoolbox/kpi/pull/7682))
    > <!-- 📣 Summary -->
    > Logging in through the headless API while already signed in now switches
    > to the new account, instead of being rejected. A failed attempt keeps
    > the current user signed in.
    > 
    > <!-- 📖 Description -->
    > allauth's headless `auth/login` answers `409` whenever a session already
    > exists. The SPA would have had to log out first, which signs the user
    > out even when the new credentials turn out to be wrong. The templated
    > `/accounts/login/` page already lets you switch accounts, and product
    > asked to keep that behaviour.
    > 
    > `HeadlessLoginView` replaces allauth's login endpoint for each
    > configured headless client (`browser` and `app`). allauth checks the
    > credentials before `post()` runs, so:
    > 
    > | Already signed in, then… | Response | Current session |
    > |---|---|---|
    > | valid credentials for another user | 200, new user | logged out |
    > | wrong password | 400 | kept |
    > | own credentials again | 200 | kept |
    > | valid credentials for a user with 2FA | 401, pending
    > `mfa_authenticate` | logged out |

- **auth**: mfa form ([#7640](https://github.com/kobotoolbox/kpi/pull/7640))
    > <!-- 📣 Summary -->
    > 
    > Accounts with two-factor authentication can now finish signing in on the
    > redesigned login screen. Hidden behind feature flag.

- **auth**: allauth views in router ([#7644](https://github.com/kobotoolbox/kpi/pull/7644))
- **auth**: handling SSO registration flow ([#7647](https://github.com/kobotoolbox/kpi/pull/7647))
    > <!-- 📣 Summary -->
    > 
    > You can now sign up with a single sign-on provider from the new login
    > screen, filling in only the details your provider didn't already give
    > us.

- **auth**: watch every allauth response for status ([#7672](https://github.com/kobotoolbox/kpi/pull/7672))
- **auth**: handle 401 from all sources ([#7687](https://github.com/kobotoolbox/kpi/pull/7687))
    > <!-- 📣 Summary -->
    > 
    > An expired or ended session is now noticed right away, instead of the
    > app acting signed-in for up to a minute longer.

- **auth**: update email flow ([#7694](https://github.com/kobotoolbox/kpi/pull/7694))
    > <!-- 📣 Summary -->
    > 
    > Changing your account email address gives better feedback: the buttons
    > stay busy while a change is in flight, and a refusal from the server is
    > shown instead of being swallowed.

- **auth**: update sso management flow ([#7695](https://github.com/kobotoolbox/kpi/pull/7695))
    > <!-- 📣 Summary -->
    > 
    > Connecting and disconnecting SSO in Account Settings → Security now runs
    > through the new authentication system, and explains itself when a
    > connection attempt fails.
    > 
    > <!-- 📖 Description -->
    > 
    > The section looks the same, but two things improve. A failed attempt —
    > cancelled at the provider, or the provider account already belongs to
    > somebody else's KoboToolbox account — now shows a specific message
    > instead of silently returning you to an unchanged page. And if your
    > provider is configured as non-public, the section names it ("Connected
    > to Example Org") rather than stating that something, somewhere, is
    > connected.

- **auth**: TOS signup checkbox ([#7702](https://github.com/kobotoolbox/kpi/pull/7702))
    > <!-- 📣 Summary -->
    > 
    > Behind feature flag! Fixed account creation being impossible on servers
    > that require agreeing to TOS but don't publish a link to them — the
    > agreement checkbox was missing, so every submission was rejected.

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

- **frontend**: profile details route blocker ([#7615](https://github.com/kobotoolbox/kpi/pull/7615))
    > <!-- 📣 Summary -->
    > 
    > Required blank profile details cause a whole UI to be blocked until they
    > are filled in immediately after log in.

- **frontend**: auth status tracking ([#7656](https://github.com/kobotoolbox/kpi/pull/7656))
    > <!-- 📣 Summary -->
    > 
    > Signing in now returns you to the page you were trying to reach, and the
    > app notices when your session changes in another tab. Hidden behind
    > feature flag.

- **openapiValidator**: add OpenAPI request/response validation middleware ([#7314](https://github.com/kobotoolbox/kpi/pull/7314))
    > <!-- 📣 Summary -->
    > 
    > The API and its published documentation are now checked against each
    > other automatically, so the API documentation stays accurate.
    > 
    > <!-- 📖 Description -->
    > 
    > KoboToolbox publishes a description of its API that integrations and
    > third-party tools rely on. Until now nothing verified that the API
    > really matches it, so the two could drift apart unnoticed. Requests and
    > responses are now compared against that description automatically and
    > any difference is reported to the team, so it gets fixed instead of
    > reaching the documentation. Nothing changes in how the product behaves
    > today.

- **organizations**: make sso column available to all ([#7562](https://github.com/kobotoolbox/kpi/pull/7562))
    > <!-- 📣 Summary -->
    > 
    > Every team now sees the `SSO` column in the Members table, showing which
    > members sign in through single sign-on.

- **pagination**: add limited-count pagination class ([#7703](https://github.com/kobotoolbox/kpi/pull/7703))
    > <!-- 📣 Summary -->
    > Prepares faster lists on very large accounts: the server can now stop
    > counting results past a set limit. Nothing changes for users yet.
    > 
    > <!-- 📖 Description -->
    > Some lists count every matching item before showing a page, which gets
    > slow on very large accounts. This adds the piece that lets a list stop
    > counting at a limit and report "many" instead of an exact number, or
    > "unknown" if counting takes too long.
    > 
    > It ships switched off. The limit is set so high that every list behaves
    > exactly as it does today. Lists will start using it, and the limit will
    > come down, in later changes once the interface is ready. The server
    > settings endpoint (`/api/v2/environment/`) now reports the limit, so
    > apps and integrations can show labels like "4999+".

- **processing**: hide Transcript tab for text questions ([#7512](https://github.com/kobotoolbox/kpi/pull/7512))
    > <!-- 📣 Summary -->
    > 
    > The Processing view now only shows the "Transcript" tab for questions
    > that actually have something to transcribe.

- **processing**: add auto_accept option to bulk transcription and translation jobs ([#7662](https://github.com/kobotoolbox/kpi/pull/7662))
    > <!-- 📣 Summary -->
    > Bulk transcription and translation jobs can now approve their results
    > automatically, so there is no need to open and save each transcript or
    > translation one by one.
    > 
    > <!-- 📖 Description -->
    > When starting a bulk transcription or translation, the request can ask
    > for the generated results to be approved as soon as they are ready.
    > Approved results appear directly in the data table and in exports,
    > without the extra "Review" step. The option is off by default; the
    > matching checkbox in the interface comes in a separate change.

- **processing**: enable NLP actions for text questions by removing feature flag ([#7693](https://github.com/kobotoolbox/kpi/pull/7693))
    > <!-- 📣 Summary -->
    > 
    > Text questions can now be translated and analyzed in qualitative
    > processing for everyone. They were previously available only behind a
    > feature flag.

- **qual**: enable AI answer feature for text questions ([#7643](https://github.com/kobotoolbox/kpi/pull/7643))
    > <!-- 📣 Summary -->
    > 
    > The "Generate with AI" button is now available in the Analysis tab for
    > text questions.

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

- **supportTools**: record form versions in submissions that spanned several versions ([#7710](https://github.com/kobotoolbox/kpi/pull/7710))
    > <!-- 📣 Summary -->
    > Support can now repair the form version history of submissions that were
    > edited or sent after a new form version was deployed.
    > 
    > <!-- 📖 Description -->
    > Each submission now records every form version it went through, so that
    > its answers can be read against the questions of each of those versions.
    > Submissions that were edited under a newer version, or collected offline
    > with an older one, before that release carry no such history. Support
    > can now rebuild it for a whole project, from the edit history of each
    > submission and the dates each version was deployed. A run only reports
    > what it would change unless it is told to write, and it can be followed
    > by the attachment restore, which then finds files stored under a
    > question only an intermediate version had.
    > 
    > A submission collected offline with an older form version and sent after
    > a newer one was deployed now records only the version it was collected
    > with. Very old submissions, which name their form version in older
    > fields, keep it when they are edited, and exports no longer leave out
    > the ones whose version was merged into another one.
    > 
    > ### 👷 Description for instance maintainers
    > - New management command `restore_formversions_in_submissions
    > --asset-uid <uid>`. It is a dry run unless `--no-dry-run` is passed.
    > `--no-resume` starts over instead of resuming an interrupted run, and
    > `--restore-attachments` runs `restore_soft_deleted_attachments` on the
    > same project once every submission is walked. `-v 2` logs each batch,
    > `-v 3` how each submission history is rebuilt.
    > - New Django admin page "Form versions restore", next to "Attachment
    > restore", so support can launch and follow a run without shell access.
    > The run goes to `kpi_low_priority_queue`, writes its log and counts back
    > on the row, and re-queues itself when it hits the soft time limit.
    > 
    > ⚠️ **breaking changes:** `--email` is removed from
    > `restore_soft_deleted_attachments`: launching it from the admin, where
    > the log is kept on the job row, replaces it.

- feat(theme): add 24px xl spacing and per-size input label sizes 
Mantine's spacing scale jumps from 20px to 32px, so there was no 24px rung
for the new auth designs. `xl` now fills it and `xxl` keeps the 32px that
used to be `xl`, which is why the existing `xl` call sites move to `xxl`.

Input labels also stop being a fixed 12px: `InputWrapper` derives the size
from the field's own `size` prop, so one theme entry covers TextInput,
Select, Textarea and the rest.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com> ([3c1b004](https://github.com/kobotoolbox/kpi/commit/3c1b004030ef086d305dafb482784e143e01cff4))
</details>

<details><summary>Bug Fixes (27)</summary>

- **CI**: add concurrency handling for storybook deploys ([#7633](https://github.com/kobotoolbox/kpi/pull/7633))
    > <!-- 📖 Description -->
    > 
    > Add concurrency management to the Storybook deploy workflow.
    > 
    > Without this, two runs racing to deploy GitHub Pages could fail with
    > "deployment request failed due to in progress deployment." Using
    > `cancel-in-progress: false` queues the second run rather than canceling
    > it to avoid interrupting an ongoing Pages deployment.
    > 
    > See original error
    > [here](https://github.com/kobotoolbox/kpi/actions/runs/35876747188/job/107242043932).

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

- **api**: correct extra_details schema on `/me` ([#7655](https://github.com/kobotoolbox/kpi/pull/7655))
    > <!-- 📣 Summary -->
    > Adds the missing gender field to the documented `extra_details` shape on
    > `/me` and types `newsletter_subscription` as the boolean it actually is.
    > 
    > <!-- 📖 Description -->
    > `extra_details` on `/me` is a free-form JSON blob, so drf-spectacular
    > cannot inspect it and its shape is written out by hand in
    > `ExtraDetailField`. That hand-written description had drifted from the
    > fields it describes:
    > 
    > - `gender` was missing entirely, though it is a supported metadata field
    > - `newsletter_subscription` was documented as a string, but it is
    > declared `forms.BooleanField` and the API returns `true`/`false`
    > 
    > This PR corrects both properties and regenerates the schema and orval
    > output.

- **assets**: do not allow extra fields in data sharing ([#7631](https://github.com/kobotoolbox/kpi/pull/7631))
    > <!-- 📣 Summary -->
    > Return an error if a request to update the asset contains invalid fields
    > in the `data_sharing` parameter

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

- **frontend**: drop audit column and place start-geopoint with metadata ([#7603](https://github.com/kobotoolbox/kpi/pull/7603))
    > <!-- 📣 Summary -->
    > 
    > The `audit` metadata question is no longer a column in Data Table nor a
    > row in a single submission, and the start geopoint column now sits with
    > the rest of the metadata at the end of the table.

- **frontend**: Always show project name in browser tab title ([#7606](https://github.com/kobotoolbox/kpi/pull/7606))
    > <!-- 📣 Summary -->
    > Fix browser tab titles on project pages so they consistently include the
    > project name and current section, making tabs easier to identify across
    > project views.
    > 
    > <!-- 📖 Description -->
    > This change updates the browser tab titles for project-related routes so
    > they consistently include the project name and the relevant section,
    > instead of showing generic or incomplete titles.

- **frontend**: improve media and nlp reading from submission ([#7642](https://github.com/kobotoolbox/kpi/pull/7642))
    > <!-- 📣 Summary -->
    > 
    > Answers, files and transcripts collected before a question was renamed
    > or moved in the form are now shown with the question they were actually
    > given to.
    > 
    > <!-- 📖 Description -->
    > 
    > We already show these older answers. It finds them by matching question
    > names and file names, and those matches can land on the wrong question:
    > two questions in different groups can share a name, and two answers can
    > name the same file. The front end now goes by the question path stored
    > with each submission, so an old answer is shown in the right place or
    > not at all.

- **frontend**: cleanup account fields related code ([#7611](https://github.com/kobotoolbox/kpi/pull/7611))
    > <!-- 📣 Summary -->
    > 
    > Fixed the spacing between profile fields in Account Settings on narrow
    > screens.

- **frontend**: keep asset up to date in PermProtectedRoute ([#7664](https://github.com/kobotoolbox/kpi/pull/7664))
    > <!-- 📣 Summary -->
    > 
    > Fixed sorting and column visibility in the data table not applying until
    > the page was reloaded.

- **frontend**: Prevent duplicate alerts and network requests within share form ([#7621](https://github.com/kobotoolbox/kpi/pull/7621))
    > <!-- 📣 Summary -->
    > If a username is entered multiple times within the share form, and they
    > do not exist, the form now does not perform additional checks to see if
    > they exist, since we already discovered that during the initial time
    > they were entered.

- **frontend**: long text breaking ellipsis in safari ([#7668](https://github.com/kobotoolbox/kpi/pull/7668))
    > <!-- 📣 Summary -->
    > 
    > Long transcripts no longer show an empty cell with just `…` in the data
    > table when using Safari.

- **library**: avoid null legacy router crash in library stores ([#7673](https://github.com/kobotoolbox/kpi/pull/7673))
- **openapi**: allow null in asset summary languages ([#7641](https://github.com/kobotoolbox/kpi/pull/7641))
    > <!-- 📣 Summary -->
    > The API documentation now shows that a project's language list can
    > include an unnamed language.
    > 
    > <!-- 📖 Description -->
    > If a form mixes named translations (like "English (en)") with labels
    > that have no language, the project's language list has an empty entry
    > for the unnamed one. The API already returns that entry, but the
    > documentation said every entry was text. Now the two match.

- **organizations**: make sso orderable, align labels ([#7665](https://github.com/kobotoolbox/kpi/pull/7665))
    > <!-- 📣 Summary -->
    > 
    > The SSO column in the Members table can now be sorted, and its header
    > matches the rest of the row.

- **processing**: disable access to processing for repeat group answers ([#7661](https://github.com/kobotoolbox/kpi/pull/7661))
    > <!-- 📣 Summary -->
    > 
    > Answers inside repeat groups can no longer be opened in qualitative
    > processing, which doesn't support them yet. The data table and the
    > single submission view now show a disabled button that explains why.

- **processing**: stop deleted transcripts reappearing in data table ([#7684](https://github.com/kobotoolbox/kpi/pull/7684))
    > <!-- 📣 Summary -->
    > 
    > Deleting a transcript now removes it from the data table and exports for
    > good.
    > 
    > <!-- 📖 Description -->
    > 
    > When a question had been transcribed both automatically and manually,
    > deleting the transcript could make an older automatic version reappear
    > in the data table and in exports. The deleted transcript now stays
    > deleted everywhere. The same fix applies to translations.

- **projectTopTabs**: Project top tabs accurately underlines the current ([#7669](https://github.com/kobotoolbox/kpi/pull/7669))
    > <!-- 📣 Summary -->
    > The top tabs in the form summary/data/settings/media tabs' underline now
    > follows the correct page

- **queryParser**: reserve every Django field lookup in list queries ([#7589](https://github.com/kobotoolbox/kpi/pull/7589))
    > <!-- 📣 Summary -->
    > 
    > Searching a list field with an operator the list syntax cannot run, for
    > example `summary__languages[]__istartswith:Eng`, now returns an error
    > instead of silently matching nothing.

- **repostgres**: restore attachments instead of crashing ([#7691](https://github.com/kobotoolbox/kpi/pull/7691))
    > <!-- 📣 Summary -->
    > The submission recovery tool for server administrators no longer fails
    > on submissions with attached files.
    > 
    > <!-- 📖 Description -->
    > When the tool restored a submission with attachments (photos, audio,
    > etc.), it stopped with an error and restored nothing. It now restores
    > the files with the submission's original date and counts them in the
    > project's storage usage.

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

- **sso**: allow managed domains on headless SSO signup ([#7670](https://github.com/kobotoolbox/kpi/pull/7670))
    > <!-- 📣 Summary -->
    > On the new login screens, people whose organization requires single
    > sign-on can now finish creating their account through SSO, instead of
    > being blocked by a message telling them to sign up through SSO. The
    > existing signup pages were not affected.
    > 
    > <!-- 📖 Description -->
    > Some organizations ask us to manage their Kobo accounts entirely through
    > their own login system (SSO) — so that when someone leaves and IT
    > disables them there, they immediately lose Kobo access too. For those
    > organizations we block password accounts on their email domains, and
    > tell anyone who tries to use SSO instead.
    > 
    > That message was also being shown to people who were already signing up
    > through SSO. This only happened on the new API that the redesigned login
    > screens use — the signup pages in use today have always worked
    > correctly. On that new path the email field is pre-filled and read-only,
    > so there was nothing the person could do about it and the signup could
    > not be completed. They now get through, and the password restriction
    > still applies everywhere it should.
    > 
    > ### 👷 Description for instance maintainers
    > Headless API only. The HTML signup pages were never affected and are
    > untouched.
    > 
    > `SignupExtraFieldsForm` is our `ACCOUNT_SIGNUP_FORM_CLASS`, which
    > allauth injects as a base class of *every* signup form — including the
    > headless provider-signup input. Its `clean()` called
    > `validate_email_domain()` without `allow_managed_domains`, so SSO
    > signups on `POST .../auth/provider/signup` got the password-signup
    > policy. The
    > HTML pages escape this twice over: `SocialSignupForm.clean_email()`
    > passes the flag, and `KoboSignupMixin.clean()` skips this `clean()`
    > entirely. Registering a form of our own would not help, since
    > `ProviderSignupView` hardcodes its input class and ignores
    > `SOCIALACCOUNT_FORMS`.
    > 
    > `clean()` now waives the managed-domain rule when the form carries a
    > pending `SocialLogin`, and on that path requires the submitted address
    > to match the one the provider vouched for — the pairing
    > `SocialSignupForm.clean_email()` already has, and what keeps the waiver
    > safe, since the address is only an initial value here. The blacklist and
    > allowlist checks, and the password signup path, are unchanged.

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

<details><summary>Performance (1)</summary>

- **billing**: compute usage balances once per limit check ([#7637](https://github.com/kobotoolbox/kpi/pull/7637))
    > <!-- 📣 Summary -->
    > Checking whether a project owner is over their plan limit now does less
    > repeated work in some submission paths.
    > 
    > <!-- 📖 Description -->
    > When a submission comes in, the server checks whether the project owner
    > is over their submission or storage limit. Some paths, like imports and
    > backups, worked out the owner's usage more than once for the same check.
    > They now do it once. Which submissions get accepted or refused stays the
    > same.

</details>

<details><summary>Continous Integration (3)</summary>

- **releases**: don't sometimes skip linear release linking ([#7592](https://github.com/kobotoolbox/kpi/pull/7592))
- **releases**: pin nonprod releases to custom helm version INFRA-592 ([#7634](https://github.com/kobotoolbox/kpi/pull/7634))
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

<details><summary>Refactor (13)</summary>

- **auth**: transform session to profile store ([#7548](https://github.com/kobotoolbox/kpi/pull/7548))
- **auth**: make more generic AuthAside, and AuthPageFrame ([#7612](https://github.com/kobotoolbox/kpi/pull/7612))
- **dataTable**: decouple DataTableCell from react-table ([#7689](https://github.com/kobotoolbox/kpi/pull/7689))
- **enketo**: remove broken enketo_flush_cached_preview task ([#7678](https://github.com/kobotoolbox/kpi/pull/7678))
    > <!-- 📣 Summary -->
    > 
    > Removed a background cleanup job that ran after every form preview and
    > never worked.
    > 
    > <!-- 📖 Description -->
    > 
    > Opening a form preview used to schedule a cleanup job for 30 minutes
    > later. That job failed almost every time, so all it did was add errors
    > on the server. It's gone now, and previews work exactly as before.

- **formSidebar**: typescriptize formViewSideTabs ([#7607](https://github.com/kobotoolbox/kpi/pull/7607))
    > <!-- 📣 Summary -->
    > Updates old component to typescript

- **frontend**: tsify FormSubScreens ([#7581](https://github.com/kobotoolbox/kpi/pull/7581))
- **frontend**: tsify and move formLanding ([#7593](https://github.com/kobotoolbox/kpi/pull/7593))
- **frontend**: move FormSubScreens to mantine and drop Reflux ([#7610](https://github.com/kobotoolbox/kpi/pull/7610))
    > <!-- 📣 Summary -->
    > Updates the frontend logic for the sidebar in the form view

- **frontend**: route blockers cleanup ([#7614](https://github.com/kobotoolbox/kpi/pull/7614))
- **library**: move new library item modal to mantine ([#7519](https://github.com/kobotoolbox/kpi/pull/7519))
    > <!-- 📣 Summary -->
    > Part of ongoing frontend upgrades. Moves old library modal for creating
    > a new library item to mantine

- **preview**: move enketo preview to mantine ([#7626](https://github.com/kobotoolbox/kpi/pull/7626))
    > <!-- 📣 Summary -->
    > Refactors the enketo preview modal to use mantine

- **projectsettings**: move Replace Project wrapper to mantine ([#7541](https://github.com/kobotoolbox/kpi/pull/7541))
- **sso**: save in-app message on custom data object ([#7580](https://github.com/kobotoolbox/kpi/pull/7580))
</details>

<details><summary>Chores (4)</summary>

- **formpack**: update formpack version ([#7660](https://github.com/kobotoolbox/kpi/pull/7660))
- **frontend**: create PasswordInput wrapper with stories ([#7481](https://github.com/kobotoolbox/kpi/pull/7481))
- **license**: update license contact information ([#7608](https://github.com/kobotoolbox/kpi/pull/7608))
    > <!-- 📖 Description -->
    > This updates the license to match the changes made in
    > [kobo-install](https://github.com/kobotoolbox/kobo-install/commit/5de9da4c4f29777ec151db93928d8c48acae18a3)

- **pagination**: raise the capped-count default above the largest projects ([#7715](https://github.com/kobotoolbox/kpi/pull/7715))
    > <!-- 📣 Summary -->
    > Keeps exact submission counts on very large projects while capped counts
    > are rolled out.
    > 
    > <!-- 📖 Description -->
    > Lists can now stop counting past a set limit and say "many" instead.
    > That limit was set at one million, but some projects already have more
    > submissions than that, so their data table would show "many" before the
    > app knows how to display it. This raises the default far above the
    > largest projects, so every count stays exact until the limit is
    > deliberately lowered.

</details>

<details><summary>Revert (3)</summary>

- revert 3c1b004030ef086d305dafb482784e143e01cff4 ([#7565](https://github.com/kobotoolbox/kpi/pull/7565))
- revert "update deploy step" ([#7650](https://github.com/kobotoolbox/kpi/pull/7650))
- revert "combine nonprod deploy steps and require existing helm release" ([#7651](https://github.com/kobotoolbox/kpi/pull/7651))
</details>

<details><summary>Other (2)</summary>

- update deploy step ([2047496](https://github.com/kobotoolbox/kpi/commit/20474960a272d882bbc78b4774cad540a2f3c28d))
- combine nonprod deploy steps and require existing helm release ([3a8739b](https://github.com/kobotoolbox/kpi/commit/3a8739bc7bc26610952686c7153ccb33d51668aa))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.37c..2.026.43
<!-- generated by git-cliff -->
