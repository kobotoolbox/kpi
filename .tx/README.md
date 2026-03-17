# KPI UI Translations

This repository contains the localisations for the [KoboToolBox KPI](https://github.com/kobotoolbox/kpi) project.


## How to use

You might be wondering: "I just added a new string to KPI. How to make it translateable?". The short answer is: nothing, it's all automated.

You might as well be wondering: "How to translate the string I just added?". The short answer has 2 options:
- if your PR was based on current release branch, go to Transifex website and it will be there waiting for someone to translate it. The rest is automated.
- if your PR was based against next release branch or main, the string will not be on Transifex, yet. Wait until your commit becomes part of a current release branch first.


## Automation

See automation implementation details at `transifex.yml`, `release-2-stabilize.yml` and `release-3-tag.yml`.

Here's how to run those GHA scripts locally, but mind the timing when to do it:

```bash
# in KPI folder, not locale folder..

## Install Transifex CLI
curl -o- https://raw.githubusercontent.com/transifex/cli/master/install.sh | bash
# install transifex api token, see https://app.transifex.com/user/settings/api/

## Install Python dependencies
pipx install uv
uv venv --clear -p 3.10
uv pip sync dependencies/pip/dev_requirements.txt

## To write new source strings:
python manage.py makemessages --locale en
python manage.py makemessages --locale en --domain djangojs
(cd locale; git diff --stat)
# tx push # be careful not to push from the wrong branch, better leave this to CI.
# (cd locale; git add .; git commit -m'chore: add new source strings'; git push)

## To fetch new translated strings:
tx --token $TX_TOKEN pull -a -f --mode reviewed
(cd locale; git diff --stat)
# (cd locale; git add .; git commit -m'chore: add new translated strings'; git push)
```


## Details

### Structure

The Transifex project is called "kobotoolbox" and is available at https://www.transifex.com/kobotoolbox/kobotoolbox/.
  * The `django.po` resource contains strings from the backend `*.py` files
  * The `djangojs.po` resource contains strings from the frontend javascript files

### Timing - when to pull and push translations?

It makes most sense to **pull** translations right before they matter—specifically, right before creating a KPI image. This is straightforward and avoids potential sync traps.

The **push** strategy is more nuanced.
Based on a "forward-only" release process, let's push only changes on current release branch:

| Action     | Branch Context                             | Result   | Reasoning                                                                               |
| ---------- | ------------------------------------------ | -------- | --------------------------------------------------------------------------------------- |
| **Push**   | Add strings on current release branch      | **Good** | Can start translating ASAP.                                                             |
| **Push**   | Remove strings on current release branch   | **Good** | They won't be used on the next pull anyway.                                             |
| **Ignore** | Add strings on next release/main branch    | **Meh**  | Sadly, translation cannot start ASAP. That's OK compromise to avoid transifex branches. |
| **Ignore** | Remove strings on next release/main branch | **Good** | Strings won't disappear on the next pull while still needed for current patch releases. |

Note: This timing reasoning heavily depends on the KPI release process property
where the process is forward-only (e.g., after .47 image is built, no .43x image can be built anymore, only .47x ones).


### Why add frontend strings like this?

There are 3 reasonable options actually, used or considered over kpi lifetime:
- the one used here
- extract with a utility written in javascript
- json2po-ify the already extracted string by webpack plugin

The first two are kinda the same, but as the first one is already used to extract backend strings just reuse it for frontend as well. Less dependencies to install and bother about.

The third is a better question, but it essentially boils down to the argument above: that's just the simplest way to get it done. It's also the fastest on CI, as we don't need to install js deps nor build webpack to get those strings.
