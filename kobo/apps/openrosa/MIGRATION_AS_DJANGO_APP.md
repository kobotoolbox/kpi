## Notes

- Move `onadata` folder to KPI under `openrosa`
- Rename all imports to follow the new path under KPI
- Identify all duplicates settings. Left comments and #FIXME
- Commented out all useless, redundant, duplicate settings
- Import every useful and unique setting from KoboCAT project in `kobo.settings.base.py`
- Specify databases allowed to be touched by Constance Post signal (see  `CONSTANCES_DB` in settings)
- Alter `db_routers.py` to block migrations from each other (logic in `allow_migrate`).  [[GitHub](https://github.com/kobotoolbox/kpi/blob/e24b4e759ce460e8017b080d7ed7ecc075518933/kpi/db_routers.py)]
    - ⚠️ It does not really block migrations. It does add an entry in `django_migrations` table for every app registered in `INSTALLED_APPS` but does not create / alter tables in database.
    For example, when running `./manage.py migrate viewer` in KPI, returns this

        > Running migrations:\
        Applying viewer.0001_initial... OK\
        Applying viewer.0002_auto_20160205_1915... OK\
        Applying viewer.0003_auto_20171123_1521... OK\
        Applying viewer.0004_update_meta_data_export_types... OK
        >

        but no tables are created.
        Django does this in purpose to handle permissions correctly at the model level.

- Monkey-Patch `django.contrib.auth.management.create_permissions` to avoid crashing because content type is wrong while creating KoboCAT model-level permissions in post-signal emitted by `migrate` management command when applying (kinda fake) KoboCAT migrations in KPI [[GitHub 1](https://github.com/kobotoolbox/kpi/blob/d9858876dc8f7c0c153c06c3fcc5f0fd2a551ff3/kobo/apps/__init__.py#L5), [GitHub 2](https://github.com/kobotoolbox/kpi/blob/d9858876dc8f7c0c153c06c3fcc5f0fd2a551ff3/kpi/utils/monkey_patching.py)]
- Keep return `True` in `allow_relation` in `db_routers.py`. It seems to help when making relationships between common models in KPI and KoboCAT. For example, If I have a `User` object (loaded from KPI) and I want to retrieve its related `UserProfile` from KoboCAT, Django is able to create SQL to load the `UserProfile` object right out of the box (not 100% sure , to be tested it again). Side effect, will raise a ProgrammingError when trying to join tables from two different databases
- Create a decorator (`@use_db`) and utility function to specify the database alias to use in `db_routers.py`. Useful to force code to use KoboCAT database when the database cannot be determinated with the app label. [[GitHub]](https://github.com/kobotoolbox/kpi/blob/30a0ad0d62bd235fd006390a5a22585f98cae930/kpi/utils/database.py)\
  Example: `django-guardian` has to be installed in KPI. All of its querysets do not use `.using('database_alias')`, so they are pointing to KPI database.\
  With the decorator, we can make `django-guardian` use KoboCAT database instead
- Create a custom `User` model which extends `AbstractUser`. Keep retro-compatibility  with `auth.User`. Use `from kobo.apps.kobo_auth.shortcuts import User` everywhere instead of `from django.contrib.auth.models import User`.\
  Needed to overload `has_perm` and add some logic to test perm against the correct database (i.e. with context manager `use_db`) [[GitHub]](https://github.com/kobotoolbox/kpi/blob/d9ff55657760540c5c7d5cf636770fb1a1b0e1a3/kobo/apps/kobo_auth/models.py)
- Fork `django_digest` to use `get_user_model()` instead of direct import of `User`. [[GitHub]](https://github.com/kobotoolbox/django-digest)
- Overload `django-guardian` object permission back end to avoid checking permissions at object level with guardian and KPI objects. it does a warning though

    > ?: (guardian.W001) Guardian authentication backend is not hooked
    >

    [[Create utility]](https://github.com/kobotoolbox/kpi/blob/263df4ed111222cd464149c265c5323545b60437/kobo/apps/openrosa/libs/utils/guardian.py)\
    Silent [warning in base.py](https://github.com/kobotoolbox/kpi/blob/c1ffd8a6d3343ce52672baffa27c0746f80879d1/kobo/settings/base.py#L1756)

- Remove unicodecsv
- Remove djangorestframework_guardian dependency
- Handle DRF for KC (solution: create a [base Viewset](https://github.com/kobotoolbox/kpi/blob/30a0ad0d62bd235fd006390a5a22585f98cae930/kobo/apps/openrosa/apps/api/utils/rest_framework/views.py) which follow [DRF KoboCAT settings](https://github.com/kobotoolbox/kpi/blob/c1ffd8a6d3343ce52672baffa27c0746f80879d1/kobo/settings/base.py#L921))
- Import KoboCAT URLs in KPI at root (e.g. `./manage.py show_urls` now displays KoboCAT endpoints `/<endpoint>` instead of `/kobocat/<endpoint>`  as discussed  earlier. Easier to setup NGINX)
- Add Java 17 to KPI Dockerfile
- Add KoboCAT PIP dependencies
- Add a new script that is called from the entrypoint to handle migration history from existing and new installs.[[GitHub]](https://github.com/kobotoolbox/kpi/blob/47a9be5aa20c2ab2c6347599d74f04b9ea196b05/docker/entrypoint.sh#L39) [[GitHub 2]](https://github.com/kobotoolbox/kpi/blob/b4aba7b7be182b6fdd8e6ad61be7e8b1d1ebd1d5/scripts/fix_migrations_for_kobocat_django_app.py)
- Merge `CELERY_BEAT_SCHEDULE`
- Update [[NGINX config]](https://github.com/kobotoolbox/kobo-docker/blob/f193eb2f29eaf35d47c1ce0f77c11d78721b70fd/nginx/kobo-docker-scripts/templates/nginx_site_default.conf.tmpl)
- Change

    ```python
    ~~- SERVICE_ACCOUNT_WHITELISTED_HOSTS=kf.kobo.internal:8000,kf.kobo.internal~~
    - SERVICE_ACCOUNT_WHITELISTED_HOSTS=kf.kobo.internal:8000,kf.kobo.internal,kc.kobo.internal:8001,kc.kobo.internal
    ```


- Change `basename` of KPI `UserViewSet` to `user-kpi` to avoid conflicts with KoboCAT
- Use `CELERY_TASK_ROUTES` to route KoboCAT tasks to their own queue
- Create new celery worker for KoboCAT
- Clean-up KoboCAT templates
- Remove ConditionalRedirectMiddleware (move specific condition inside `download_xlsform`)
- Prefix `service_health` and `service_health_minimal` endpoints with `legacy/` in KoboCAT to avoids conflicts with KPI
- Use KPI classes for Digest and Token authentication (no use of KoboCAT tables anymore)

### To-do

- Merge any helper, utility duplicate (e.g. MongoHelper)
- Remove Django-Digest tables in KoboCAT database for existing environment
- Remove DRF Token tables in KoboCAT database for existing environment
- Rename `auth_user` table to `koboauth_user` to match Django app `kobo_auth`


## Known bugs
- Endpoints can respond under each domain
- 500 errors are handled by KoboCAT templates even if it is a KPI error
