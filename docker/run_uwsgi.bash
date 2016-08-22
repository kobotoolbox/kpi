#!/bin/bash
set -e

source /etc/profile

KPI_WEB_SERVER="${KPI_WEB_SERVER:-uWSGI}"
if [[ "${KPI_WEB_SERVER^^}" == 'UWSGI' ]]; then
    exec /usr/local/bin/uwsgi --ini "${KPI_SRC_DIR}/uwsgi.ini"
else
    cd "${KPI_SRC_DIR}"

    pip install werkzeug ipython
    python manage.py runserver_plus 0:8000 &
    RUNSERVER_PID="$!"

    celery -A kobo worker --beat --loglevel=info --logfile ${KPI_LOGS_DIR}/celery.log --pidfile=/tmp/celery.pid &
    while [[ ! -f /tmp/celery.pid ]] || ! cat /tmp/celery.pid ; do
        sleep 1
    done
    CELERY_PID="$(cat /tmp/celery.pid)"

    trap "pkill -P ${RUNSERVER_PID}; kill ${CELERY_PID}" SIGINT SIGTERM SIGKILL
    wait "${RUNSERVER_PID}"
    pkill -P ${RUNSERVER_PID}; kill ${CELERY_PID}
fi
