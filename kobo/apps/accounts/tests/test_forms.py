import dateutil
from constance.test import override_config
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings, Client
from django.urls import reverse
from django.utils import translation
from django.utils.timezone import now
from hub.models.sitewide_message import SitewideMessage
from model_bakery import baker
from pyquery import PyQuery
from rest_framework import status

from kobo.apps.accounts.forms import SignupForm, SocialSignupForm
from kpi.utils.json import LazyJSONSerializable


class AccountFormsTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = baker.make(settings.AUTH_USER_MODEL)
        cls.sociallogin = baker.make(
            "socialaccount.SocialAccount", user=cls.user
        )

    def setUp(self):
        self.client = Client()
        self.url = reverse('account_signup')

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
                assert form.fields['organization'].label == 'Organisation secrète'

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

    def test_tos_checkbox_appears_when_needed(self):
        assert not SitewideMessage.objects.filter(
            slug='terms_of_service'
        ).exists()
        form = SocialSignupForm(sociallogin=self.sociallogin)
        assert 'terms_of_service' not in form.fields

        # Create SitewideMessage object and verify that the checkbox for ToS
        # consent is present
        SitewideMessage.objects.create(
            slug='terms_of_service',
            body='tos agreement',
        )
        form = SocialSignupForm(sociallogin=self.sociallogin)
        assert 'terms_of_service' in form.fields

    def test_possible_to_register_when_no_tos(self):
        assert not SitewideMessage.objects.filter(
            slug='terms_of_service'
        ).exists()

        username = 'no_tos_for_me'
        email = username + '@example.com'
        data = {
            'name': username,
            'email': email,
            'password1': username,
            'password2': username,
            'username': username,
        }
        response = self.client.post(self.url, data)
        assert response.status_code == status.HTTP_302_FOUND
        # raise DoesNotExist if registration failed
        get_user_model().objects.get(username=username)

    def test_registration_when_tos_required(self):
        SitewideMessage.objects.create(
            slug='terms_of_service',
            body='tos agreement',
        )

        # Make sure it's impossible to register without agreeing to the terms
        # of service
        username = 'tos_reluctant'
        email = username + '@example.com'
        data = {
            'name': username,
            'email': email,
            'password1': username,
            'password2': username,
            'username': username,
        }
        response = self.client.post(self.url, data)
        # Django returns a 200 even when there are field errors
        assert response.status_code == status.HTTP_200_OK
        assert not get_user_model().objects.filter(username=username).exists()

        def now_without_microseconds():
            return now().replace(microsecond=0)

        # Attempt registration again, this time agreeing to the terms
        data['terms_of_service'] = True
        time_before_signup = now_without_microseconds()
        response = self.client.post(self.url, data)
        assert response.status_code == status.HTTP_302_FOUND
        # raise DoesNotExist if registration failed
        new_user = get_user_model().objects.get(username=username)

        # Check if the time of TOS agreement was stored properly
        accept_time_str = new_user.extra_details.private_data[
            'last_tos_accept_time'
        ]
        accept_time = dateutil.parser.isoparse(accept_time_str)
        assert time_before_signup <= accept_time <= now_without_microseconds()

    def _organization_field_skip_logic(self, form_type, **kwargs):
        """
        This function tests the skip logic of different types of forms based on
        the `form_type` argument
        """
        basic_data = {
            'username': 'foo',
            'email': 'double@foo.bar',
            'password1': 'tooxox',
            'password2': 'tooxox',
        }

        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {'name': 'organization_type', 'required': False},
                    {'name': 'organization', 'required': False},
                    {'name': 'organization_website', 'required': False},
                ]
            )
        ):
            form = form_type(basic_data, **kwargs.get('form_kwargs', {}))
            assert form.is_valid()

            data = basic_data.copy()
            data['organization_type'] = 'government'
            form = form_type(data, **kwargs.get('form_kwargs', {}))
            # No other organization fields should be required
            assert form.is_valid()

        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {'name': 'organization_type', 'required': True},
                    {'name': 'organization', 'required': False},
                    {'name': 'organization_website', 'required': False},
                ]
            )
        ):
            form = form_type(basic_data, **kwargs.get('form_kwargs', {}))
            # Should fail now that `organization_type` is required
            assert not form.is_valid()

            data = basic_data.copy()
            data['organization_type'] = 'government'
            form = form_type(data, **kwargs.get('form_kwargs', {}))
            # No other organization fields should be required
            assert form.is_valid()

        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {'name': 'organization_type', 'required': True},
                    {'name': 'organization', 'required': True},
                    {'name': 'organization_website', 'required': True},
                ]
            )
        ):
            form = form_type(basic_data, **kwargs.get('form_kwargs', {}))
            assert not form.is_valid()

            data = basic_data.copy()
            data['organization_type'] = 'government'
            data['organization'] = 'ministry of love'
            data['organization_website'] = 'https://minilove.test'
            form = form_type(data, **kwargs.get('form_kwargs', {}))
            assert form.is_valid()

            # Should fail since we have a required `organization_type`
            data = basic_data.copy()
            data['organization_type'] = 'government'
            data['organization'] = ''
            data['organization_website'] = ''
            form = form_type(data, **kwargs.get('form_kwargs', {}))
            assert not form.is_valid()

            data = basic_data.copy()
            data['organization_type'] = 'none'
            # The special string 'none' should cause the required-ness of other
            # organization fields to be ignored
            form = form_type(data, **kwargs.get('form_kwargs', {}))
            assert form.is_valid()

        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {'name': 'organization', 'required': True},
                    {'name': 'organization_website', 'required': True},
                ]
            )
        ):
            # Support excluding 'organization_type' from metadata fields
            form = form_type(basic_data, **kwargs.get('form_kwargs', {}))
            data = basic_data.copy()
            data['organization'] = 'ministry of love'
            data['organization_type'] = 'none'
            # If organization_type is not in the metadata, setting
            # organization_type to 'none' shouldn't bypass a required field
            assert not form.is_valid()
            data['organization_website'] = 'https://minilove.test'
            form = form_type(data, **kwargs.get('form_kwargs', {}))
            assert form.is_valid()

        with override_config(
            USER_METADATA_FIELDS=LazyJSONSerializable(
                [
                    {'name': 'organization_type', 'required': True},
                ]
            )
        ):
            # Support 'organization_type' by itself
            form = form_type(basic_data, **kwargs.get('form_kwargs', {}))
            data = basic_data.copy()
            assert not form.is_valid()
            data['organization_type'] = 'government'
            form = form_type(data, **kwargs.get('form_kwargs', {}))
            assert form.is_valid()
            data['organization_type'] = 'none'
            form = form_type(data, **kwargs.get('form_kwargs', {}))
            assert form.is_valid()

    def test_organization_field_skip_logic_signup_form(self):
        self._organization_field_skip_logic(SignupForm)

    def test_organization_field_skip_logic_sso_form(self):
        self._organization_field_skip_logic(
            SocialSignupForm, form_kwargs={'sociallogin': self.sociallogin}
        )
