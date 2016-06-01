#!/bin/bash
set -e

source /etc/profile

echo 'KoBoForm initializing.'

cd "${KPI_SRC_DIR}"

if [[ -z $DATABASE_URL ]]; then
    echo "DATABASE_URL must be configured to run this server"
    echo "example: 'DATABASE_URL=postgres://hostname:5432/dbname'"
    exit 1
fi

echo 'Synchronizing database.'
python manage.py syncdb --noinput

echo 'Running migrations.'
python manage.py migrate --noinput

if [[ ! -d "${KPI_SRC_DIR}/node_modules" ]]; then
    echo "Restoring \`npm\` packages to \`${KPI_SRC_DIR}/node_modules\`."
    ln -s "${NODE_PATH}" "${KPI_SRC_DIR}/node_modules"
fi

if [[ ! -d "${KPI_SRC_DIR}/jsapp/xlform/components" ]]; then
    echo "Restoring \`bower\` components to \`${KPI_SRC_DIR}/jsapp/xlform/components\`."
    ln -s "${BOWER_COMPONENTS_DIR}/" "${KPI_SRC_DIR}/jsapp/xlform/components"
fi

if [[ ! -d "${KPI_SRC_DIR}/jsapp/compiled" ]]; then
    echo "Restoring \`grunt\` build directory to \`${KPI_SRC_DIR}/jsapp/compiled\`."
    ln -s "${GRUNT_BUILD_DIR}" "${KPI_SRC_DIR}/jsapp/compiled"
fi

if [[ ! -d "${KPI_SRC_DIR}/jsapp/fonts" ]]; then
    echo "Restoring \`grunt\` fonts directory to \`${KPI_SRC_DIR}/jsapp/fonts\`."
    ln -s "${GRUNT_FONTS_DIR}" "${KPI_SRC_DIR}/jsapp/fonts"
fi

if [[ ! -d "${KPI_SRC_DIR}/staticfiles" ]] || [[ "${KPI_PREFIX}" != '/' ]]; then
    echo 'Building static files from live code.'
    (cd "${KPI_SRC_DIR}" && npm run build-production && python manage.py collectstatic --noinput)
fi

echo "Copying static files to nginx volume..."
rsync -aq --chown=www-data "${KPI_SRC_DIR}/staticfiles/" "${NGINX_STATIC_DIR}/"

echo 'KoBoForm initialization completed.'
