#!/usr/bin/env bash
set -e

# See `kpi/utils/migration_checker.py`
export __KOBO_MIGRATE_SH_SENTINEL__=Present  # value does not matter

python manage.py runscript fix_migrations_for_kobocat_django_app
echo '########## KPI migrations ############'
DJANGO_SETTINGS_MODULE=kobo.settings.guardian python manage.py migrate --noinput
echo '########## KoboCAT migrations ############'
DJANGO_SETTINGS_MODULE=kobo.settings.guardian python manage.py migrate --noinput --database kobocat
python manage.py runscript create_anonymous_user
