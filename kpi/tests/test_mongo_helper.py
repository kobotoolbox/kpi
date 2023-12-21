from __future__ import annotations

import copy

from django.conf import settings
from django.test import TestCase
from model_bakery import baker

from kpi.tests.utils import baker_generators  # noqa
from kpi.utils.mongo_helper import MongoHelper


class MongoHelperTestCase(TestCase):
    def setUp(self):
        settings.MONGO_DB.instances.drop()

    def add_submissions(self, asset, submissions: list[dict]):
        for submission in submissions:
            submission['__version__'] = asset.latest_deployed_version.uid
        asset.deployment.mock_submissions(
            copy.deepcopy(submissions), flush_db=False
        )

    def assert_instances_count(self, instances: tuple, expected_count: int):
        assert instances[1] == expected_count

    def test_get_instances(self):
        users = baker.make('auth.User', _quantity=2)
        assets = []
        for user in users:
            asset = baker.make('kpi.Asset', owner=user)
            asset.deploy(backend='mock', active=True)
            assets.append(asset)
        (asset1, asset2) = assets
        userform_id1 = asset1.deployment.mongo_userform_id
        userform_id2 = asset2.deployment.mongo_userform_id

        # No submissions
        self.assert_instances_count(MongoHelper.get_instances(userform_id1), 0)

        submissions = [
            {
                'q1': 'a1',
            },
            {
                'q2': 'a2',
            },
        ]
        self.add_submissions(asset1, submissions)
        self.add_submissions(asset2, submissions)

        self.assert_instances_count(MongoHelper.get_instances(userform_id1), 2)
        self.assert_instances_count(MongoHelper.get_instances(userform_id2), 2)
        self.assert_instances_count(
            MongoHelper.get_instances(userform_id1, query={'q1': 'a1'}), 1
        )
        self.assert_instances_count(
            MongoHelper.get_instances(
                userform_id1, query={'expect': 'nothing'}
            ),
            0,
        )
