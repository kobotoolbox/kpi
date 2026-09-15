from django.db import transaction

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import ProjectHistoryLog
from kobo.apps.openrosa.libs.utils.viewer_tools import (
    get_client_ip,
    get_human_readable_client_user_agent,
)
from kpi.constants import PROJECT_HISTORY_LOG_PROJECT_SUBTYPE
from kpi.utils.log import logging


def create_bulk_action_history_log(request, bulk_action) -> None:
    """
    Create the project history log row that represents a bulk processing job

    The row is later updated by `sync_bulk_action_history_log()` as child item
    statuses change, so `/history/` can expose live progress without creating a
    noisy log entry per submission.
    """
    try:
        metadata = {
            'asset_uid': bulk_action.asset.uid,
            'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
            'ip_address': get_client_ip(request),
            'source': get_human_readable_client_user_agent(request),
            'project_owner': bulk_action.asset.owner.username,
            'bulk_action': bulk_action.get_history_log_metadata(),
        }
        ProjectHistoryLog.objects.create(
            user=request.user,
            object_id=bulk_action.asset_id,
            action=AuditAction.BULK_PROCESSING,
            metadata=metadata,
        )
    except Exception:
        logging.exception(
            'Failed to create bulk processing history log for '
            f'{bulk_action.uid=}'
        )


def sync_bulk_action_history_log(bulk_action) -> None:
    """
    Refresh the bulk-specific metadata on the existing history log row
    """
    sync_bulk_action_history_log_by_uid(bulk_action.pk)


def sync_bulk_action_history_log_by_uid(bulk_action_uid: str) -> None:
    """
    Refresh the history log for a bulk action known only by its uid

    Callers that update a child item with `queryset.update()` never load the
    parent, so this avoids an extra query just to satisfy the signature
    """
    transaction.on_commit(lambda: _sync_bulk_action_history_log(bulk_action_uid))


def _sync_bulk_action_history_log(bulk_action_uid: str) -> None:
    from .models import SubsequenceBulkAction

    try:
        bulk_action = (
            SubsequenceBulkAction.objects.select_related('asset', 'asset__owner')
            .get(pk=bulk_action_uid)
        )
        # Child items finish in parallel, so several workers can reach this at
        # once. Refreshing the log is a read-modify-write of a single JSON blob,
        # which loses updates under concurrency: two workers both read `3`,
        # then write `4` and `5` in either order, and the counter can visibly go
        # backwards. Taking the row lock first keeps the stored snapshot
        # monotonic
        with transaction.atomic():
            history_log = (
                ProjectHistoryLog.objects.select_for_update()
                .filter(
                    action=AuditAction.BULK_PROCESSING,
                    metadata__asset_uid=bulk_action.asset.uid,
                    metadata__bulk_action__uid=bulk_action.uid,
                )
                .order_by('-date_created')
                .first()
            )
            if history_log is None:
                return

            bulk_action.refresh_from_db()
            metadata = history_log.metadata.copy()
            metadata['bulk_action'] = bulk_action.get_history_log_metadata()
            history_log.metadata = metadata
            history_log.save(update_fields=['metadata'])
    except Exception:
        logging.exception(
            'Failed to sync bulk processing history log for '
            f'{bulk_action_uid=}'
        )
