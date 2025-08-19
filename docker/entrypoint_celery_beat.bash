#!/bin/bash
set -e
source /etc/profile

# Run the main Celery worker (will not process `sync_kobocat_xforms` jobs).
cd "${KPI_SRC_DIR}"

exec celery -A kobo beat --loglevel=info \
    --logfile=${KPI_LOGS_DIR}/celery_beat.log \
    --pidfile=/tmp/celery_beat.pid \
    --scheduler django_celery_beat.schedulers:DatabaseScheduler \
    --uid=${UWSGI_USER} \
    --gid=${UWSGI_GROUP}
