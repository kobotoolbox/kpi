from django.test import TestCase, override_settings
from allauth.socialaccount.models import SocialApp
from kobo.apps.accounts.models import SocialAppCustomData
from kobo.apps.accounts.templatetags.get_provider_appname import get_social_apps

# example app setup for testing
SOCIALACCOUNT_PROVIDERS = {
    "openid_connect": {
        "SERVERS": [
            {
                "id": "test-app",
                "name": "Test App",
                "server_url": "https://example.org/oauth",
                "APP": {
                    "client_id": "test.service.id",
                    "secret": "test.service.secret",
                },
            }
        ]
    }
}


@override_settings(SOCIALACCOUNT_PROVIDERS=SOCIALACCOUNT_PROVIDERS)
class TemplateTagsTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.social_app = SocialApp.objects.create(
            client_id="test.service.id",
            secret="test.service.secret",
            name="Test App",
            provider="Test App",
        )

    def test_has_social_apps_no_public_apps(self):
        custom_data = SocialAppCustomData(social_app=self.social_app)
        custom_data.save()
        assert not get_social_apps()

    def test_has_social_apps_public_app(self):
        assert list(get_social_apps()) == [self.social_app]
