from django.test import override_settings
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import PERM_VIEW_ASSET, PERM_VIEW_SUBMISSIONS
from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetDetailTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.object_permission import get_anonymous_user


class UsageAPITestCase(BaseAssetDetailTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.asset = Asset.objects.create(
            owner=User.objects.get(username='someuser')
        )
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
                '_submission_time': '2022-09-07T13:21:33',
            },
            {
                '__version__': self.asset.latest_deployed_version.uid,
                'q1': 'a3',
                '_submitted_by': '',
                '_submission_time': '2022-09-12T16:31:33',
            },
            {
                '__version__': self.asset.latest_deployed_version.uid,
                'q1': 'a1',
                '_submitted_by': '',
                '_submission_time': '2022-09-12T17:31:33',
            },
        ]

        self.asset.deployment.mock_submissions(submissions)

    @override_settings(DEFAULT_SUBMISSIONS_COUNT_NUMBER_OF_DAYS=10000)
    def test_count_endpoint_owner(self):
        # Submission submitted time is 2022-09-12.
        # DEFAULT_SUBMISSIONS_COUNT_NUMBER_OF_DAYS must be big enough to include
        # this date.
        count_url = reverse(
            self._get_endpoint('asset-counts-list'),
            kwargs={'parent_lookup_asset': self.asset.uid}
        )
        # Test owner
        response = self.client.get(count_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_submission_count'], 3)
        self.assertEqual(len(response.data['daily_submission_counts']), 2)
        self.assertEqual(response.data['daily_submission_counts']['2022-09-12'], 2)

    def test_count_endpoint_anonymous_user(self):
        count_url = reverse(
            self._get_endpoint('asset-counts-list'),
            kwargs={'parent_lookup_asset': self.asset.uid}
        )
        # Test anonymous user
        self.client.logout()
        response = self.client.get(count_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_count_endpoint_anonymous_user_public_access(self):
        count_url = reverse(
            self._get_endpoint('asset-counts-list'),
            kwargs={'parent_lookup_asset': self.asset.uid}
        )
        # Test anonymous user with public access to data
        anonymous_user = get_anonymous_user()
        self.asset.assign_perm(anonymous_user, PERM_VIEW_SUBMISSIONS)
        self.client.logout()
        response = self.client.get(count_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_count_endpoint_another_user_no_perms(self):
        count_url = reverse(
            self._get_endpoint('asset-counts-list'),
            kwargs={'parent_lookup_asset': self.asset.uid}
        )
        # Test another user without perms
        self.client.login(username='anotheruser', password='anotheruser')
        anotheruser = User.objects.get(username='anotheruser')
        self.assertNotIn(PERM_VIEW_ASSET, self.asset.get_perms(anotheruser))
        response = self.client.get(count_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(DEFAULT_SUBMISSIONS_COUNT_NUMBER_OF_DAYS=10000)
    def test_count_endpoint_another_with_perms(self):
        # Submission submitted time is 2022-09-12.
        # DEFAULT_SUBMISSIONS_COUNT_NUMBER_OF_DAYS must be big enough to include
        # this date.
        count_url = reverse(
            self._get_endpoint('asset-counts-list'),
            kwargs={'parent_lookup_asset': self.asset.uid}
        )
        response = self.client.get(count_url)
        # Test another user with perms
        anotheruser = User.objects.get(username='anotheruser')
        self.asset.assign_perm(anotheruser, PERM_VIEW_SUBMISSIONS)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_submission_count'], 3)
        self.assertEqual(len(response.data['daily_submission_counts']), 2)
        self.assertEqual(response.data['daily_submission_counts']['2022-09-12'], 2)
