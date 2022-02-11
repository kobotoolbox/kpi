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

# Handle Python dependencies BEFORE attempting any `manage.py` commands
KPI_WEB_SERVER="${KPI_WEB_SERVER:-uWSGI}"
if [[ "${KPI_WEB_SERVER,,}" == 'uwsgi' ]]; then
    # `diff` returns exit code 1 if it finds a difference between the files
    if ! diff -q "${KPI_SRC_DIR}/dependencies/pip/external_services.txt" "/srv/tmp/pip_dependencies.txt"
    then
        echo "Syncing production pip dependencies..."
        pip-sync dependencies/pip/external_services.txt 1>/dev/null
        cp "dependencies/pip/external_services.txt" "/srv/tmp/pip_dependencies.txt"
    fi
else
    if ! diff -q "${KPI_SRC_DIR}/dependencies/pip/dev_requirements.txt" "/srv/tmp/pip_dependencies.txt"
    then
        echo "Syncing development pip dependencies..."
        pip-sync dependencies/pip/dev_requirements.txt 1>/dev/null
        cp "dependencies/pip/dev_requirements.txt" "/srv/tmp/pip_dependencies.txt"
    fi
    if [[ -n "$RAVEN_DSN" ]]; then
        echo "Sentry detected. Installing \`raven\` pip dependency..."
        pip install raven
    fi
fi

# Wait for databases to be up & running before going further
/bin/bash "${INIT_PATH}/wait_for_mongo.bash"
/bin/bash "${INIT_PATH}/wait_for_postgres.bash"

echo 'Running migrations...'
gosu "${UWSGI_USER}" python manage.py migrate --noinput

echo 'Creating superuser...'
gosu "${UWSGI_USER}" python manage.py create_kobo_superuser

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
    gosu "${UWSGI_USER}" python manage.py compilemessages
fi

rm -rf /etc/profile.d/pydev_debugger.bash.sh
if [[ -d /srv/pydev_orig && -n "${KPI_PATH_FROM_ECLIPSE_TO_PYTHON_PAIRS}" ]]; then
    echo 'Enabling PyDev remote debugging.'
    "${KPI_SRC_DIR}/docker/setup_pydev.bash"
fi

echo 'Cleaning up Celery PIDs...'
rm -rf /tmp/celery*.pid

echo 'Restore permissions on Celery logs folder'
chown -R "${UWSGI_USER}:${UWSGI_GROUP}" "${KPI_LOGS_DIR}"

# This can take a while when starting a container with lots of media files.
# Maybe we should add a disclaimer as we do in KoBoCAT to let the users
# do it themselves
chown -R "${UWSGI_USER}:${UWSGI_GROUP}" "${KPI_MEDIA_DIR}"

echo 'KoBoForm initialization completed.'

exec /usr/bin/runsvdir "${SERVICES_DIR}"
