KPI
===

[![Build Status](https://travis-ci.org/kobotoolbox/kpi.svg?branch=develop)](https://travis-ci.org/kobotoolbox/kpi)
[![Coverage Status](https://coveralls.io/repos/github/kobotoolbox/kpi/badge.svg?branch=master)](https://coveralls.io/github/kobotoolbox/kpi?branch=master)

We're open for [contributions](./CONTRIBUTING.md)!

Python Dependencies
-------------------
Python dependencies are managed with `pip-compile` and `pip-sync` from the [`pip-tools`](https://github.com/jazzband/pip-tools/) package. The dependencies are listed in [`dependencies/pip/`](./dependencies/pip/), with core requirements in [`dependencies/pip/requirements.in`](./dependencies/pip/requirements.in). You may use `pip` directly with one of the compiled `dependencies/pip/*.txt` files, but consider using instead the `pip-sync`. **Do not** add new dependencies directly to the *compiled* `dependencies/pip/*.txt` files; instead, update the relevant the *source* `dependencies/pip/*.in` file(s), and execute `make pip_compile` after any changes. You can pass arguments to `pip-compile` with e.g. `make pip_compile ARGS='--upgrade-package=xlwt'`. To force building, use `make --always-make ...`.

Ubuntu 16.04 `apt` Dependencies
-------------------------------
`apt` dependencies for Ubuntu 16.04 are listed in [`dependencies/apt_requirements.txt`](dependencies/apt_requirements.txt) and can be installed with e.g. `apt-get install $(cat dependencies/apt_requirements.txt)`.

Downloading and compiling the translations
------------------------------------------

* Pull the submodule into the `locale` directory with `git submodule update`.
* Optionally configure transifex to pull the latest translations into the `locale` directory with `tx pull --all`
* Run `python manage.py compilemessages` to create `.mo` files from the `.po` files.
* To test out locales in the interface, double click "account actions" in the left navbar, use the dropdown to select a language, and refresh.

Searching assets and collections
--------------------------------
Top-level (null-parent) assets and collections can be found by including `parent=` in the query string. For other searches, construct a string using the [Whoosh query language](http://whoosh.readthedocs.io/en/latest/querylang.html) and pass it in as the `q` parameter, e.g. `/assets/?q=name:sanitation`. Fields indexed by Whoosh are:

* `name`: a tokenized\* representation of the name;
* `name__exact`: a space- and comma-escaped representation of the name, e.g. "Fun, Exciting Asset" would be indexed as "Fun--Exciting-Asset";
* `owner__username`: a tokenized\* representation of the owner's username;
* `owner__username__exact`: a space- and comma-escaped representation of the owner's username;
* `parent__name`: a tokenized\* representation of the parent object's name;
* `parent__name__exact`: a space- and comma-escaped representation of the parent object's name;
* `parent__uid`: the UID of the parent collection;
* `ancestor__uid`: a multi-value field containing the UIDs of all ancestor collections;
* `tag`: a multi-valued field holding space- and comma-escaped representations of each tag assigned to the object;
* `asset_type` (for assets only): a space- and comma-escaped representation of the asset's type string;
* `text`: the search "document," which is built by [text templates](https://github.com/kobotoolbox/kpi/tree/master/kpi/templates/search/indexes/kpi).

When the `q` parameter contains a search term without a specified field, e.g. `/collections/?q=health`, that term is matched against the search "document" (the `text` field). 

Searching tags
--------------
Construct a string using the [Whoosh query language](http://whoosh.readthedocs.io/en/latest/querylang.html) and pass it in as the `q` parameter, e.g. `/tags/?q=asset_type:block`. Fields indexed by Whoosh are:

* `name__ngram`: the tag's name decomposed into n-grams, e.g. `?q=name__ngram:cat` would match tags named "dogs/cats" and "education";
* `asset_type`: a multi-value field containing the types (e.g. `form`, `question`, `block`) of all tagged assets;
* `kind`: a multi-value field containing "asset" when assets are tagged, "collection" when collections are tagged, or both;
* `text`: a tokenized\* representation of the name, which serves as the search "document" (see note below).

When the `q` parameter contains a search term without a specified field, e.g. `/tags/?q=health`, that term is matched against the search "document" (the `text` field).

\* Implemented by Haystack as [a Whoosh TEXT field using the StemmingAnalyzer](https://github.com/django-haystack/django-haystack/blob/ad90028a22b4274b8df1f4698dd59ac0643f03d5/haystack/backends/whoosh_backend.py#L174). Unsuitable for exact matching.

Admin reports
-------------
There are several types of data reports available to superusers. 
* Full list of users including their details provided during signup, number of deployed projects (XForm count), number of submissions, date joined, and last login: `<kpi base url>/superuser_stats/user_report/`. File being created is a CSV, so don't download immediately to wait for server to be finished writing to the file (it will download even if incomplete).
* Monthly aggregate figures for number of forms, deployed projects, and submissions (from kobocat): `<kc server domain>/<superuser username>/superuser_stats/`

Django Admin Interface
----------------------
As this is a Django project, you may find the admin panel at `<kpi base url>/admin` useful, e.g. to configure user accounts or log in as other users without knowing their passwords. You must use a superuser account to access the admin panel.

Icons
-----
All project icons are kept in `jsapp/svg-icons/`. Adding new icon requires adding new `svg` file here and regenerating icons with `npm run generate-icons`. Filenames are used for icon font classnames, e.g. `.k-icon-arrow-last` for `arrow-last.svg` (please use kebab-case). You can see all available icons by running `npm run show-icons` - it will open a list in your browser.