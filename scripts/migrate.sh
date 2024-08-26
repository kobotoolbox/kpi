#!/usr/bin/env bash
set -e

python manage.py runscript fix_migrations_for_kobocat_django_app
echo '########## KPI migrations ############'
DJANGO_SETTINGS_MODULE=kobo.settings.guardian python manage.py migrate --noinput
echo '########## KoboCAT migrations ############'
DJANGO_SETTINGS_MODULE=kobo.settings.guardian python manage.py migrate --noinput --database kobocat
python manage.py runscript create_anonymous_user
