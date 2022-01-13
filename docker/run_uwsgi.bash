#!/bin/bash

source /etc/profile

KPI_WEB_SERVER="${KPI_WEB_SERVER:-uWSGI}"
UWSGI_COMMAND="$(command -v uwsgi) --ini ${KPI_SRC_DIR}/uwsgi.ini"

cd "${KPI_SRC_DIR}"
if [[ "${KPI_WEB_SERVER,,}" == 'uwsgi' ]]; then
    echo "Running \`kpi\` container with uWSGI application server."
    exec ${UWSGI_COMMAND}
else
    echo "Running \`kpi\` container with \`runserver_plus\` debugging application server."
    exec python manage.py runserver_plus 0:8000
fi
