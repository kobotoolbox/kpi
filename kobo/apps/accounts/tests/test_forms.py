from constance.test import override_config
from django.test import TestCase, override_settings
from django.utils import translation
from model_bakery import baker
from pyquery import PyQuery

from kobo.apps.accounts.forms import SocialSignupForm
from kpi.utils.json import LazyJSONSerializable


class AccountFormsTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = baker.make('auth.User')
        cls.sociallogin = baker.make(
            "socialaccount.SocialAccount", user=cls.user
        )

    @override_settings(UNSAFE_SSO_REGISTRATION_EMAIL_DISABLE=True)
    def test_social_signup_form_not_email_disabled(self):
        form = SocialSignupForm(sociallogin=self.sociallogin)
        pq = PyQuery(str(form))
        assert (email_input := pq("[name=email]"))
        assert "readonly" in email_input[0].attrib

    @override_settings(UNSAFE_SSO_REGISTRATION_EMAIL_DISABLE=False)
    def test_social_signup_form_not_email_not_disabled(self):
        form = SocialSignupForm(sociallogin=self.sociallogin)
        pq = PyQuery(str(form))
        assert (email_input := pq("[name=email]"))
        assert "readonly" not in email_input[0].attrib

    def test_only_configurable_fields_can_be_removed(self):
        with override_config(USER_METADATA_FIELDS='{}'):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert 'username' in form.fields
            assert 'email' in form.fields

    def test_field_without_custom_label_can_be_required(self):
        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [{'name': 'name', 'required': True}]
            )
        ):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert form.fields['name'].required
            assert form.fields['name'].label == 'Full name'

    def test_field_with_only_default_custom_label(self):
        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {
                        'name': 'name',
                        'required': True,
                        'label': {'default': 'Secret Agent ID'},
                    }
                ]
            )
        ):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert form.fields['name'].required
            assert form.fields['name'].label == 'Secret Agent ID'

    def test_field_with_specific_and_default_custom_labels(self):
        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {
                        'name': 'name',
                        'required': True,
                        'label': {
                            'default': 'Secret Agent ID',
                            'es': 'ID de agente secreto',
                        },
                    }
                ]
            )
        ):
            with translation.override('es'):
                form = SocialSignupForm(sociallogin=self.sociallogin)
                assert form.fields['name'].required
                assert form.fields['name'].label == 'ID de agente secreto'
            with translation.override('en'):
                form = SocialSignupForm(sociallogin=self.sociallogin)
                assert form.fields['name'].required
                assert form.fields['name'].label == 'Secret Agent ID'
            with translation.override('fr'):
                form = SocialSignupForm(sociallogin=self.sociallogin)
                assert form.fields['name'].required
                assert form.fields['name'].label == 'Secret Agent ID'

    def test_field_with_custom_label_without_default(self):
        """
        The JSON schema should always require a default label, but the form
        should render labels properly even if the default is missing
        """
        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {
                        'name': 'organization',
                        'required': True,
                        'label': {
                            'fr': 'Organisation secrète',
                        },
                    },
                ]
            )
        ):
            with translation.override('fr'):
                form = SocialSignupForm(sociallogin=self.sociallogin)
                assert form.fields['organization'].required
                assert (
                    form.fields['organization'].label == 'Organisation secrète'
                )

    def test_field_without_custom_label_can_be_optional(self):
        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {
                        'name': 'organization',
                        'required': False,
                    },
                ]
            )
        ):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert not form.fields['organization'].required

    def test_field_with_custom_label_can_be_optional(self):
        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {
                        'name': 'organization',
                        'required': False,
                        'label': {
                            'default': 'Organization',
                            'fr': 'Organisation',
                            'es': 'Organización',
                        },
                    },
                ]
            )
        ):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert not form.fields['organization'].required
            assert form.fields['organization'].label == 'Organization'
            with translation.override('fr'):
                form = SocialSignupForm(sociallogin=self.sociallogin)
                assert form.fields['organization'].required is False
                assert form.fields['organization'].label == 'Organisation'
            with translation.override('es'):
                form = SocialSignupForm(sociallogin=self.sociallogin)
                assert form.fields['organization'].required is False
                assert form.fields['organization'].label == 'Organización'

    def test_not_supported_translation(self):
        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {
                        'name': 'organization',
                        'required': False,
                        'label': {
                            'default': 'Organization',
                            'fr': 'Organisation',
                        },
                    },
                ]
            )
        ):
            with translation.override('es'):
                form = SocialSignupForm(sociallogin=self.sociallogin)
                assert form.fields['organization'].required is False
                assert form.fields['organization'].label == 'Organization'
            with translation.override('ar'):
                form = SocialSignupForm(sociallogin=self.sociallogin)
                assert form.fields['organization'].required is False
                assert form.fields['organization'].label == 'Organization'

    def test_organization_type_valid_field(self):
        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {
                        'name': 'organization_type',
                        'required': False,
                    },
                ]
            )
        ):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert 'organization_type' in form.fields

    def test_newsletter_subscription_valid_field(self):
        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {
                        'name': 'newsletter_subscription',
                        'required': False,
                    },
                ]
            )
        ):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert 'newsletter_subscription' in form.fields
