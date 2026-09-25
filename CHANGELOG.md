> ⚠️ **DRAFT** — this changelog is auto-generated on every push and may be inaccurate (e.g. include commits from untagged patches). It will be regenerated authoritatively at tag time. Please wait until after tagging before making manual edits.


<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (1)</summary>

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

</details>

<details><summary>Bug Fixes (3)</summary>

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

</details>

<details><summary>Continous Integration (1)</summary>

- **releases**: pin nonprod releases to custom helm version INFRA-592 ([#7639](https://github.com/kobotoolbox/kpi/pull/7639))
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.37..2.026.37a
<!-- generated by git-cliff -->
