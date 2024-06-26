#!/bin/bash
set -e
source /etc/profile

# Run the Celery worker for low-priority jobs ONLY

cd "${KPI_SRC_DIR}"

AUTOSCALE_MIN="${CELERY_AUTOSCALE_MIN:-2}"
AUTOSCALE_MAX="${CELERY_AUTOSCALE_MAX:-6}"

exec celery -A kobo worker --loglevel=info \
    --hostname=kpi_low_priority_worker@%h \
    --logfile=${KPI_LOGS_DIR}/celery_kpi_low_priority_worker.log \
    --pidfile=/tmp/celery_kpi_low_priority_worker.pid \
    --queues=kpi_low_priority_queue \
    --exclude-queues=kpi_queue,kobocat_queue \
    --uid=${UWSGI_USER} \
    --gid=${UWSGI_GROUP} \
    --autoscale ${AUTOSCALE_MIN},${AUTOSCALE_MAX}
