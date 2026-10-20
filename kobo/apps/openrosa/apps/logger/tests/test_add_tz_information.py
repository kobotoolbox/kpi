from datetime import timedelta
from unittest.mock import call, patch

from django.core.cache import cache
from django.core.management import call_command
from django.db.migrations.recorder import MigrationRecorder
from django.test import TestCase, override_settings

from kobo.apps.openrosa.apps.logger.management.commands.add_tz_information_to_submission_times import (
    execute_mongo_query,
)
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kobo.apps.openrosa.libs.utils.viewer_tools import get_mongo_userform_id
from kpi.models import Asset
from kpi.utils.mongo_helper import MongoHelper


class TestAddTzInformation(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.asset = Asset.objects.get(id=1)
        self.asset.save()
        self.asset.deploy(backend='mock')
        cache.clear()
        self.xform = XForm.objects.get(kpi_asset_uid=self.asset.uid)
        MongoHelper.delete_many({})

    def test_mongo_command_is_idempotent(self):
        mock_submissions = [
            {'__version__': self.asset.latest_deployed_version_uid, 'q1': 'a1'}
            for _ in range(3)
        ]
        self.asset.deployment.mock_submissions(mock_submissions)
        # initial submission times will have the tz suffix +00:00
        initial_submission_times = {
            document['_id']: document['_submission_time']
            for document in MongoHelper.get_instances(
                get_mongo_userform_id(self.xform)
            )[0]
        }
        pks = list(initial_submission_times.keys())

        # remove TZ info to simulate older instances
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
        for document in MongoHelper.get_instances(get_mongo_userform_id(self.xform))[0]:
            assert (
                document['_submission_time']
                == initial_submission_times[document['_id']][0:-6]
            )

        execute_mongo_query(pks)
        for document in MongoHelper.get_instances(get_mongo_userform_id(self.xform))[0]:
            assert (
                document['_submission_time']
                == initial_submission_times[document['_id']]
            )
        execute_mongo_query(pks)
        for document in MongoHelper.get_instances(get_mongo_userform_id(self.xform))[0]:
            assert (
                document['_submission_time']
                == initial_submission_times[document['_id']]
            )

    @override_settings(LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE=2)
    def test_instances_are_batched(self):
        format_updated_date = MigrationRecorder.Migration.objects.get(
            app='viewer', name='0008_update_submission_time_format'
        ).applied
        mock_submissions = [
            {'__version__': self.asset.latest_deployed_version_uid, 'q1': 'a1'}
            for _ in range(6)
        ]
        self.asset.deployment.mock_submissions(mock_submissions)
        Instance.objects.filter(xform=self.xform).update(
            date_created=format_updated_date - timedelta(days=1)
        )
        instance_pks = [mock_submission['_id'] for mock_submission in mock_submissions]
        with patch(
            'kobo.apps.openrosa.apps.logger.management.commands.add_tz_information_to_submission_times.execute_mongo_query'  # noqa
        ) as mock_execute_mongo_query:
            call_command(
                'add_tz_information_to_submission_times', xform_id=self.xform.id_string
            )
        assert mock_execute_mongo_query.mock_calls == [
            call([instance_pks[0], instance_pks[1]]),
            call([instance_pks[2], instance_pks[3]]),
            call([instance_pks[4], instance_pks[5]]),
        ]
