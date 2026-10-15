from django.core.checks import run_checks
from django.test import TestCase, override_settings

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models import Asset
from ..constants import MUST_COMPLETE_LONG_RUNNING_MIGRATIONS
from ..models import LongRunningMigration, LongRunningMigrationStatus


@override_settings(
    CACHES={
        'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}
    }
)
class LongRunningMigrationSystemCheckTestCase(TestCase):

    def setUp(self):
        """
        Do not rely on the rows inserted by the migrations: a
        `TransactionTestCase` that ran earlier in the same database (e.g. in
        parallel runs) flushes them.
        """

        for name in MUST_COMPLETE_LONG_RUNNING_MIGRATIONS:
            LongRunningMigration.objects.update_or_create(
                name=name,
                defaults={'status': LongRunningMigrationStatus.CREATED},
            )

    def test_system_check_fails_when_not_completed(self):
        # Create at least one asset to fake existing install
        someuser = User.objects.create_user(username='someuser', password='someuser')
        Asset.objects.create(owner=someuser, name='foo')

        errors = run_checks()

        assert any(
            e.id == 'long_running_migrations.E001'
            for e in errors
        )

    def test_system_check_passes_when_completed(self):
        # Create at least one asset to fake existing install
        someuser = User.objects.create_user(username='someuser', password='someuser')
        Asset.objects.create(owner=someuser, name='foo')

        # Fake migrations have run
        LongRunningMigration.objects.filter(
            name__in=MUST_COMPLETE_LONG_RUNNING_MIGRATIONS
        ).update(status=LongRunningMigrationStatus.COMPLETED)

        errors = run_checks()

        assert not any(
            e.id == 'long_running_migrations.E001'
            for e in errors
        )

    def test_system_check_passes_on_fresh_installs(self):
        errors = run_checks()

        assert not any(
            e.id == 'long_running_migrations.E001'
            for e in errors
        )
