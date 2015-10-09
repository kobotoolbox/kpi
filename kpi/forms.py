from allauth.account.adapter import DefaultAccountAdapter
from django.utils.translation import ugettext_lazy as _
from django import forms
import re

class UsernameValidationAdapter(DefaultAccountAdapter):
    def clean_username(self, username):
        # Why don't they use RegexField?
        USERNAME_REGEX = re.compile(r'^[a-z][a-z0-9_]+$')
        if not USERNAME_REGEX.match(username):                                  
            raise forms.ValidationError(_(
                'A username may only contain lowercase letters, numbers, and '
                'underscores (_).'
            ))
        return super(UsernameValidationAdapter, self).clean_username(username)
