from kobo.apps.audit_log.models import AuditLog
from kobo.apps.kobo_auth.shortcuts import User

CHUNK_SIZE = 1000


def process_chunk(from_user_pk):
    user_ids = list(
        User.objects.order_by('pk')
        .filter(
            pk__gt=from_user_pk,
            # Filter users that have been removed
            is_active=False,
            extra_details__date_removed__isnull=False,
        )
        .values_list('id', flat=True)[:CHUNK_SIZE]
    )
    users_count = len(user_ids)
    if users_count > 0:
        print(f'Processing chunk of {users_count} users ...')
        AuditLog.objects.filter(user_id__in=user_ids).update(user_id=None)
        return user_ids[users_count - 1]

    return None


def run():
    """
    Set to null user_id for removed users in audit logs
    """

    last_pk = 0
    while True:
        last_pk = process_chunk(last_pk)
        if last_pk is None:
            break
