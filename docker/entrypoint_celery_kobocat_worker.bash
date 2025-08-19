#!/bin/bash
set -e
source /etc/profile

# Run the main Celery worker (will NOT process low-priority jobs)

cd "${KPI_SRC_DIR}"

AUTOSCALE_MIN="${CELERY_AUTOSCALE_MIN:-2}"
AUTOSCALE_MAX="${CELERY_AUTOSCALE_MAX:-6}"

exec celery -A kobo worker --loglevel=info \
    --hostname=kobocat_worker@%h \
    --logfile=${KPI_LOGS_DIR}/celery_kobocat_worker.log \
    --pidfile=/tmp/celery_kobocat_worker.pid \
    --queues=kobocat_queue \
    --exclude-queues=kpi_low_priority_queue,kpi_queue \
    --uid=${UWSGI_USER} \
    --gid=${UWSGI_GROUP} \
    --autoscale ${AUTOSCALE_MIN},${AUTOSCALE_MAX}
