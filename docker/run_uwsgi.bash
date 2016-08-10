#!/bin/bash
set -e

source /etc/profile

if [[ "${kpi_WEB_SERVER}" == 'uWSGI' ]]; then
    exec /usr/local/bin/uwsgi --ini "${KPI_SRC_DIR}/uwsgi.ini"
else
    cd "${KPI_SRC_DIR}" && exec python manage.py runserver 0:8000
fi