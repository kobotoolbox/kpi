from django import forms
from django.utils.translation import ugettext_lazy as _
from registration import forms as registration_forms

class RegistrationForm(registration_forms.RegistrationForm):
    username = forms.RegexField(
        regex=r'^[a-z][a-z0-9_]+$',
        max_length=30,
        label=_("Username"),
        error_messages={'invalid': _(
            'A username may only contain lowercase letters, numbers, and '
            'underscores (_).'
        )}
    )
