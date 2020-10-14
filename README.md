# KPI

[![Build Status](https://travis-ci.org/kobotoolbox/kpi.svg?branch=develop)](https://travis-ci.org/kobotoolbox/kpi)
[![Coverage Status](https://coveralls.io/repos/github/kobotoolbox/kpi/badge.svg?branch=master)](https://coveralls.io/github/kobotoolbox/kpi?branch=master)

We're open for [contributions](./CONTRIBUTING.md)!

## Important notice when upgrading from any release older than [`2.020.18`](https://github.com/kobotoolbox/kpi/releases/tag/2.020.18)

Prior to release [`2.020.18`](https://github.com/kobotoolbox/kpi/releases/tag/2.020.18), this project (KPI) and [KoBoCAT](https://github.com/kobotoolbox/kobocat) both shared a common Postgres database. They now each have their own. **If you are upgrading an existing single-database installation, you must follow [these instructions](https://community.kobotoolbox.org/t/upgrading-to-separate-databases-for-kpi-and-kobocat/7202)** to migrate the KPI tables to a new database and adjust your configuration appropriately.

If you do not want to upgrade at this time, please use the [`shared-database-obsolete`](https://github.com/kobotoolbox/kpi/tree/shared-database-obsolete) branch instead.

## Python Dependencies

Python dependencies are managed with `pip-compile` and `pip-sync` from the [`pip-tools`](https://github.com/jazzband/pip-tools/) package. The dependencies are listed in [`dependencies/pip/`](./dependencies/pip/), with core requirements in [`dependencies/pip/requirements.in`](./dependencies/pip/requirements.in). You may use `pip` directly with one of the compiled `dependencies/pip/*.txt` files, but consider using instead the `pip-sync`. **Do not** add new dependencies directly to the *compiled* `dependencies/pip/*.txt` files; instead, update the relevant the *source* `dependencies/pip/*.in` file(s), and execute `make pip_compile` after any changes. You can pass arguments to `pip-compile` with e.g. `make pip_compile ARGS='--upgrade-package=xlwt'`. To force building, use `make --always-make ...`.

## Ubuntu 16.04 `apt` Dependencies

`apt` dependencies for Ubuntu 16.04 are listed in [`dependencies/apt_requirements.txt`](dependencies/apt_requirements.txt) and can be installed with e.g. `apt-get install $(cat dependencies/apt_requirements.txt)`.

## Downloading and compiling the translations

* Pull the submodule into the `locale` directory with `git submodule update`.
* Optionally configure transifex to pull the latest translations into the `locale` directory with `tx pull --all`
* Run `python manage.py compilemessages` to create `.mo` files from the `.po` files.
* To test out locales in the interface, double click "account actions" in the left navbar, use the dropdown to select a language, and refresh.

## Searching

Results from the `tags` and `api/v2/assets` endpoints can be filtered by a
Boolean query specified in the `q` parameter. For example:
`api/v2/assets?q=owner__username:meg AND name__icontains:quixotic` would return
assets whose owner has the username "meg" (case sensitive) and whose name
contains "quixotic" anywhere (case insensitive). For more details about the
syntax, see the documentation at the top of
[kpi/utils/query_parser/query_parser.py](./kpi/utils/query_parser/query_parser.py).

## Admin reports

There are several types of data reports available to superusers. 
* Full list of users including their details provided during signup, number of deployed projects (XForm count), number of submissions, date joined, and last login: `<kpi base url>/superuser_stats/user_report/`. File being created is a CSV, so don't download immediately to wait for server to be finished writing to the file (it will download even if incomplete).
* Monthly aggregate figures for number of forms, deployed projects, and submissions (from kobocat): `<kc server domain>/<superuser username>/superuser_stats/`

## Django Admin Interface

As this is a Django project, you may find the admin panel at `<kpi base url>/admin` useful, e.g. to configure user accounts or log in as other users without knowing their passwords. You must use a superuser account to access the admin panel.

## Icons

All project icons are kept in `jsapp/svg-icons/`. Adding new icon requires adding new `svg` file here and regenerating icons with `npm run generate-icons`. Filenames are used for icon font classnames, e.g. `.k-icon-arrow-last` for `arrow-last.svg` (please use kebab-case). You can see all available icons by running `npm run show-icons` - it will open a list in your browser.

## Supported Browsers

See [browsers list config](./.browserslistrc)
