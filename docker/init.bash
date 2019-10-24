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

# ToDo Removed this comment when we're sure `syncdb` is not needed
# Removed in Django 1.9 in favor of `python manage.py migrate`
# echo 'Synchronizing database.'
# python manage.py syncdb --noinput

echo 'Running migrations.'
python manage.py migrate --noinput

echo "Copying static files to nginx volume..."
rsync -aq --chown=www-data "${KPI_SRC_DIR}/staticfiles/" "${NGINX_STATIC_DIR}/"

rm -rf /etc/profile.d/pydev_debugger.bash.sh
if [[ -d /srv/pydev_orig && ! -z "${KPI_PATH_FROM_ECLIPSE_TO_PYTHON_PAIRS}" ]]; then
    echo 'Enabling PyDev remote debugging.'
    "${KPI_SRC_DIR}/docker/setup_pydev.bash"
fi

echo 'KoBoForm initialization completed.'

#ps faux
#exec /sbin/runit
exec /usr/bin/runsvdir /etc/service
