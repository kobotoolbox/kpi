KPI
===

[![Build Status](https://travis-ci.org/kobotoolbox/kpi.svg?branch=develop)](https://travis-ci.org/kobotoolbox/kpi)
[![Coverage Status](https://coveralls.io/repos/github/kobotoolbox/kpi/badge.svg?branch=master)](https://coveralls.io/github/kobotoolbox/kpi?branch=master)

Python Dependencies
-------------------
Python dependencies are listed in [`requirements/requirements.in`](./requirements/requirements.in) and [`requirements/external_services.in`](requirements/external_services.in) and, which are then compiled to [`requirements/requirements.txt`](./requirements/requirements.txt) and [`requirements/external_services.txt`](./requirements/external_services.txt) by [`pip-compile`](https://github.com/nvie/pip-tools). You may use `pip` directly with either compiled list, but consider using instead the `pip-sync` command provided by [pip-tools](https://github.com/nvie/pip-tools). Do not add new dependencies directly to `requirements/requirements.txt` or `requirements/external_services.txt`; instead, update [`requirements/requirements.in`](./requirements/requirements.in) and/or [`requirements/external_services.in`], and `pip-compile` **both** after any changes to either.

Ubuntu 16.04 `apt` Dependencies
-------------------------------
`apt` dependencies for Ubuntu 16.04 are listed in [`requirements/apt_requirements.txt`](requirements/apt_requirements.txt) and can be installed with e.g. `apt-get install $(cat requirements/apt_requirements.txt)`.

Downloading and compiling the translations
------------------------------------------

* Pull the submodule into the `locale` directory with `git submodule update`.
* Optionally configure transifex to pull the latest translations into the `locale` directory with `tx pull --all`
* Run `python manage.py compilemessages` to create `.mo` files from the `.po` files.
* To test out locales in the interface, double click "account actions" in the left navbar, use the dropdown to select a language, and refresh.

Searching assets and collections
--------------------------------
Top-level (null-parent) assets and collections can be found by including `parent=` in the query string. For other searches, construct a string using the [Whoosh query language](https://pythonhosted.org/Whoosh/querylang.html) and pass it in as the `q` parameter, e.g. `/assets/?q=name:sanitation`. Fields indexed by Whoosh are:

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
Construct a string using the [Whoosh query language](https://pythonhosted.org/Whoosh/querylang.html) and pass it in as the `q` parameter, e.g. `/tags/?q=asset_type:block`. Fields indexed by Whoosh are:

* `name__ngram`: the tag's name decomposed into n-grams, e.g. `?q=name__ngram:cat` would match tags named "dogs/cats" and "education";
* `asset_type`: a multi-value field containing the types (e.g. `form`, `question`, `block`) of all tagged assets;
* `kind`: a multi-value field containing "asset" when assets are tagged, "collection" when collections are tagged, or both;
* `text`: a tokenized\* representation of the name, which serves as the search "document" (see note below).

When the `q` parameter contains a search term without a specified field, e.g. `/tags/?q=health`, that term is matched against the search "document" (the `text` field).

\* Implemented by Haystack as [a Whoosh TEXT field using the StemmingAnalyzer](https://github.com/django-haystack/django-haystack/blob/ad90028a22b4274b8df1f4698dd59ac0643f03d5/haystack/backends/whoosh_backend.py#L174). Unsuitable for exact matching.
