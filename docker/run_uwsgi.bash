#!/bin/bash

source /etc/profile

KPI_WEB_SERVER="${KPI_WEB_SERVER:-uWSGI}"
UWSGI_COMMAND="$(command -v uwsgi) --ini ${KPI_SRC_DIR}/uwsgi.ini"

if [[ "${KPI_WEB_SERVER,,}" == 'uwsgi' ]]; then
    cd "${KPI_SRC_DIR}"
    DIFF=$(diff "${KPI_SRC_DIR}/dependencies/pip/external_services.txt" "/srv/tmp/pip_dependencies.txt")
    if [[ -n "$DIFF" ]]; then
        echo "Syncing pip dependencies..."
        pip-sync dependencies/pip/external_services.txt 1>/dev/null
        cp "dependencies/pip/external_services.txt" "/srv/tmp/pip_dependencies.txt"
    fi
    echo "Running \`kpi\` container with uWSGI application server."
    exec ${UWSGI_COMMAND}
else
    cd "${KPI_SRC_DIR}"
    DIFF=$(diff "${KPI_SRC_DIR}/dependencies/pip/dev_requirements.txt" "/srv/tmp/pip_dependencies.txt")
    if [[ -n "$DIFF" ]]; then
        echo "Syncing pip dependencies..."
        pip-sync dependencies/pip/dev_requirements.txt 1>/dev/null
        cp "dependencies/pip/dev_requirements.txt" "/srv/tmp/pip_dependencies.txt"
    fi

    if [[ -n "$RAVEN_DSN" ]]; then
        echo "Sentry detected. Installing \`raven\` pip dependency..."
        pip install raven
    fi

    echo "Running \`kpi\` container with \`runserver_plus\` debugging application server."
    exec python manage.py runserver_plus 0:8000
fi
