#!/bin/bash
set -e
source /etc/profile

# Run the main Celery worker (will not process `sync_kobocat_xforms` jobs).
cd "${KPI_SRC_DIR}"
exec celery worker -A kobo --loglevel=info \
    --hostname=kpi_main_worker@%h \
    --logfile=${KPI_LOGS_DIR}/celery.log \
    --pidfile=/tmp/celery.pid \
    --exclude-queues=sync_kobocat_xforms_queue
