from django.urls import reverse

from kpi.tests.base_test_case import BaseTestCase


class HomeViewCacheTestCase(BaseTestCase):
    """
    The browser must not keep the app shell, so that pressing Back after logout
    can't bring back a page that still holds the previous user's data
    """

    fixtures = ['test_data']

    def _assert_not_stored(self, response):
        assert response.status_code == 200
        cache_control = {
            directive.strip() for directive in response['Cache-Control'].split(',')
        }
        expected = {'no-store', 'no-cache', 'must-revalidate', 'private'}
        assert expected.issubset(cache_control)

    def test_authenticated_response_is_not_stored(self):
        self.client.login(username='someuser', password='someuser')
        self._assert_not_stored(self.client.get(reverse('kpi-root')))
