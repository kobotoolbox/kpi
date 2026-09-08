from django.urls import reverse
from model_bakery import baker
from rest_framework import status
from rest_framework.test import APITestCase


def make_social_app(provider_id='nca', name='Norwegian Church Aid', **kwargs):
    kwargs.setdefault('provider', 'openid_connect')
    kwargs.setdefault('client_id', 'client-id-should-not-leak')
    kwargs.setdefault('secret', 'secret-should-not-leak')
    kwargs.setdefault('key', 'key-should-not-leak')
    kwargs.setdefault('settings', {'server_url': 'https://idp.example.com/'})
    return baker.make(
        'socialaccount.SocialApp', provider_id=provider_id, name=name, **kwargs
    )


class SocialAppDetailTestCase(APITestCase):
    """
    `GET /api/v2/social-apps/<provider_id>/` the data the SPA needs to render the
    "Log in with …" screen that `/accounts/oidc/<provider_id>/login/` renders today
    """

    def url_for(self, provider_id):
        return reverse('api_v2:social-app-detail', args=[provider_id])

    def test_retrieve_public_provider(self):
        app = make_social_app()
        baker.make('accounts.SocialAppCustomData', social_app=app, is_public=True)
        response = self.client.get(self.url_for('nca'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {'provider_id': 'nca', 'name': 'Norwegian Church Aid'},
        )

    def test_retrieve_hidden_provider(self):
        """
        A provider hidden from the login page is still reachable by anyone holding
        its link, so the endpoint that resolves that link must resolve it too
        """
        app = make_social_app(provider_id='acted', name='ACTED Azure AD')
        baker.make('accounts.SocialAppCustomData', social_app=app, is_public=False)
        response = self.client.get(self.url_for('acted'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {'provider_id': 'acted', 'name': 'ACTED Azure AD'},
        )

    def test_retrieve_provider_without_custom_data(self):
        """
        An app with no `SocialAppCustomData` row counts as public
        """
        make_social_app()
        response = self.client.get(self.url_for('nca'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['name'], 'Norwegian Church Aid')

    def test_unknown_provider_id_returns_404(self):
        make_social_app()
        response = self.client.get(self.url_for('does-not-exist'))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_no_providers_configured_returns_404(self):
        response = self.client.get(self.url_for('nca'))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_ambiguous_provider_id_returns_404(self):
        """
        Two apps answering to the same id is a misconfiguration that breaks login
        too; the endpoint reports it as unresolvable rather than picking one
        """
        make_social_app(provider_id='dupe', name='First')
        make_social_app(provider_id='dupe', name='Second')
        with self.assertLogs('console_logger', level='ERROR'):
            response = self.client.get(self.url_for('dupe'))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_provider_without_provider_id_falls_back_to_provider(self):
        """
        allauth identifies an app by `provider_id` when it has one and by
        `provider` otherwise, and resolves either as the URL segment
        """
        make_social_app(provider_id='', provider='microsoft', name='Microsoft')
        response = self.client.get(self.url_for('microsoft'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(), {'provider_id': 'microsoft', 'name': 'Microsoft'}
        )

    def test_never_exposes_credentials(self):
        make_social_app()
        response = self.client.get(self.url_for('nca'))
        self.assertEqual(set(response.json().keys()), {'provider_id', 'name'})
        for secret in (
            'client-id-should-not-leak',
            'secret-should-not-leak',
            'key-should-not-leak',
            'idp.example.com',
        ):
            self.assertNotContains(response, secret)

    def test_available_to_anonymous_users(self):
        make_social_app()
        # Deliberately no login: the screen this feeds is the login screen
        response = self.client.get(self.url_for('nca'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_no_list_endpoint(self):
        make_social_app()
        response = self.client.get('/api/v2/social-apps/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_provider_id_may_contain_a_dot(self):
        """
        `/accounts/oidc/<provider_id>/login/` accepts any non-slash segment
        """
        make_social_app(provider_id='example.org', name='Example Org')
        response = self.client.get(self.url_for('example.org'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['provider_id'], 'example.org')
