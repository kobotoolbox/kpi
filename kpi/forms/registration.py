# coding: utf-8
import json

import constance
from django import forms
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as t
from registration import forms as registration_forms

from kobo.static_lists import COUNTRIES

USERNAME_REGEX = r'^[a-z][a-z0-9_]+$'
USERNAME_MAX_LENGTH = 30
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

class RegistrationForm(registration_forms.RegistrationForm):
    username = forms.RegexField(
        regex=USERNAME_REGEX,
        max_length=USERNAME_MAX_LENGTH,
        label=t("Username"),
        error_messages={'invalid': USERNAME_INVALID_MESSAGE}
    )
    name = forms.CharField(
        label=t('Name'),
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
                )
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

    class Meta:
        model = User
        fields = [
            'name',
            'organization',
            'username',
            'email',
            'sector',
            'country',
            'gender',
            # The 'password' field appears without adding it here; adding it
            # anyway results in a duplicate
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Intentional t() call on dynamic string because the default choices
        # are translated (see static_lists.py)
        self.fields['sector'].choices = (('', ''),) + tuple(
            (s, t(s)) for s in constance.config.SECTOR_CHOICES.split('\r\n')
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
