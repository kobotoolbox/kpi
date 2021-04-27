from datetime import datetime

from django.contrib.auth.models import User
from django.urls import reverse

from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatSubmissionCounter,
    KobocatUser,
)
from kpi.models.asset import Asset
from kpi.tests.base_test_case import BaseTestCase

class UserStatisticsTests(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')

    def test_new_users(self):
        user = User.objects.create(username='amanda', password='amanda')
        counters = KobocatSubmissionCounter.objects.all()
        counters_count = counters.count()
        self.assertEqual(counters_count, 1)

    def test_user_data(self):
        user = User.objects.get(username='someuser')
        asset = Asset.objects.create(content={'survey': [
            {'type': 'text',
             'label': 'Question 1',
             'name': 'q1',
             '$kuid': 'abc'},
            {'type': 'text',
             'label': 'Question 2',
             'name': 'q2',
             '$kuid': 'def'},
        ]}, owner=user, asset_type='survey')
        report_url = reverse(
            self._get_endpoint('asset-reports'), kwargs={'uid': self.asset_uid}
        )
        anotheruser = User.objects.get(username='someuser')
        self.asset.content = {
            'survey': [
                {
                    'type': 'select_one',
                    'label': 'q1',
                    'select_from_list_name': 'iu0sl99'
                },
            ],
            'choices': [
                {'name': 'a1', 'label': ['a1'], 'list_name': 'iu0sl99'},
                {'name': 'a3', 'label': ['a3'], 'list_name': 'iu0sl99'},
            ]
        }
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        submissions = [
            {
                '__version__': self.asset.latest_deployed_version.uid,
                'q1': 'a1',
                '_submitted_by': 'anotheruser',
            },
            {
                '__version__': self.asset.latest_deployed_version.uid,
                'q1': 'a3',
                '_submitted_by': '',
            },
        ]

        self.asset.deployment.mock_submissions(submissions)
        self.assertEqual()
        counts = KobocatSubmissionCounter.objects.get(user=user)
        date = datetime.now()
        self.assertEqual(counts.count, 2)
        self.assertEqual(counts.timestamp.year, date.year)
        self.assertEqual(counts.timestamp.month, date.month)
        self.assertEqual(counts.timestamp.day, 1)
