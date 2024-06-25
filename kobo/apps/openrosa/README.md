# KoboCAT

## Important notice when upgrading from any release older than [`2.020.18`](https://github.com/kobotoolbox/kobocat/releases/tag/2.020.18)

Up to and including release [`2.020.18`](https://github.com/kobotoolbox/kobocat/releases/tag/2.020.18), this project (KoboCAT) and [KPI](https://github.com/kobotoolbox/kpi) both shared a common Postgres database. They now each have their own. **If you are upgrading an existing single-database installation, you must follow [these instructions](https://community.kobotoolbox.org/t/upgrading-to-separate-databases-for-kpi-and-kobocat/7202)** to migrate the KPI tables to a new database and adjust your configuration appropriately.

If you do not want to upgrade at this time, please use the [`shared-database-obsolete`](https://github.com/kobotoolbox/kobocat/tree/shared-database-obsolete) branch instead.

## Deprecation Notices

Much of the user-facing features of this application are being migrated
to <https://github.com/kobotoolbox/kpi>. KoboCAT's data-access API and
OpenRosa functions will remain intact, and any plans to the contrary
will be announced well in advance. For more details and discussion,
please refer to
<https://community.kobotoolbox.org/t/contemplating-the-future-of-kobocat/2743>.

As features are migrated, we will list them here along with the last
release where each was present:
  - Starting from version [2.024.25](https://github.com/kobotoolbox/kobocat/releases/tag/2.024.25),
    the ability to import submissions in CSV to KoboCAT was
    removed (i.e: `https://kobocat.domain.tld/api/v1/forms/<form_id>/csv_import`)
    .
  - On 14 June 2021, the ability to upload forms directly to KoboCAT was
    removed, and it was announced that the legacy KoboCAT user interface would
    be preserved for "a few more months". After more than two years, we have
    removed the user interface and related endpoints entirely in release
    [2.023.37](https://github.com/kobotoolbox/kobocat/releases/tag/2.023.37).
    **This includes the ability to upload XLSForms via the legacy KoboCAT API.**
    Please use the KPI `v2` API for all form management. Other removed features
    should already be available in KPI as well. Please see
    [REMOVALS.md](REMOVALS.md) for a complete list.
  - To ensure security and stability, many endpoints that were already
    available in KPI, long-unsupported, or underutilized have been removed in
    release
    [2.020.40](https://github.com/kobotoolbox/kobocat/releases/tag/2.020.40).
    These were related to charts and stats, form cloning, form sharing, user
    profiles, organizations / projects / teams, bamboo, and ziggy. For a full
    list, please see [REMOVALS.md](REMOVALS.md). These endpoints were last
    available in the release
    [2.020.39](https://github.com/kobotoolbox/kobocat/releases/tag/2.020.39).
  - REST Services - an improved version [has been added to
    KPI](https://github.com/kobotoolbox/kpi/pull/1864). The last KoboCAT
    release to contain legacy REST services is
    [2.019.39](https://github.com/kobotoolbox/kobocat/releases/tag/2.019.39).

## About

kobocat is the data collection platform used in KoboToolbox. It is based
on the excellent [onadata](http://github.com/onaio/onadata) platform
developed by Ona LLC, which in itself is a redevelopment of the
[formhub](http://github.com/SEL-Columbia/formhub) platform developed by
the Sustainable Engineering Lab at Columbia University.

Please refer to
[kobo-install](https://github.com/kobotoolbox/kobo-install) for
instructions on how to install KoboToolbox.

## Code Structure

  - **logger** - This app serves XForms to and receives submissions from
    ODK Collect and Enketo.
  - **viewer** - This app provides a csv and xls export of the data
    stored in logger. This app uses a data dictionary as produced by
    pyxform. It also provides a map and single survey view.
  - **main** - This app is the glue that brings logger and viewer
    together.

## Localization

To generate a locale from scratch (ex. Spanish)

``` sh
$ django-admin makemessages -l es -e py,html,email,txt ;
$ for app in {main,viewer} ; do cd kobocat/apps/${app} && django-admin makemessages -d djangojs -l es && cd - ; done
```

To update PO files

``` sh
$ django-admin makemessages -a ;
$ for app in {main,viewer} ; do cd kobocat/apps/${app} && django-admin makemessages -d djangojs -a && cd - ; done
```

To compile MO files and update live translations

``` sh
$ django-admin compilemessages ;
$ for app in {main,viewer} ; do cd kobocat/apps/${app} && django-admin compilemessages && cd - ; done
```
## Testing in KoboCAT

For kobo-install users, enter the folder for kobo-install and run this command

```
./run.py -cf exec kobocat bash
```

For all other users, enter the container using this command

``` sh
$ docker exec -it {{kobocat container}} /bin/bash
```

Run pip install the development dependencies

``` sh
$ pip install -r dependencies/pip/dev.txt
```

Run pytest to run all automated tests

``` sh
$ pytest
```
