# KPI Translations


## How to use

No action required to make a string translate-able, it's all automated.

To translate a string:
- if your PR was based on the current release branch, go to the Transifex website and it will be there waiting for someone to translate it. The rest is automated.
- if your PR was based on the next release branch or main, the string will not be on Transifex yet. Wait until your commit becomes part of a current release branch first.


## Automation

See automation implementation details at `locale.yml`, `release-2-stabilize.yml` and `release-3-tag.yml`.

Here's how to run those GHA scripts locally, but mind the timing when to do it:

```bash
## Install Transifex CLI
curl -o- https://raw.githubusercontent.com/transifex/cli/master/install.sh | bash
# install transifex api token, see https://app.transifex.com/user/settings/api/

## Install Python dependencies
pipx install uv
uv venv --clear -p 3.10
uv pip sync dependencies/pip/requirements.txt
source .venv/bin/activate

## To build new source strings (see `scripts/generate_locale.sh`)
python manage.py makemessages --locale en
python manage.py makemessages --locale en --domain djangojs
(cd locale; git diff --stat)
# tx push # be careful not to push from the wrong branch, better leave this to CI.

## To pull new translated strings (see `download_translations.bash`):
tx --token $TX_TOKEN pull -a -f --mode reviewed
(cd locale; git diff --stat)
# (cd locale; git add .; git commit -m "chore(locale): update translations from transifex"; git push)
```


## Details

The reasoning here heavily depends on two design choices.

First, that the source translatable strings is in the english language.
In other words, there is no english translation and therefore to update english copy it's required to edit the source code.
That's a tradeoff for simplicity, although KPI considers to use more structured textids instead of english language someday in future.
Note that Transifex [doesn't support changing source language](https://help.transifex.com/en/articles/6208590-is-it-possible-to-change-my-project-s-source-language).

Second, the KPI release process is forward-only, meaning, there are no concurrent active release branches at the same time.
For example, after .47 image is built, no .43x image will ever be built, only .47x ones.

Someday the forward-only assumption will break and it will be required to release an exceptional version on older release branch.
For example, an urgent security patch when not all private servers have updated to the newest minor version.
In such case it will be impossible to update translations, and that's a fine trade-off for the overall simplicity because such security patches will rarely need translations in the first place.

Translation lifecycle is integrated in the release process. Notably:
- if Transifex API is down or errors, it will block a release.
- release process GHAs have serialization enabled (newer run aborts previous run), and that should be sufficient to handle any race-conditions for pushing to Transifex API.

> WIP notice: at the time of writing, these claims are false, but will be solved by future PRs:
> - release tagging is still a manual process and not automated in `release-3-tag.yml` file. Therefore, pull & commit manually before tagging.


### Structure

The Transifex project is called "kobotoolbox" and is available at https://www.transifex.com/kobotoolbox/kobotoolbox/.
  * The `django.po` resource contains strings from the backend `*.py` files
  * The `djangojs.po` resource contains strings from the frontend javascript files


### Timing - when to pull and push translations?

It makes most sense to **pull** translations right before they matter — specifically, right before creating a KPI image.
This is straightforward and avoids potential sync traps.
There's no special rollback for bad translations: simply create a new KPI image and pull updated translations for it.

The **push** strategy is more nuanced.
Based on a "forward-only" release process, let's push only changes on current release branch.
Note that a release branch is considered 'current' once it has been tagged (and likely deployed soon after);
until then it's considered as 'next' release branch and the previous branch is still 'current'.

| Action     | Branch Context                             | Result   | Reasoning                                                                               |
| ---------- | ------------------------------------------ | -------- | --------------------------------------------------------------------------------------- |
| **Push**   | Add strings on current release branch      | **Good** | Can start translating ASAP.                                                             |
| **Push**   | Remove strings on current release branch   | **Good** | They won't be used on the next pull anyway.                                             |
| **Ignore** | Add strings on next release/main branch    | **Meh**  | Sadly, translation cannot start ASAP. That's OK compromise to avoid transifex branches. |
| **Ignore** | Remove strings on next release/main branch | **Good** | Strings won't disappear on the next pull while still needed for current patch releases. |


### Timing - when to commit translatable strings and translations?

Let's never commit translatable strings.
Translatable strings can be deterministically built on-demand based on the source code, so let's do that instead.
Note that commit and pushing is disconnected, see above.

Let's commit translations at the point of pulling them (see above), so that git history is in-sync with what the images are built on.


### Why add frontend strings like this?

There are actually 3 reasonable options, used or considered over kpi lifetime:
- extract with a django python utility (the one used here)
- extract with an npm javascript dependency
- json2po-ify the already extracted string by webpack plugin

The first two are kinda the same, but as the first one is already used to extract backend strings, just reuse it for frontend as well. Less dependencies to install and bother about.

The third is a better question, but it essentially boils down to the argument above: that's just the simplest way to get it done. It's also the fastest on CI, as we don't need to install js deps nor build webpack to get those strings.
