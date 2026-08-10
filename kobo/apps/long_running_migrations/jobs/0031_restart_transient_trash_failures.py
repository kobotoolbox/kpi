from django.conf import settings
from django.db.models import Q

from kobo.apps.trash_bin.constants import RETRYABLE_FAILURE_PATTERNS
from kobo.apps.trash_bin.models import TrashStatus
from kobo.apps.trash_bin.models.account import AccountTrash
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kobo.apps.trash_bin.models.project import ProjectTrash
from kpi.utils.log import logging

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_BATCH_SIZE


def run():
    """
    Restart the trash bin objects which failed on a transient (infrastructure)
    error before those failures were kept in progress.

    They were flagged as `FAILED` and nothing ever restarted them, so they would
    wait for a superuser forever. Putting them back in progress is enough for
    `task_restarter` to pick them up, since they have not been updated for a
    long time and therefore look stuck
    """
    retryable_errors = Q()
    for pattern in RETRYABLE_FAILURE_PATTERNS:
        retryable_errors |= Q(metadata__failure_error__icontains=pattern)

    for model in (AccountTrash, ProjectTrash, AttachmentTrash):
        released = 0
        while True:
            batch = list(
                model.objects.filter(
                    retryable_errors, status=TrashStatus.FAILED
                ).values_list('pk', flat=True)[:CHUNK_SIZE]
            )
            if not batch:
                break

            # `date_modified` is deliberately left untouched: these objects have
            # not been updated for a while, which is what makes `task_restarter`
            # treat them as stuck and restart them
            model.objects.filter(pk__in=batch).update(status=TrashStatus.IN_PROGRESS)
            released += len(batch)
            logging.info(f'[LRM 0031] released {released} {model.__name__} objects')
