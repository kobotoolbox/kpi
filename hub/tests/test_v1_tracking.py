from rest_framework import status

from ddt import data, ddt, unpack
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import KpiTestCase
from hub.models.v1_user_tracker import V1UserTracker


@ddt
class V1TrackingTests(KpiTestCase):

    def setUp(self):
        super().setUp()
        self.user = User.objects.get(username='someuser')
        self.client.force_login(self.user)
        V1UserTracker.objects.filter(user=self.user).delete()

    @data(
        ('/assets/', 1),
        ('/api/v2/assets/', 0),
        ('/asset_snapshots/', 1),
        ('/api/v1/user', 1),
        ('/tags/', 1),
        ('/api/v2/tags/', 0),
        ('/imports/', 1),
        ('/exports/', 1),
    )
    @unpack
    def test_v1_access_creates_tracker_entry(self, v1_url, expected_count):
        response = self.client.get(v1_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(V1UserTracker.objects.count(), expected_count)

    def test_last_accessed_path_is_recorded(self):
        v1_url = '/assets/'
        self.client.get(v1_url)
        tracker_entry = V1UserTracker.objects.get(user=self.user)
        self.assertEqual(tracker_entry.last_accessed_path, v1_url)

    def test_anonymous_access_does_not_create_tracker_entry(self):
        self.client.logout()
        v1_url = '/assets/'

        self.client.get(v1_url)
        self.assertEqual(V1UserTracker.objects.count(), 0)
