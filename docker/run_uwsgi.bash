#!/bin/bash
set -e

source /etc/profile

KPI_WEB_SERVER="${KPI_WEB_SERVER:-uWSGI}"
uwsgi_command="/usr/local/bin/uwsgi --ini ${KPI_SRC_DIR}/uwsgi.ini"

if [[ "${KPI_WEB_SERVER,,}" == 'uwsgi' ]]; then
    echo 'Running `kpi` container with uWSGI application server.'
    exec ${uwsgi_command}
else
    echo 'Running `kpi` container with `runserver_plus` debugging application server.'
    cd "${KPI_SRC_DIR}"
    pip-sync dependencies/pip/dev_requirements.txt
    exec python manage.py runserver_plus 0:8000
fi
