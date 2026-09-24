from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings

from kobo.apps.openrosa.apps.logger.utils.attachment_restore import (
    AttachmentRestorer,
    ProjectAlreadyBeingRestoredError,
    get_project_xform,
    log_collector,
)
from kobo.apps.support_tools.models import (
    AttachmentRestoreJob,
    AttachmentRestoreJobStatus,
)
from kobo.celery import celery_app


@celery_app.task(
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
    queue='kpi_low_priority_queue',
)
def run_attachment_restore_job(job_id: int):
    """
    Restore the attachments of one project that were soft deleted by mistake.

    Launched from the admin, where support fills a row in. Everything the run
    is asked to do is read from that row, and everything it has to say is
    written back to it, which is also where it is read.

    The run resumes where the previous one stopped, so hitting the soft time
    limit only costs the batch in progress: the task writes what it has and
    re-queues itself, leaving the row in progress. A hard kill, an OOM or a pod
    eviction, leaves the row in progress with nothing to pick it up, and the
    admin shows it as interrupted once the lock expires.
    """

    job = AttachmentRestoreJob.objects.get(pk=job_id)
    lines, log = log_collector()
    restorer = None
    requeue = False
    status = AttachmentRestoreJobStatus.COMPLETED

    job.status = AttachmentRestoreJobStatus.IN_PROGRESS
    job.save(update_fields=['status', 'date_modified'])

    try:
        xform = get_project_xform(job.asset_uid)
        restorer = AttachmentRestorer(
            xform, dry_run=job.dry_run, resume=job.resume, log=log
        )
        restorer.run()
    except ProjectAlreadyBeingRestoredError as e:
        # Somebody got there first, which is not a failure worth retrying, but
        # not a completion either: the row stays in progress and shows as
        # interrupted once the other run lets the project go
        log(
            f'{e} Nothing was done: use "Run again" on this row once the'
            f' project is free.'
        )
        status = AttachmentRestoreJobStatus.IN_PROGRESS
    except SoftTimeLimitExceeded:
        log(
            'Interrupted by the task time limit. Progress is saved and the job'
            ' has been re-queued; it will pick up where it stopped.'
        )
        status = AttachmentRestoreJobStatus.IN_PROGRESS
        requeue = True
    except Exception as e:
        log(f'FAILED. {type(e).__name__}: {e}')
        status = AttachmentRestoreJobStatus.FAILED
        raise
    finally:
        _save_progress(job, status, lines, restorer)

    # Only once this run's log and counts are on the row. The continuation
    # reads that same row, and the restorer let go of the project before this
    # handler ran, so queueing any earlier lets the two of them overwrite each
    # other from copies neither has reread
    if requeue:
        run_attachment_restore_job.delay(job_id)


def _save_progress(
    job: AttachmentRestoreJob,
    status: str,
    lines: list,
    restorer: AttachmentRestorer = None,
):
    """
    Write back what this run did, adding to what earlier runs of the same row
    already reported rather than replacing it.
    """

    job.status = status
    job.log = '\n'.join(filter(None, [job.log, *lines]))

    if restorer:
        job.scanned += restorer.scanned
        job.restored += restorer.restored

    job.save(update_fields=['status', 'log', 'scanned', 'restored', 'date_modified'])
