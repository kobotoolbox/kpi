> ⚠️ **DRAFT** — this changelog is auto-generated on every push and may be inaccurate (e.g. include commits from untagged patches). It will be regenerated authoritatively at tag time. Please wait until after tagging before making manual edits.


<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (2)</summary>

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

</details>

<details><summary>Bug Fixes (10)</summary>

- **dataTable**: handle out-of-bounds translation index ([#7419](https://github.com/kobotoolbox/kpi/pull/7419))
    > <!-- 📣 Summary -->
    > 
    > Fixed a crash that prevented the data table from loading for projects
    > where the saved display-language setting referred to a language that no
    > longer exists in the form.

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

<details><summary>Continous Integration (2)</summary>

- **release**: maybe fix a false-positive transifex diff ([#7429](https://github.com/kobotoolbox/kpi/pull/7429))
- **releases**: idempotent transifex pull ([#7466](https://github.com/kobotoolbox/kpi/pull/7466))
</details>

<details><summary>Refactor (1)</summary>

- **massEmails**: fold the send-rate ratio into a single throttle setting ([#7464](https://github.com/kobotoolbox/kpi/pull/7464))
</details>

<details><summary>Styling (1)</summary>

- **imports**: fix formpack/pyxform import classification ([#7460](https://github.com/kobotoolbox/kpi/pull/7460))
</details>

<details><summary>Chores (2)</summary>

- pull transifex translations for 2.026.30b ([064bd30](https://github.com/kobotoolbox/kpi/commit/064bd307fa248b3824950e442b0dbbdecaac3a00))
- pull transifex translations for 2.026.30b ([4cf79f0](https://github.com/kobotoolbox/kpi/commit/4cf79f0b693322b1272efd7cba6baffd3877a1cd))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.30a..2.026.30b
<!-- generated by git-cliff -->
