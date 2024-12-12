from __future__ import annotations

from django.db.models import Count

from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.tasks import transfer_member_data_ownership_to_org
from ..models import LongRunningMigration


def django_migration_required() -> tuple[str, str]:
    return 'long_running_migrations', '0001_initial'


def run(migration: LongRunningMigration):
    organizations = Organization.objects.only('id').annotate(
        count=Count('organization_users')
    ).filter(count__gt=1)
    for organization in organizations:
        for user in organization.users.all():
            async_result = transfer_member_data_ownership_to_org.delay(user.pk)
            # Do something with `async_result`
