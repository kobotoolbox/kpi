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

if [[ ! -L "${KPI_SRC_DIR}/node_modules" ]] || [[ ! -d "${KPI_SRC_DIR}/node_modules" ]]; then
    echo "Restoring \`npm\` packages to \`${KPI_SRC_DIR}/node_modules\`."
    rm -rf "${KPI_SRC_DIR}/node_modules"
    ln -s "${KPI_NODE_PATH}" "${KPI_SRC_DIR}/node_modules"
fi

if [[ ! -L "${KPI_SRC_DIR}/jsapp/xlform/components" ]] || [[ ! -d "${KPI_SRC_DIR}/jsapp/xlform/components" ]]; then
    echo "Restoring \`bower\` components to \`${KPI_SRC_DIR}/jsapp/xlform/components\`."
    rm -rf "${KPI_SRC_DIR}/jsapp/xlform/components"
    ln -s "${BOWER_COMPONENTS_DIR}/" "${KPI_SRC_DIR}/jsapp/xlform/components"
fi

if [[ ! -L "${KPI_SRC_DIR}/jsapp/compiled" ]] || [[ ! -d "${KPI_SRC_DIR}/jsapp/compiled" ]]; then
    echo "Restoring build directory to \`${KPI_SRC_DIR}/jsapp/compiled\`."
    rm -rf "${KPI_SRC_DIR}/jsapp/compiled"
    ln -s "${BUILD_DIR}" "${KPI_SRC_DIR}/jsapp/compiled"
fi

if [[ ! -L "${KPI_SRC_DIR}/jsapp/fonts" ]] || [[ ! -d "${KPI_SRC_DIR}/jsapp/fonts" ]]; then
    echo "Restoring fonts directory to \`${KPI_SRC_DIR}/jsapp/fonts\`."
    rm -rf "${KPI_SRC_DIR}/jsapp/fonts"
    ln -s "${FONTS_DIR}" "${KPI_SRC_DIR}/jsapp/fonts"
fi

if [[ ! -d "${KPI_SRC_DIR}/staticfiles" ]] || ! python "${KPI_SRC_DIR}/docker/check_kpi_prefix_outdated.py"; then
    echo 'Building static files from live code.'
    (cd "${KPI_SRC_DIR}" && npm run build && python manage.py collectstatic --noinput)
fi

echo "Copying static files to nginx volume..."
rsync -aq --chown=www-data "${KPI_SRC_DIR}/staticfiles/" "${NGINX_STATIC_DIR}/"

rm -rf /etc/profile.d/pydev_debugger.bash.sh
if [[ -d /srv/pydev_orig && ! -z "${KPI_PATH_FROM_ECLIPSE_TO_PYTHON_PAIRS}" ]]; then
    echo 'Enabling PyDev remote debugging.'
    "${KPI_SRC_DIR}/docker/setup_pydev.bash"
fi

echo 'KoBoForm initialization completed.'
