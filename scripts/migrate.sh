#!/usr/bin/env bash
set -e

python manage.py runscript fix_migrations_for_kobocat_django_app
python manage.py migrate --noinput
python manage.py migrate --noinput --database kobocat
