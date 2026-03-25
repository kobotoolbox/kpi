# KPI UI Translations 

This repository contains the localisations for the [KoboToolBox KPI](https://github.com/kobotoolbox/kpi) project.

You might be wondering: "I just added a new string to KPI. How do I translate it?" You're in the right place!

## Pre conversions

* Save a copy of the metadata at the top of the old PO files found in `en/LC_MESSAGES/`.

## Step 1: Convert front-end Strings JSON to PO file

⚠️ This process does not work unless you are using a Linux environment.

* Install the translate toolkit, run `sudo apt install translate-toolkit`.

* Once installed, move to the KPI root directory and run `json2po jsapp/compiled/extracted-strings.json locale/en/LC_MESSAGES/djangojs.po`.

* Copy the metadata from the old strings to the new ones.

## Step 2: Extract translatable strings from Python files

* From the KPI root directory, run `python manage.py makemessages --locale en`.
* Verify that new strings appear in `locale/en/LC_MESSAGES/django.po` (inside the KPI root directory).

## Step 3: Upload the new strings to Transifex

Note: It's recommended that you install and run Transifex-CLI in a virtual environment or container  
* Install the Transifex-CLI if you haven't already:
  * `curl -o- https://raw.githubusercontent.com/transifex/cli/master/install.sh | bash`
  * Retrieve your API Token from the Transifex website in https://app.transifex.com/user/settings/api/
  * Run `tx migrate` if there are issues with the config file
* From the `locale` directory inside the KPI root, run `tx push -s` to push both new source files to Transifex.

## Step 4: Use the Transifex web interface to translate the new strings

* The Transifex project is called "kobotoolbox" and is available at https://www.transifex.com/kobotoolbox/kobotoolbox/.
  * The `django.po` resource contains strings from the backend `*.py` files
  * The `djangojs.po` resource contains strings from the frontend javascript files

## Step 5: Retrieve the new translations from Transifex and commit to this repository

* From the `locale` directory inside the KPI root, run `tx pull -a -f --mode reviewed`;
* Commit and push the updates to this repository, `form-builder-translations`, whose root should be the `locale` directory.

Alternatively, there is a Github Action that runs on the 1st and the 15th of every month to pull updated strings.