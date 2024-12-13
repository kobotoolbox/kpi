from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from .models import LongRunningMigration, LongRunningMigrationStatus


def execute_long_running_migrations():
    yesterday = timezone.now() - timedelta(days=1)
    # Run tasks that were just created or are in progress yet older than 1 day
    for migration in LongRunningMigration.objects.filter(
        Q(status=LongRunningMigrationStatus.CREATED)
        | Q(status=LongRunningMigrationStatus.IN_PROGRESS)
        & Q(date_modified__lte=yesterday)
    ):
        migration.execute()
