import importlib
from datetime import timedelta
from unittest.mock import call, patch

from django.conf import settings
from django.core.cache import cache
from django.db.migrations.recorder import MigrationRecorder
from django.test import TestCase, override_settings
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kpi.models import Asset
from kpi.utils.mongo_helper import MongoHelper

job_0033 = importlib.import_module(
    'kobo.apps.long_running_migrations.jobs.0033_add_submission_tz'
)


class TestAddTzInfo(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.format_updated_date = MigrationRecorder.Migration.objects.get(
            app='viewer', name='0008_update_submission_time_format'
        ).applied

    @override_settings(LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE=2)
    def test_add_submission_tz(self):
        # set up a bunch of users/xforms/submissions
        for i in range(6):
            u = User.objects.create(
                username=f'user_{i}',
                date_joined=self.format_updated_date - timedelta(days=1),
                is_active=True,
                last_login=timezone.now(),
            )
            for j in range(6):
                a = Asset.objects.create(
                    name=f'asset_{i}',
                    owner=u,
                    content={'survey': [{'name': 'q1', 'label': 'q1', 'type': 'text'}]},
                )
                a.save()
                a.deploy(backend='mock')
                submissions = [
                    {'__version__': a.latest_deployed_version_uid, 'q1': 'a1'}
                    for k in range(6)
                ]
                a.deployment.mock_submissions(submissions)

        # initially, the times will have tz info
        submission_times_with_tz_by_id = {
            submission['_id']: submission['_submission_time']
            for submission in settings.MONGO_DB.instances.find({})
        }

        # adjust date_created and remove tz info to simulate older submissions
        Instance.objects.all().update(
            date_created=self.format_updated_date - timedelta(days=1)
        )
        MongoHelper.update_many(
            {},
            [
                {
                    '_submission_time': {
                        '$arrayElemAt': [{'$split': ['$_submission_time', '+00:00']}, 0]
                    }
                }
            ],
        )

        # make sure we start out with no tz info
        for document in settings.MONGO_DB.instances.find({}):
            assert (
                document['_submission_time']
                == submission_times_with_tz_by_id[document['_id']][0:-6]
            )

        job_0033.run()

        # tz info should be back
        for document in settings.MONGO_DB.instances.find({}):
            assert (
                document['_submission_time']
                == submission_times_with_tz_by_id[document['_id']]
            )

    @override_settings(LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE=2)
    def test_inactive_and_new_users_are_ignored(self):
        # inactive
        User.objects.create(
            username='inactive',
            is_active=False,
            date_joined=self.format_updated_date - timedelta(days=1),
        )
        # too new
        User.objects.create(
            username='new',
            is_active=True,
            date_joined=self.format_updated_date + timedelta(days=1),
        )
        correct = User.objects.create(
            username='correct',
            date_joined=self.format_updated_date - timedelta(days=2),
            is_active=True,
            last_login=timezone.now(),
        )
        with patch.object(
            job_0033, 'get_xforms_queryset', return_value=XForm.objects.none()
        ) as patched_get_xforms:
            job_0033.run()
        patched_get_xforms.assert_called_once_with(0, correct.pk)

    @override_settings(LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE=2)
    def test_xforms_are_retrieved_in_batches(self):
        u = User.objects.create(
            username='user',
            date_joined=self.format_updated_date - timedelta(days=1),
            is_active=True,
            last_login=timezone.now(),
        )
        xform_pks = []
        for i in range(6):
            a = Asset.objects.create(
                name=f'asset_{i}',
                owner=u,
                content={'survey': [{'name': 'q1', 'label': 'q1', 'type': 'text'}]},
            )
            a.save()
            a.deploy(backend='mock')
            xform = XForm.objects.get(kpi_asset_uid=a.uid)
            xform_pks.append(xform.pk)
        with patch.object(
            job_0033, 'get_xforms_queryset', wraps=job_0033.get_xforms_queryset
        ) as patched_get_xforms:
            job_0033.run()
        assert patched_get_xforms.mock_calls == [
            call(0, u.pk),
            call(xform_pks[1], u.pk),
            call(xform_pks[3], u.pk),
            call(xform_pks[5], u.pk),
        ]
