#!/bin/bash
set -e

source /etc/profile

echo 'KoBoForm initializing.'

cd "${KPI_SRC_DIR}"

if [[ ! -e "${KPI_SRC_DIR}/node_modules" ]]; then
    echo 'Restoring backed up `node_modules`.'
    ln -s "${NODE_PATH}" "${KPI_SRC_DIR}/node_modules"
fi

if [[ ! -e "${KPI_SRC_DIR}/src" ]]; then
    echo 'Restoring backed up `pip` editable packages.'
    ln -s "${PIP_EDITABLE_PACKAGE_DIR}" "${KPI_SRC_DIR}/src"
fi

if [[ ! -d "${KPI_SRC_DIR}/staticfiles" ]]; then
    echo 'Building static files.'
    grunt buildall
    python manage.py collectstatic --noinput
fi

echo 'Synchronizing database.'
python manage.py syncdb --noinput

echo 'Running migrations.'
python manage.py migrate --noinput

echo "Copying static files to nginx volume..."
rsync -aq --chown=www-data "${KPI_SRC_DIR}/staticfiles/" "${NGINX_STATIC_DIR}/"

echo 'KoBoForm initialization completed.'
