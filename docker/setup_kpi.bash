#!/bin/bash
set -e

cd "${KPI_SRC_DIR}"
python manage.py migrate --noinput
echo "Copying static files to nginx volume..."
rsync -aq --chown=www-data "${KPI_SRC_DIR}/staticfiles/" "${NGINX_STATIC_DIR}/"
