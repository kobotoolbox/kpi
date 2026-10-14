from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings

from kobo.apps.support_tools.exceptions import ProjectAlreadyBeingRestoredError
from kobo.apps.support_tools.models import (
    AbstractRestoreJob,
    AttachmentRestoreJob,
    FormVersionsRestoreJob,
    RestoreJobStatus,
)
from kobo.apps.support_tools.utils.helpers import get_project_xform
from kobo.apps.support_tools.utils.logger import RestoreLogger
from kobo.apps.support_tools.utils.restorers.attachment import AttachmentRestorer
from kobo.apps.support_tools.utils.restorers.base import ProjectRestorer
from kobo.apps.support_tools.utils.restorers.form_versions import (
    FormVersionsRestorer,
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

    Launched from the admin, where support fills a row in. See
    `_run_restore_job()` for how the run reads that row and reports on it.
    """

    job = AttachmentRestoreJob.objects.get(pk=job_id)
    _run_restore_job(job, AttachmentRestorer, run_attachment_restore_job)


@celery_app.task(
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
    queue='kpi_low_priority_queue',
)
def run_form_versions_restore_job(job_id: int):
    """
    Record `meta/formVersions` in the submissions of one project that spanned
    several form versions before the server recorded them.

    Launched from the admin, where support fills a row in. See
    `_run_restore_job()` for how the run reads that row and reports on it.

    With `restore_attachments`, the run that walks the last submission queues
    the attachment restore on its own row, the way `--restore-attachments`
    chains it in the shell.
    """

    job = FormVersionsRestoreJob.objects.get(pk=job_id)
    restorer = _run_restore_job(
        job, FormVersionsRestorer, run_form_versions_restore_job
    )

    if not (job.restore_attachments and restorer and restorer.completed):
        return

    attachment_job = AttachmentRestoreJob.objects.create(
        asset_uid=job.asset_uid,
        dry_run=job.dry_run,
        resume=job.resume,
        created_by=job.created_by,
    )
    lines = [f'Attachment restore queued, see its row #{attachment_job.pk}.']
    if job.dry_run:
        lines.append(
            'Nothing was written above, so its count may be low: files under a'
            ' question only an intermediate version had are found once the'
            ' versions are recorded.'
        )
    job.log = '\n'.join(filter(None, [job.log, *lines]))
    job.save(update_fields=['log', 'date_modified'])

    run_attachment_restore_job.delay(attachment_job.pk)


def _run_restore_job(
    job: AbstractRestoreJob,
    restorer_class: type[ProjectRestorer],
    task: Task,
) -> ProjectRestorer | None:
    """
    Run the restore a row asks for, write back what it did, and return the
    restorer, or `None` when the project could not even be resolved.

    Everything the run is asked to do is read from the row, and everything it
    has to say is written back to it, which is also where support reads it.

    The run resumes where the previous one stopped, so hitting the soft time
    limit only costs the batch in progress: the task writes what it has and
    re-queues itself, leaving the row in progress. A hard kill, an OOM or a pod
    eviction, leaves the row in progress with nothing to pick it up, and the
    admin shows it as interrupted once the lock expires.
    """

    # What a run does, without the detail `-v 2` and `-v 3` add in the shell:
    # the row is read by support, and it grows with every run of the job
    log = RestoreLogger()
    restorer = None
    requeue = False
    status = RestoreJobStatus.COMPLETED

    job.status = RestoreJobStatus.IN_PROGRESS
    job.save(update_fields=['status', 'date_modified'])

    try:
        xform = get_project_xform(job.asset_uid)
        restorer = restorer_class(
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
        status = RestoreJobStatus.IN_PROGRESS
    except SoftTimeLimitExceeded:
        log(
            'Interrupted by the task time limit. Progress is saved and the job'
            ' has been re-queued; it will pick up where it stopped.'
        )
        status = RestoreJobStatus.IN_PROGRESS
        requeue = True
    except Exception as e:
        log(f'FAILED. {type(e).__name__}: {e}')
        status = RestoreJobStatus.FAILED
        raise
    finally:
        _save_progress(job, status, log.lines, restorer)

    # Only once this run's log and counts are on the row. The continuation
    # reads that same row, and the restorer let go of the project before this
    # handler ran, so queueing any earlier lets the two of them overwrite each
    # other from copies neither has reread
    if requeue:
        task.delay(job.pk)

    return restorer


def _save_progress(
    job: AbstractRestoreJob,
    status: str,
    lines: list,
    restorer: ProjectRestorer = None,
):
    """
    Write back what this run did, adding to what earlier runs of the same row
    already reported rather than replacing it.
    """

    job.status = status
    job.log = '\n'.join(filter(None, [job.log, *lines]))

    if restorer:
        job.scanned += restorer.scanned
        for field in job.counter_fields:
            setattr(job, field, getattr(job, field) + getattr(restorer, field))

    job.save(
        update_fields=[
            'status',
            'log',
            'scanned',
            *job.counter_fields,
            'date_modified',
        ]
    )
