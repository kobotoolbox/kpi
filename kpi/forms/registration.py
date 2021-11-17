# coding: utf-8
from django import forms
from django.contrib.auth.models import User
from django.utils.translation import ugettext_lazy as _
from registration import forms as registration_forms

from kobo.static_lists import SECTORS, COUNTRIES

USERNAME_REGEX = r'^[a-z][a-z0-9_]+$'
USERNAME_MAX_LENGTH = 30
USERNAME_INVALID_MESSAGE = _(
    'Usernames must be between 2 and 30 characters in length, '
    'and may only consist of lowercase letters, numbers, '
    'and underscores, where the first character must be a letter.'
)


class RegistrationForm(registration_forms.RegistrationForm):
    username = forms.RegexField(
        regex=USERNAME_REGEX,
        max_length=USERNAME_MAX_LENGTH,
        label=_("Username"),
        error_messages={'invalid': USERNAME_INVALID_MESSAGE}
    )
    name = forms.CharField(
        label=_('Name'),
        required=False,
    )
    organization = forms.CharField(
        label=_('Organization name'),
        required=False,
    )
    gender = forms.ChoiceField(
        label=_('Gender'),
        required=False,
        widget=forms.RadioSelect,
        choices=(
                 ('male', _('Male')),
                 ('female', _('Female')),
                 ('other', _('Other')),
                )
    )
    sector = forms.ChoiceField(
        label=_('Sector'),
        required=False,
        choices=(('', ''),
            ) + SECTORS,
    )
    country = forms.ChoiceField(
        label=_('Country'),
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
