#!/bin/bash
set -e

source /etc/profile

KPI_WEB_SERVER="${KPI_WEB_SERVER:-uWSGI}"
uwsgi_command="/usr/local/bin/uwsgi --ini ${KPI_SRC_DIR}/uwsgi.ini"
if [[ "${KPI_WEB_SERVER,,}" == 'uwsgi' && -z "${NEW_RELIC_LICENSE_KEY}" ]]; then
    echo 'Running `kpi` container with uWSGI application server.'
    exec ${uwsgi_command}
elif [[ "${KPI_WEB_SERVER,,}" == 'uwsgi' && ! -z "${NEW_RELIC_LICENSE_KEY}" ]]; then
    echo 'Running `kpi` container with uWSGI application server and New Relic analytics.'
    export NEW_RELIC_APP_NAME="${NEW_RELIC_APP_NAME:-KoBoForm}"
    export NEW_RELIC_LOG="${NEW_RELIC_LOG:-stdout}"
    export NEW_RELIC_LOG_LEVEL="${NEW_RELIC_LOG_LEVEL:-info}"
    exec newrelic-admin run-program ${uwsgi_command}
else
    echo 'Running `kpi` container with `runserver_plus` debugging application server.'
    cd "${KPI_SRC_DIR}"
    pip install werkzeug ipython
    exec python manage.py runserver_plus 0:8000
fi
