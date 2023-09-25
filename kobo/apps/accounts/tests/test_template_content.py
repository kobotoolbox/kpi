from constance.test import override_config
from django.test import Client, TestCase
from django.urls import reverse

from kpi.utils.json import LazyJSONSerializable


class SignupFormTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.url = reverse('account_signup')

    @override_config(
        ENABLE_CUSTOM_PASSWORD_GUIDANCE_TEXT=True,
        CUSTOM_PASSWORD_GUIDANCE_TEXT=LazyJSONSerializable({
            'default': 'The kind of custom password guidance text',
        }),
    )
    def test_custom_password_guidance_text_enabled(self):
        """
        Test that custom content that is enabled in Constance is rendered
        if the feature is enabled.
        """
        response = self.client.get(self.url)
        assert response.status_code == 200
        assert (
            'The kind of custom password guidance text'
            in response.rendered_content
        )

    @override_config(
        ENABLE_CUSTOM_PASSWORD_GUIDANCE_TEXT=False,
        CUSTOM_PASSWORD_GUIDANCE_TEXT=LazyJSONSerializable({
            'default': 'The kind of custom password guidance text',
        }),
    )
    def test_custom_password_guidance_text_disabled(self):
        """
        Test that custom content that is enabled in Constance is rendered
        if the feature is not enabled.
        """
        response = self.client.get(self.url)
        assert response.status_code == 200
        assert (
            'The kind of custom password guidance text'
            not in response.rendered_content
        )
