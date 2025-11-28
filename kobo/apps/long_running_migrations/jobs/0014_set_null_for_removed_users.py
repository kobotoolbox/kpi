from django.conf import settings
from django.db.models.query import QuerySet

from kobo.apps.audit_log.models import AuditLog
from kobo.apps.kobo_auth.shortcuts import User


CHUNK_SIZE = 1000


def process_user(user_id):
    AuditLog.objects.filter(user_id=user_id).update(user_id=None)


def get_queryset(from_user_pk: int) -> QuerySet:
    users = (
        User.objects.order_by('pk')
        .filter(
            pk__gt=from_user_pk,
            # Filter users that have been removed
            is_active=False,
            extra_details__date_removed__isnull=False,
        )
        .values('id')[:CHUNK_SIZE]
    )

    return users


def run():
    """
    Set to null user_id for removed users in audit logs
    """

    migrated_users = 0
    last_pk = 0
    adapter = get_adapter()
    while True:
        users = get_queryset(last_pk)
        if not users:
            break

        users_count = len(users)
        last_pk = users[len(users) - 1]['id']
        print(f'Processing chunk of {users_count} users ...')
        # Let concurrent library automatically decide the number of workers
        for user in users
            process_user(user['id'])
