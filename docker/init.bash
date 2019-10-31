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

echo 'Running migrations.'
python manage.py migrate --noinput

if [[ ! -d "${KPI_SRC_DIR}/staticfiles" ]] || ! python "${KPI_SRC_DIR}/docker/check_kpi_prefix_outdated.py"; then
    # If `node_modules` folder does not exist.
    if [[ ! "$(ls -A ${KPI_SRC_DIR}/node_modules)" ]]; then
        echo "\`npm\` packages are missing. Re-installing them."
        npm install --quiet && npm cache clean --force
    fi

    echo "Rebuilding client code"
    # Clean up folders
    rm -rf "${KPI_SRC_DIR}/jsapp/fonts" && \
    rm -rf "${KPI_SRC_DIR}/jsapp/compiled" && \
    npm run copy-fonts && npm run build

    echo 'Building static files from live code.'
    (cd "${KPI_SRC_DIR}" && python manage.py collectstatic --noinput)
fi

echo "Copying static files to nginx volume..."
rsync -aq --delete --chown=www-data "${KPI_SRC_DIR}/staticfiles/" "${NGINX_STATIC_DIR}/"

rm -rf /etc/profile.d/pydev_debugger.bash.sh
if [[ -d /srv/pydev_orig && ! -z "${KPI_PATH_FROM_ECLIPSE_TO_PYTHON_PAIRS}" ]]; then
    echo 'Enabling PyDev remote debugging.'
    "${KPI_SRC_DIR}/docker/setup_pydev.bash"
fi

echo 'KoBoForm initialization completed.'

echo 'Cleaning up Celery PIDs...'
rm -rf /tmp/celery*.pid

exec /usr/bin/runsvdir /etc/service
