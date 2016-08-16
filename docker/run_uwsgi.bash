#!/bin/bash
set -e

source /etc/profile

kpi_WEB_SERVER="${kpi_WEB_SERVER:-uWSGI}"
if [[ "${kpi_WEB_SERVER}" == 'uWSGI' ]]; then
    exec /usr/local/bin/uwsgi --ini "${KPI_SRC_DIR}/uwsgi.ini"
else
    cd "${KPI_SRC_DIR}"
    pip install werkzeug ipython
    celery -A kobo worker --beat --loglevel=info --logfile $(KPI_LOGS_DIR)/celery.log --pidfile=/tmp/celery.pid &
    CELERY_PID="$!"
    python manage.py runserver_plus 0:8000 &
    RUNSERVER_PID="$!"
    trap "pkill -P ${RUNSERVER_PID}; kill ${CELERY_PID} ${RUNSERVER_PID}" SIGINT SIGTERM SIGKILL
    wait "${CELERY}" "${RUNSERVER_PID}"
fi
