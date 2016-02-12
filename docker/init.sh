#!/bin/bash
set -e

echo 'KoBoForm initializing.'

cd "${KPI_SRC_DIR}"

echo 'Synchronizing database.'
python manage.py syncdb --noinput

echo 'Running migrations.'
python manage.py migrate --noinput

echo "Copying static files to nginx volume..."
rsync -aq --chown=www-data "${KPI_SRC_DIR}/staticfiles/" "${NGINX_STATIC_DIR}/"

echo 'KoBoForm initialization completed.'
