from django.core.checks import run_checks
from django.test import TestCase, override_settings

from ..constants import MUST_COMPLETE_LONG_RUNNING_MIGRATIONS
from ..models import LongRunningMigration, LongRunningMigrationStatus


@override_settings(
    CACHES={
        'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}
    }
)
class LongRunningMigrationSystemCheckTestCase(TestCase):

    def test_system_check_fails_when_not_completed(self):
        errors = run_checks()

        assert any(
            e.id == 'long_running_migrations.E001'
            for e in errors
        )

    def test_system_check_passes_when_completed(self):
        LongRunningMigration.objects.filter(
            name__in=MUST_COMPLETE_LONG_RUNNING_MIGRATIONS
        ).update(status=LongRunningMigrationStatus.COMPLETED)

        errors = run_checks()

        assert not any(
            e.id == 'long_running_migrations.E001'
            for e in errors
        )
