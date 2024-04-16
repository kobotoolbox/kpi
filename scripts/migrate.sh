#!/usr/bin/env bash
set -e

python manage.py runscript add_migration_from_custom_user_model
python manage.py migrate --noinput
python manage.py migrate --noinput --database kobocat
