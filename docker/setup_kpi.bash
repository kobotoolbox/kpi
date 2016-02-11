#!/bin/bash
set -e

cd "${KPI_SRC_DIR}"

echo 'Waiting for Postgres.'
KOBO_PSQL_DB_NAME=${KOBO_PSQL_DB_NAME:-"kobotoolbox"}
KOBO_PSQL_DB_USER=${KOBO_PSQL_DB_USER:-"kobo"}
KOBO_PSQL_DB_PASS=${KOBO_PSQL_DB_PASS:-"kobo"}
dockerize -timeout=20s -wait ${PSQL_PORT}
until $(PGPASSWORD="${KOBO_PSQL_DB_PASS}" psql -d ${KOBO_PSQL_DB_NAME} -h psql -U ${KOBO_PSQL_DB_USER} -c '' 2> /dev/null); do
    sleep 1
done
echo 'Postgres ready.'

echo 'Synchronizing database.'
python manage.py syncdb --noinput

echo 'Running migrations.'
python manage.py migrate --noinput

echo "Copying static files to nginx volume..."
rsync -aq --chown=www-data "${KPI_SRC_DIR}/staticfiles/" "${NGINX_STATIC_DIR}/"

echo '\`kpi\` initialization completed.'
