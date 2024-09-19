Code in this directory is based on
[KoboCAT](https://github.com/kobotoolbox/kobocat), derived from the excellent
[onadata](http://github.com/onaio/onadata) platform developed by Ona LLC, which
in itself is a redevelopment of the
[formhub](http://github.com/SEL-Columbia/formhub) platform developed by the
Sustainable Engineering Lab at Columbia University.

Please see the LICENSE file in this directory for more details. A copy is available at
https://github.com/kobotoolbox/kpi/blob/release/2.024.25/kobo/apps/openrosa/LICENSE.

Please refer to [kobo-install](https://github.com/kobotoolbox/kobo-install) for
instructions on how to install KoboToolbox.

⚠️ _Note_: Starting from version [2.024.25](https://github.com/kobotoolbox/kpi/releases/tag/2.024.25),
the [KoboCAT](https://github.com/kobotoolbox/kobocat/) Django project has been consolidated into KPI as an application called **openrosa** ([see notes](./MIGRATION_AS_DJANGO_APP.md)).
For this reason, you will no longer see a separate kobocat container: the code that previously ran there now runs inside the kpi container.


## Code Structure

  - **logger** - This app serves XForms to and receives submissions from
    ODK Collect and Enketo.
  - **viewer** - This app provides a csv and xls export of the data
    stored in logger. This app uses a data dictionary as produced by
    pyxform. It also provides a map and single survey view.
  - **main** - This app is the glue that brings logger and viewer
    together.
