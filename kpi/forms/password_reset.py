# coding: utf-8
from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import PasswordResetForm as PRF
from django.utils.translation import ugettext_lazy as _

UserModel = get_user_model()


class PasswordResetFormWithUsername(PRF):
    username = forms.CharField(
        label=_('Username'),
        max_length=254,
        required=False,
    )

    def get_users(self, email):
        username = self.cleaned_data['username']
        active_users = UserModel._default_manager.filter(
            **{
                f'{UserModel.get_email_field_name()}__iexact': email,
                'is_active': True,
            }
        )

        if username == '':
            return (u for u in active_users if u.has_usable_password())
        else:
            return (u for u in active_users if u.username == username)
