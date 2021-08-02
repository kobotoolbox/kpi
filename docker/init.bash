#!/bin/bash
set -e

source /etc/profile

echo 'KoBoForm initializing...'

cd "${KPI_SRC_DIR}"

if [[ -z $DATABASE_URL ]]; then
    echo "DATABASE_URL must be configured to run this server"
    echo "example: 'DATABASE_URL=postgres://hostname:5432/dbname'"
    exit 1
fi


# Wait for databases to be up & running before going further
/bin/bash "${INIT_PATH}/wait_for_mongo.bash"
/bin/bash "${INIT_PATH}/wait_for_postgres.bash"

echo 'Running migrations...'
python manage.py migrate --noinput

echo 'Creating superuser...'
python manage.py create_kobo_superuser

if [[ ! -d "${KPI_SRC_DIR}/staticfiles" ]] || ! python "${KPI_SRC_DIR}/docker/check_kpi_prefix_outdated.py"; then
    if [[ "${FRONTEND_DEV_MODE}" == "host" ]]; then
        echo "Dev mode is activated and \`npm\` should be run from host."
        # Create folder to be sure following `rsync` command does not fail
        mkdir -p "${KPI_SRC_DIR}/staticfiles"
    else
        echo "Syncing \`npm\` packages..."
        check-dependencies --install

        # Clean up folders
        rm -rf "${KPI_SRC_DIR}/jsapp/fonts" && \
        rm -rf "${KPI_SRC_DIR}/jsapp/compiled" && \
        echo "Rebuilding client code..."
        npm run copy-fonts && npm run build

        echo "Building static files from live code..."
        python manage.py collectstatic --noinput
    fi
fi

echo "Copying static files to nginx volume..."
rsync -aq --delete --chown=www-data "${KPI_SRC_DIR}/staticfiles/" "${NGINX_STATIC_DIR}/"

if [[ ! -d "${KPI_SRC_DIR}/locale" ]] || [[ -z "$(ls -A ${KPI_SRC_DIR}/locale)" ]]; then
    echo "Fetching translations..."
    git submodule init && \
    git submodule update --remote && \
    python manage.py compilemessages
fi

rm -rf /etc/profile.d/pydev_debugger.bash.sh
if [[ -d /srv/pydev_orig && -n "${KPI_PATH_FROM_ECLIPSE_TO_PYTHON_PAIRS}" ]]; then
    echo 'Enabling PyDev remote debugging.'
    "${KPI_SRC_DIR}/docker/setup_pydev.bash"
fi

echo 'Cleaning up Celery PIDs...'
rm -rf /tmp/celery*.pid

echo 'KoBoForm initialization completed.'

exec /usr/bin/runsvdir /etc/service
