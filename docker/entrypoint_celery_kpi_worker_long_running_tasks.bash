#!/bin/bash
set -e
source /etc/profile

# Run the Celery worker for long-running jobs ONLY

cd "${KPI_SRC_DIR}"

AUTOSCALE_MIN="${CELERY_AUTOSCALE_MIN:-2}"
AUTOSCALE_MAX="${CELERY_AUTOSCALE_MAX:-6}"

exec celery -A kobo worker --loglevel=info \
    --hostname=kpi_worker_long_running_tasks@%h \
    --logfile=${KPI_LOGS_DIR}/celery_kpi_worker_long_running_tasks.log \
    --pidfile=/tmp/celery_kpi_worker_long_running_tasks.pid \
    --queues=kpi_long_running_tasks_queue \
    --exclude-queues=kpi_queue,kobocat_queue,kpi_low_priority_queue \
    --uid=${UWSGI_USER} \
    --gid=${UWSGI_GROUP} \
    --autoscale ${AUTOSCALE_MIN},${AUTOSCALE_MAX}
