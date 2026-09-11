from django.conf import settings
from django.db.models import Q

from kobo.apps.trash_bin.models import TrashStatus
from kobo.apps.trash_bin.models.account import AccountTrash
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kobo.apps.trash_bin.models.project import ProjectTrash
from kpi.utils.log import logging

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_BATCH_SIZE


def run():
    """
    Restart the trash bin objects which failed before the error message was
    reliably recorded.

    Argless exceptions stringify to '', so these objects were flagged as
    `FAILED` with an empty `failure_error` and matched no transient pattern,
    which meant nothing ever restarted them. Putting them back in progress is
    enough for `task_restarter` to pick them up, since they have not been
    updated for a long time and therefore look stuck. Any new failure now
    records a real message
    """
    empty_errors = Q(metadata__failure_error='') | ~Q(metadata__has_key='failure_error')

    for model in (AccountTrash, ProjectTrash, AttachmentTrash):
        released = 0
        while True:
            batch = list(
                model.objects.filter(
                    empty_errors, status=TrashStatus.FAILED
                ).values_list('pk', flat=True)[:CHUNK_SIZE]
            )
            if not batch:
                break

            # The predicates are reapplied so that a row restarted by a superuser
            # in the meantime, which may have failed again with a real error by
            # now, keeps its newer state. `date_modified` is deliberately left
            # untouched: these objects have not been updated for a while, which
            # is what makes `task_restarter` treat them as stuck and restart them
            released += model.objects.filter(
                empty_errors, pk__in=batch, status=TrashStatus.FAILED
            ).update(status=TrashStatus.IN_PROGRESS)
            logging.info(f'[LRM 0032] released {released} {model.__name__} objects')
