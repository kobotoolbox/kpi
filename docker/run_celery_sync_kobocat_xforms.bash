#!/bin/bash
set -e
source /etc/profile

# Run a single-process Celery worker dedicated to `sync_kobocat_xforms` jobs.
cd "${KPI_SRC_DIR}"
# Only run one worker with `--beat`, regardless of `--queues` or
# `--exclude-queues`
exec celery worker -A kobo --loglevel=info \
    --hostname=sync_kobocat_xforms_worker@%h \
    --logfile=${KPI_LOGS_DIR}/celery_sync_kobocat_xforms.log \
    --pidfile=/tmp/celery_sync_kobocat_xforms.pid \
    --queues=sync_kobocat_xforms_queue \
    --concurrency=1 \
    --maxtasksperchild=1
    # Watch out: this may be changed in 4.x to `--max-tasks-per-child` per
    # http://docs.celeryproject.org/en/latest/reference/celery.bin.worker.html#cmdoption-celery-worker-max-tasks-per-child
