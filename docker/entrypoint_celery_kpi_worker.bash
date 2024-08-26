#!/bin/bash
set -e
source /etc/profile

# Run the main Celery worker (will NOT process low-priority jobs)

cd "${KPI_SRC_DIR}"

AUTOSCALE_MIN="${CELERY_AUTOSCALE_MIN:-2}"
AUTOSCALE_MAX="${CELERY_AUTOSCALE_MAX:-6}"

exec celery -A kobo worker --loglevel=info \
    --hostname=kpi_worker@%h \
    --logfile=${KPI_LOGS_DIR}/celery_kpi_worker.log \
    --pidfile=/tmp/celery_kpi_worker.pid \
    --queues=kpi_queue \
    --exclude-queues=kpi_low_priority_queue,kobocat_queue \
    --uid=${UWSGI_USER} \
    --gid=${UWSGI_GROUP} \
    --autoscale ${AUTOSCALE_MIN},${AUTOSCALE_MAX}
