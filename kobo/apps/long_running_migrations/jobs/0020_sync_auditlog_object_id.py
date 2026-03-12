from django.conf import settings
from django.db import transaction
from django.db.models import CharField, F
from django.db.models.functions import Cast

from kobo.apps.audit_log.models import AuditLog

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_BATCH_SIZE


def run():
    """
    Sync the `object_id_tmp` field with the string representation of `object_id`
    for all AuditLog entries where `object_id_tmp` is null, as part of the
    migration from BigInt to String for `object_id`.
    """
    while True:
        audit_logs = list(
            AuditLog.objects.filter(
                object_id_tmp__isnull=True
            ).values_list('id', flat=True)[:CHUNK_SIZE]
        )
        if not audit_logs:
            break

        with transaction.atomic():
            AuditLog.objects.filter(id__in=audit_logs).update(
                object_id_tmp=Cast(F('object_id'), CharField())
            )
