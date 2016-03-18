from django import forms
from django.conf import settings
from django.contrib.auth.models import User
from django.utils.translation import ugettext_lazy as _
from registration import forms as registration_forms

USERNAME_REGEX = r'^[a-z][a-z0-9_]+$'
USERNAME_MAX_LENGTH = 30
USERNAME_INVALID_MESSAGE = _(
    'A username may only contain lowercase letters, numbers, and '
    'underscores (_).'
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
    sector = forms.ChoiceField(
        label=_('Sector'),
        required=False,
    )
    country = forms.ChoiceField(
        label=_('Country'),
        required=False,
    )
    default_language = forms.ChoiceField(
        label=_('Default language'),
        choices=settings.LANGUAGES,
        # TODO: Read the preferred language from the request?
        initial='en',
    )

    class Meta:
        model = User
        fields = [
            'name',
            'username',
            'organization',
            'email',
            'sector',
            'country',
            'default_language',
            # The 'password' field appears without adding it here; adding it
            # anyway results in a duplicate
        ]
