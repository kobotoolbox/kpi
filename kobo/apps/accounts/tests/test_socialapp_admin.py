from allauth.socialaccount.models import SocialApp
from django.contrib.messages import WARNING
from django.test import Client, TestCase
from django.urls import reverse

from kobo.apps.accounts.constants import MAX_DISPLAYED_SSO_PROVIDERS
from kobo.apps.accounts.models import SocialAppCustomData
from kobo.apps.accounts.utils import get_hidden_public_social_app_names
from kobo.apps.kobo_auth.shortcuts import User


def make_app(name, is_public=None):
    """
    `is_public=None` creates no custom data row, which also counts as public
    """
    app = SocialApp.objects.create(
        provider='openid_connect',
        provider_id=name.lower(),
        name=name,
        client_id=f'{name.lower()}-client-id',
    )
    if is_public is not None:
        SocialAppCustomData.objects.create(social_app=app, is_public=is_public)
    return app


class HiddenSocialAppNamesTestCase(TestCase):
    """
    The login and registration screens show buttons for the first
    `MAX_DISPLAYED_SSO_PROVIDERS` public providers only, oldest first
    """

    def test_none_hidden_up_to_the_limit(self):
        for i in range(MAX_DISPLAYED_SSO_PROVIDERS):
            make_app(f'App{i}')
        assert get_hidden_public_social_app_names() == []

    def test_newest_public_providers_are_hidden(self):
        make_app('Oldest', is_public=True)
        make_app('Second')
        make_app('Third', is_public=True)
        make_app('Fourth')
        make_app('Fifth', is_public=True)
        assert get_hidden_public_social_app_names() == ['Fourth', 'Fifth']

    def test_private_providers_do_not_take_a_slot(self):
        make_app('Private', is_public=False)
        make_app('One')
        make_app('Two')
        make_app('Three')
        assert get_hidden_public_social_app_names() == []


class SocialAppAdminDisplayLimitTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client = Client()
        self.client.force_login(User.objects.get(username='adminuser'))

    def _add_app_via_admin(self, name):
        return self.client.post(
            reverse('admin:socialaccount_socialapp_add'),
            {
                'provider': 'openid_connect',
                'provider_id': name.lower(),
                'name': name,
                'client_id': f'{name.lower()}-client-id',
                'secret': '',
                'key': '',
                'settings': '{}',
                '_save': 'Save',
            },
            follow=True,
        )

    def _warnings(self, response):
        return [
            str(message)
            for message in response.context['messages']
            if message.level == WARNING
        ]

    def test_add_page_shows_limit_help_text(self):
        response = self.client.get(reverse('admin:socialaccount_socialapp_add'))
        self.assertContains(
            response,
            f'Only the first {MAX_DISPLAYED_SSO_PROVIDERS} public providers',
        )

    def test_changelist_is_oldest_first(self):
        for name in ['Zeta', 'Alpha', 'Mu']:
            make_app(name)
        response = self.client.get(reverse('admin:socialaccount_socialapp_changelist'))
        assert [app.name for app in response.context['cl'].result_list] == [
            'Zeta',
            'Alpha',
            'Mu',
        ]

    def test_no_warning_within_the_limit(self):
        for i in range(MAX_DISPLAYED_SSO_PROVIDERS - 1):
            make_app(f'App{i}')
        response = self._add_app_via_admin('Last')
        assert SocialApp.objects.filter(name='Last').exists()
        assert self._warnings(response) == []

    def _save_custom_data_via_admin(self, app, is_public):
        """
        Add or change `app`'s `SocialAppCustomData` through the admin
        """
        custom_data = SocialAppCustomData.objects.filter(social_app=app).first()
        if custom_data:
            url = reverse(
                'admin:accounts_socialappcustomdata_change', args=[custom_data.pk]
            )
        else:
            url = reverse('admin:accounts_socialappcustomdata_add')
        data = {
            'social_app': app.pk,
            'domains-TOTAL_FORMS': '1',
            'domains-INITIAL_FORMS': '0',
            'domains-MIN_NUM_FORMS': '0',
            'domains-MAX_NUM_FORMS': '1000',
            'domains-0-domain': '',
            'domains-0-id': '',
            '_save': 'Save',
        }
        if is_public:
            data['is_public'] = 'on'
        response = self.client.post(url, data, follow=True)
        assert response.status_code == 200
        assert SocialAppCustomData.objects.get(social_app=app).is_public is is_public
        return response

    def test_warns_but_saves_when_over_the_limit(self):
        for i in range(MAX_DISPLAYED_SSO_PROVIDERS):
            make_app(f'App{i}')
        response = self._add_app_via_admin('Extra')
        assert SocialApp.objects.filter(name='Extra').exists()
        warnings = self._warnings(response)
        assert len(warnings) == 1
        assert 'Not shown: Extra.' in warnings[0]

    def test_custom_data_admin_warns_when_making_a_provider_public(self):
        for i in range(MAX_DISPLAYED_SSO_PROVIDERS):
            make_app(f'App{i}')
        extra = make_app('Extra', is_public=False)
        response = self._save_custom_data_via_admin(extra, is_public=True)
        warnings = self._warnings(response)
        assert len(warnings) == 1
        assert 'Not shown: Extra.' in warnings[0]

    def test_hiding_an_older_provider_clears_the_warning(self):
        oldest = make_app('Oldest')
        for i in range(MAX_DISPLAYED_SSO_PROVIDERS):
            make_app(f'App{i}')
        assert get_hidden_public_social_app_names() == ['App2']

        response = self._save_custom_data_via_admin(oldest, is_public=False)
        assert self._warnings(response) == []
        assert get_hidden_public_social_app_names() == []

    def test_warning_names_only_the_providers_still_hidden(self):
        oldest = make_app('Oldest', is_public=True)
        for i in range(MAX_DISPLAYED_SSO_PROVIDERS + 1):
            make_app(f'App{i}')
        assert get_hidden_public_social_app_names() == ['App2', 'App3']

        response = self._save_custom_data_via_admin(oldest, is_public=False)
        warnings = self._warnings(response)
        assert len(warnings) == 1
        assert 'Not shown: App3.' in warnings[0]
