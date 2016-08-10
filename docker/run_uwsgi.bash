#!/bin/bash
set -e

source /etc/profile

kpi_WEB_SERVER="${kpi_WEB_SERVER:-uWSGI}"
if [[ "${kpi_WEB_SERVER}" == 'uWSGI' ]]; then
    exec /usr/local/bin/uwsgi --ini "${KPI_SRC_DIR}/uwsgi.ini"
else
    cd "${KPI_SRC_DIR}"
    pip install werkzeug ipython
    exec python manage.py runserver_plus 0:8000
fi