import json

import constance
from allauth.account.forms import LoginForm as BaseLoginForm
from allauth.account.forms import SignupForm as BaseSignupForm
from allauth.socialaccount.forms import SignupForm as BaseSocialSignupForm
from django import forms
from django.utils.translation import gettext_lazy as t

from kobo.static_lists import COUNTRIES


USERNAME_INVALID_MESSAGE = t(
    'Usernames must be between 2 and 30 characters in length, '
    'and may only consist of lowercase letters, numbers, '
    'and underscores, where the first character must be a letter.'
)
# Only these fields can be controlled by constance.config.USER_METADATA_FIELDS
CONFIGURABLE_METADATA_FIELDS = (
    'organization',
    'gender',
    'sector',
    'country',
)


class LoginForm(BaseLoginForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["login"].widget.attrs["placeholder"] = ""
        self.fields["password"].widget.attrs["placeholder"] = ""
        self.label_suffix = ""


class KoboSignupMixin(forms.Form):
    name = forms.CharField(
        label=t('Full name'),
        required=False,
    )
    organization = forms.CharField(
        label=t('Organization name'),
        required=False,
    )
    gender = forms.ChoiceField(
        label=t('Gender'),
        required=False,
        widget=forms.RadioSelect,
        choices=(
            ('male', t('Male')),
            ('female', t('Female')),
            ('other', t('Other')),
        ),
    )
    sector = forms.ChoiceField(
        label=t('Sector'),
        required=False,
        # Don't set choices here; set them in the constructor so that changes
        # made in the Django admin interface do not require a server restart
    )
    country = forms.ChoiceField(
        label=t('Country'),
        required=False,
        choices=(('', ''),) + COUNTRIES,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remove upstream placeholders
        for field_name in ['username', 'email', 'password1', 'password2']:
            if field_name in self.fields:
                self.fields[field_name].widget.attrs['placeholder'] = ''
        if 'password2' in self.fields:
            self.fields['password2'].label = t('Password confirmation')

        # Intentional t() call on dynamic string because the default choices
        # are translated (see static_lists.py)
        # Strip "\r" for legacy data created prior to django-constance 2.7.
        self.fields['sector'].choices = (('', ''),) + tuple(
            (s.strip('\r'), t(s.strip('\r')))
            for s in constance.config.SECTOR_CHOICES.split('\n')
        )

        # It's easier to _remove_ unwanted fields here in the constructor
        # than to add a new fields *shrug*
        desired_metadata_fields = json.loads(
            constance.config.USER_METADATA_FIELDS
        )
        desired_metadata_fields = {
            field['name']: field for field in desired_metadata_fields
        }
        for field_name in list(self.fields.keys()):
            if field_name not in CONFIGURABLE_METADATA_FIELDS:
                continue
            if field_name not in desired_metadata_fields:
                self.fields.pop(field_name)
                continue
            else:
                self.fields[field_name].required = desired_metadata_fields[
                    field_name
                ].get('required', False)

    def clean_email(self):
        email = self.cleaned_data['email']
        domain = email.split('@')[1].lower()
        allowed_domains = (
            constance.config.REGISTRATION_ALLOWED_EMAIL_DOMAINS.strip()
        )
        allowed_domain_list = [
            domain.lower() for domain in allowed_domains.split('\n')
        ]
        # An empty domain list means all domains are allowed
        if domain in allowed_domain_list or not allowed_domains:
            return email
        else:
            raise forms.ValidationError(
                constance.config.REGISTRATION_DOMAIN_NOT_ALLOWED_ERROR_MESSAGE
            )


class SocialSignupForm(KoboSignupMixin, BaseSocialSignupForm):
    field_order = [
        'username',
        'email',
        'name',
        'gender',
        'sector',
        'country',
        'organization',
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['email'].widget.attrs['readonly'] = True
        self.label_suffix = ""


class SignupForm(KoboSignupMixin, BaseSignupForm):
    field_order = [
        'name',
        'organization',
        'username',
        'email',
        'sector',
        'country',
    ]
