import json

import pytest
from constance.test import override_config
from django.test import TestCase, override_settings
from django.utils import translation
from model_bakery import baker
from pyquery import PyQuery

from kobo.apps.accounts.forms import SocialSignupForm


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

    @override_config(USER_METADATA_FIELDS='{}')
    def test_only_configurable_fields_can_be_removed(self):
        form = SocialSignupForm(sociallogin=self.sociallogin)
        assert 'username' in form.fields
        assert 'email' in form.fields

    @override_config(
        USER_METADATA_FIELDS=json.dumps(
            [{'name': 'full_name', 'required': True}]
        )
    )
    def test_field_without_custom_label_can_be_required(self):
        form = SocialSignupForm(sociallogin=self.sociallogin)
        assert form.fields['full_name'].required
        assert form.fields['full_name'].label == 'Full name'

    @override_config(
        USER_METADATA_FIELDS=json.dumps(
            [
                {
                    'name': 'full_name',
                    'required': True,
                    'label': {'default': 'Secret Agent ID'},
                }
            ]
        )
    )
    def test_field_with_only_default_custom_label(self):
        form = SocialSignupForm(sociallogin=self.sociallogin)
        assert form.fields['full_name'].required
        assert form.fields['full_name'].label == 'Secret Agent ID'

    @override_config(
        USER_METADATA_FIELDS=json.dumps(
            [
                {
                    'name': 'full_name',
                    'required': True,
                    'label': {
                        'default': 'Secret Agent ID',
                        'es': 'ID de agente secreto',
                    },
                }
            ]
        )
    )
    def test_field_with_specific_and_default_custom_labels(self):
        with translation.override('es'):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert form.fields['full_name'].required
            assert form.fields['full_name'].label == 'ID de agente secreto'
        with translation.override('en'):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert form.fields['full_name'].required
            assert form.fields['full_name'].label == 'Secret Agent ID'

    @override_config(
        USER_METADATA_FIELDS=json.dumps(
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
    )
    def test_field_with_custom_label_without_default(self):
        with translation.override('fr'):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert form.fields['organization'].required
            assert form.fields['organization'].label == 'Organisation secrète'


    @override_config(
        USER_METADATA_FIELDS=json.dumps(
            [
                {
                    'name': 'organization',
                    'required': False,
                },
            ]
        )
    )
    def test_field_without_custom_label_can_be_optional(self):
        form = SocialSignupForm(sociallogin=self.sociallogin)
        assert not form.fields['organization'].required    

    @override_config(
        USER_METADATA_FIELDS=json.dumps(
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
    )
    def test_field_with_custom_label_without_default_can_be_optional(self):
        form = SocialSignupForm(sociallogin=self.sociallogin)
        assert not form.fields['organization'].required
        assert form.fields['organization'].label == 'Organization'
        with translation.override('fr'):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert form.fields['organization'].required == False 
            assert form.fields['organization'].label == 'Organisation'
        with translation.override('es'):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert form.fields['organization'].required == False
            assert form.fields['organization'].label == 'Organización'

    @override_config(
        USER_METADATA_FIELDS=json.dumps(
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
    )
    def test_not_supported_translation(self):
        with translation.override('es'):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert form.fields['organization'].required == False 
            assert form.fields['organization'].label == 'Organization'
        with translation.override('ar'):
            form = SocialSignupForm(sociallogin=self.sociallogin)
            assert form.fields['organization'].required == False
            assert form.fields['organization'].label == 'Organization'
