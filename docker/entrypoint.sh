#!/bin/bash
set -e
source /etc/profile

echo 'KPI initializing…'

cd "${KPI_SRC_DIR}"

# Handle filesystem permissions early, because other containers (like the
# Celery `worker`), restart-loop if they cannot write to their log files
echo 'Setting ownership of logs folder…'
chown -R "${UWSGI_USER}:${UWSGI_GROUP}" "${KPI_LOGS_DIR}"
# `chown -R` becomes very slow once a fair amount of media has been collected,
# so reset ownership of the media directory *only* (i.e., non-recursive)
echo 'Setting ownership of media directories…'
chown "${UWSGI_USER}:${UWSGI_GROUP}" "${KPI_MEDIA_DIR}"
chown "${UWSGI_USER}:${UWSGI_GROUP}" "${OPENROSA_MEDIA_DIR}"
echo 'Done.'
echo '%%%%%%% NOTICE %%%%%%%'
echo '% To avoid long delays, we no longer reset ownership *recursively*'
echo '% every time this container starts. If you have trouble with'
echo '% permissions, please run the following command inside the KPI container:'
echo "% chown -R \"${UWSGI_USER}:${UWSGI_GROUP}\" \"${KPI_MEDIA_DIR}\""
echo "% chown -R \"${UWSGI_USER}:${UWSGI_GROUP}\" \"${OPENROSA_MEDIA_DIR}\""
echo '%%%%%%%%%%%%%%%%%%%%%%'


if [[ -z $DATABASE_URL ]]; then
    echo "DATABASE_URL must be configured to run this server"
    echo "example: 'DATABASE_URL=postgres://hostname:5432/dbname'"
    exit 1
fi

# Handle Python dependencies BEFORE attempting any `manage.py` commands
WSGI="${WSGI:-uWSGI}"
if [[ "${WSGI}" == 'uWSGI' ]]; then
    # `diff` returns exit code 1 if it finds a difference between the files
    if ! diff -q "${KPI_SRC_DIR}/dependencies/pip/requirements.txt" "${TMP_DIR}/pip_dependencies.txt"
    then
        echo "Syncing production pip dependencies…"
        uv pip sync dependencies/pip/requirements.txt 1>/dev/null
        cp "dependencies/pip/requirements.txt" "${TMP_DIR}/pip_dependencies.txt"
    fi
else
    if ! diff -q "${KPI_SRC_DIR}/dependencies/pip/dev_requirements.txt" "${TMP_DIR}/pip_dependencies.txt"
    then
        echo "Syncing development pip dependencies…"
        uv pip sync dependencies/pip/dev_requirements.txt 1>/dev/null
        cp "dependencies/pip/dev_requirements.txt" "${TMP_DIR}/pip_dependencies.txt"
    fi
fi

# Wait for databases to be up & running before going further
/bin/bash "${INIT_PATH}/wait_for_mongo.bash"
/bin/bash "${INIT_PATH}/wait_for_postgres.bash"

echo 'Running migrations…'
gosu "${UWSGI_USER}" scripts/migrate.sh

echo 'Creating superuser…'
gosu "${UWSGI_USER}" python manage.py create_kobo_superuser

if [[ ! -d "${KPI_SRC_DIR}/staticfiles" ]] || ! python "${KPI_SRC_DIR}/docker/check_kpi_prefix_outdated.py"; then
    if [[ "${FRONTEND_DEV_MODE}" == "host" ]]; then
        echo "Dev mode is activated and \`npm\` should be run from host."
        # Create folder to be sure following `rsync` command does not fail
        mkdir -p "${KPI_SRC_DIR}/staticfiles"
    else
        echo "Cleaning old build…"
        rm -rf "${KPI_SRC_DIR}/jsapp/fonts" && \
        rm -rf "${KPI_SRC_DIR}/jsapp/compiled"

        echo "Syncing \`npm\` packages…"
        if ( ! check-dependencies ); then
            npm install --quiet > /dev/null 2>&1
        else
            npm run postinstall > /dev/null 2>&1
        fi

        echo "Rebuilding client code…"
        npm run build

        echo "Building static files from live code…"
        python manage.py collectstatic --noinput --ignore rest_framework
    fi
fi

echo "Copying static files to nginx volume…"
rsync -aq --delete --chown=www-data "${KPI_SRC_DIR}/staticfiles/" "${NGINX_STATIC_DIR}/"

if [[ ! -d "${KPI_SRC_DIR}/locale" ]] || [[ -z "$(ls -A ${KPI_SRC_DIR}/locale)" ]]; then
    echo "Fetching translations…"
    git submodule init && \
    git submodule update --remote && \
    python manage.py compilemessages
fi

echo 'KPI initialization completed.'

cd "${KPI_SRC_DIR}"

if [[ "${WSGI}" == 'uWSGI' ]]; then
    echo "Running \`kpi\` container with uWSGI application server."
    $(command -v uwsgi) --ini ${KPI_SRC_DIR}/docker/uwsgi.ini
else
    echo "Running \`kpi\` container with \`runserver_plus\` debugging application server."
    gosu "${UWSGI_USER}" $(command -v python) manage.py runserver_plus 0:8000
fi
