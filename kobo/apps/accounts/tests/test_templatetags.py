from allauth.socialaccount.models import SocialApp
from django.test import TestCase, override_settings

from kobo.apps.accounts.models import SocialAppCustomData
from kobo.apps.accounts.templatetags.get_provider_appname import get_social_apps
from .constants import SOCIALACCOUNT_PROVIDERS


@override_settings(SOCIALACCOUNT_PROVIDERS=SOCIALACCOUNT_PROVIDERS)
class TemplateTagsTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Delete any social app that could be added by migration
        # `0007_add_providers_from_environment_to_db`
        SocialApp.objects.all().delete()

        cls.social_app = SocialApp.objects.create(
            client_id='test.service.id',
            secret='test.service.secret',
            name='Test App',
            provider='Test App',
        )

    def test_no_social_apps_no_custom_data(self):
        assert not SocialAppCustomData.objects.exists()
        assert get_social_apps()

    def test_has_social_apps_no_public_apps(self):
        custom_data = SocialAppCustomData(social_app=self.social_app)
        custom_data.save()
        assert not get_social_apps()

    def test_has_social_apps_public_app(self):
        custom_data = SocialAppCustomData.objects.create(
            social_app=self.social_app,
            is_public=True
        )
        custom_data.save()
        assert list(get_social_apps()) == [self.social_app]
