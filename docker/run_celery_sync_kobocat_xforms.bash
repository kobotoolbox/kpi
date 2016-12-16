#!/bin/bash
set -e
source /etc/profile

# Run a single-process Celery worker dedicated to `sync_kobocat_xforms` jobs.
cd "${KPI_SRC_DIR}"
exec celery worker -A kobo --beat --loglevel=info \
    --hostname=sync_kobocat_xforms_worker@%h \
    --logfile=${KPI_LOGS_DIR}/celery_sync_kobocat_xforms.log \
    --pidfile=/tmp/celery_sync_kobocat_xforms.pid \
    --queues=sync_kobocat_xforms_queue \
    --concurrency=1
