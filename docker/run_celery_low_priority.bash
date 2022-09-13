#!/bin/bash
set -e
source /etc/profile

# Run the main Celery worker (will process only low priority jobs).
# Start 2 processes by default; this will be overridden later, in Python code,
# according to the user's preference saved by django-constance
cd "${KPI_SRC_DIR}"

exec celery -A kobo worker --loglevel=info \
    --hostname=kpi_main_worker@%h \
    --logfile=${KPI_LOGS_DIR}/celery_low_priority.log \
    --pidfile=/tmp/celery_low_priority.pid \
    --queues=kpi_low_priority_queue \
    --exclude-queues=kpi_queue \
    --uid=${UWSGI_USER} \
    --gid=${UWSGI_GROUP} \
    --autoscale 2,2
