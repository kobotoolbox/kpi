# coding: utf-8
from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.contrib.auth.forms import PasswordResetForm as PRF
from django.utils.translation import ugettext_lazy as _
from registration import forms as registration_forms
from kobo.static_lists import SECTORS, COUNTRIES

UserModel = get_user_model()

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

class PasswordResetFormWithUsername(PRF):
    username = forms.CharField(
        label=_("Username"),
        max_length=254,
        required=False,
    )

    def get_users(self, email):
        username = self.cleaned_data['username']
        active_users = UserModel._default_manager.filter(**{
            '%s__iexact' % UserModel.get_email_field_name(): email,
            'is_active': True,
        })
        print('--------')
        print(active_users)
        print('--------')
        print(username)
        print('--------')
        if(username == ""):
            return(u for u in active_users if u.has_usable_password())
        else:
            return (u for u in active_users if u.username == username)
