import constance
from allauth.account import app_settings
from allauth.account.adapter import get_adapter
from allauth.account.forms import LoginForm as BaseLoginForm
from allauth.account.forms import ResetPasswordForm as BaseResetPasswordForm
from allauth.account.forms import SignupForm as BaseSignupForm
from allauth.account.forms import UserTokenForm as BaseUserTokenForm
from allauth.account.utils import (
    get_user_model,
    user_email,
    user_username,
)
from allauth.socialaccount.forms import SignupForm as BaseSocialSignupForm
from django import forms
from django.utils.translation import gettext_lazy as t

from kobo.apps.accounts.utils import get_normalized_domain, user_is_managed_by_sso
from kobo.static_lists import COUNTRIES, USER_METADATA_DEFAULT_LABELS

from .models import SocialAppManagedDomain
from .signup_fields import apply_user_metadata_config, validate_email_domain


class LoginForm(BaseLoginForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['login'].widget.attrs['placeholder'] = ''
        self.fields['password'].widget.attrs['placeholder'] = ''
        self.label_suffix = ''


class KoboSignupMixin(forms.Form):
    """
    The profile metadata collected by the HTML and SSO signup pages

    These fields are deliberately absent from the headless API: the SPA collects
    them after login via `PATCH /me/` instead, which is the only route an SSO
    user can take anyway. Signup fields the API does need live in
    `signup_fields.SignupExtraFieldsForm`.
    """

    # NOTE: Fields that are not part of django's contrib.auth.User model
    #       are saved to ExtraUserDetail, via django-allauth internals
    # SEE:
    #     - AccountAdapter (save_user) in kobo/apps/accounts/adapter.py
    #     - https://docs.allauth.org/en/latest/account/advanced.html#creating-and-populating-user-instances    # noqa
    name = forms.CharField(
        label=USER_METADATA_DEFAULT_LABELS['name'],
        required=False,
    )
    organization = forms.CharField(
        label=USER_METADATA_DEFAULT_LABELS['organization'],
        required=False,
    )
    organization_website = forms.CharField(
        label=USER_METADATA_DEFAULT_LABELS['organization_website'],
        required=False,
        widget=forms.URLInput,
    )
    organization_website.widget.attrs['pattern'] = (
        # Use r'' so we can copy-paste the literal without escaping backslashes
        r'\s*(https?:\/\/)?([^\s.:\/]+\.)+([^\s.:\/]){2,}(:\d{1,5})?(\/.*)?\s*'
    )
    organization_website.widget.attrs['title'] = t('Please enter a valid URL')

    organization_type = forms.ChoiceField(
        label=USER_METADATA_DEFAULT_LABELS['organization_type'],
        required=False,
        choices=(
            ('', ''),
            ('non-profit', t('Non-profit organization')),
            ('government', t('Government institution')),
            ('educational', t('Educational organization')),
            ('commercial', t('A commercial/for-profit company')),
            ('none', t('I am not associated with any organization')),
        ),
    )
    gender = forms.ChoiceField(
        label=USER_METADATA_DEFAULT_LABELS['gender'],
        required=False,
        widget=forms.RadioSelect,
        choices=(
            ('male', t('Male')),
            ('female', t('Female')),
            ('other', t('Other')),
        ),
    )
    sector = forms.ChoiceField(
        label=USER_METADATA_DEFAULT_LABELS['sector'],
        required=False,
        # Don't set choices here; set them in the constructor so that changes
        # made in the Django admin interface do not require a server restart
    )
    country = forms.ChoiceField(
        label=USER_METADATA_DEFAULT_LABELS['country'],
        required=False,
        choices=(('', ''),) + COUNTRIES,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.label_suffix = ''

        # Intentional t() call on dynamic string because the default choices
        # are translated (see static_lists.py)
        # Strip "\r" for legacy data created prior to django-constance 2.7.
        self.fields['sector'].choices = (('', ''),) + tuple(
            (s.strip('\r'), t(s.strip('\r')))
            for s in constance.config.SECTOR_CHOICES.split('\n')
        )

        apply_user_metadata_config(
            self,
            [
                'name',
                'organization',
                'organization_type',
                'organization_website',
                'gender',
                'sector',
                'country',
            ],
        )

        # Remove upstream placeholders
        for field_name in ['username', 'email', 'password1', 'password2']:
            if field_name in self.fields:
                self.fields[field_name].widget.attrs['placeholder'] = ''
        if 'password1' in self.fields:
            # Remove `help_text` on purpose since some guidance is provided by
            # Constance setting. Moreover it is redundant with error messages.
            self.fields['password1'].help_text = ''
        if 'password2' in self.fields:
            self.fields['password2'].label = t('Password confirmation')
        if 'email' in self.fields:
            self.fields['email'].widget.attrs['placeholder'] = t(
                'name@organization.org'
            )

    def validate_conditionally_required_organization_fields(self):
        """
        Part of 'skip logic' for organization fields. Add 'Field is required'
        errors for organization and organization_website, since we un-required
        them in case 'organization_type' is 'none'.
        """
        if 'organization_type' not in self.fields:
            return

        for field_name in ['organization', 'organization_website']:
            if (
                field_name in self.fields
                and self.fields[field_name].widget.attrs.get('data-required')
                and self.cleaned_data.get('organization_type') != 'none'
            ):
                if not self.cleaned_data.get(field_name):
                    self.add_error(field_name, t('This field is required.'))

    def clean(self):
        """
        Override parent form to pass extra user's attributes to validation.
        """
        # Skips every allauth `clean()` below this mixin. `SignupForm.clean()`
        # already redoes allauth's password checks, and running both would show
        # each error twice. It also skips `SignupExtraFieldsForm.clean()`, whose
        # checks only apply to the API.
        super(forms.Form, self).clean()

        self.validate_conditionally_required_organization_fields()

        return self.cleaned_data

    def clean_email(self, allow_managed_domains=False):
        return validate_email_domain(
            self.cleaned_data['email'],
            allow_managed_domains=allow_managed_domains,
        )


class SocialSignupForm(KoboSignupMixin, BaseSocialSignupForm):
    field_order = [
        'username',
        'email',
        'name',
        'country',
        'sector',
        'organization_type',
        'organization',
        'organization_website',
        'gender',
        'newsletter_subscription',
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['email'].widget.attrs['readonly'] = True
        self.label_suffix = ''

    def clean_email(self):
        # do not allow any other email besides the one retrieved from the SSO server
        email = super().clean_email(allow_managed_domains=True)
        if email != self.initial['email']:
            raise forms.ValidationError(t('Email must match SSO server email'))
        return email


class SignupForm(KoboSignupMixin, BaseSignupForm):
    field_order = [
        'name',
        'username',
        'email',
        'country',
        'sector',
        'organization_type',
        'organization',
        'organization_website',
        'gender',
        'newsletter_subscription',
    ]

    def clean(self):
        """
        Override parent form to pass extra user's attributes to validation.
        """
        super(SignupForm, self).clean()

        User = get_user_model()  # noqa

        dummy_user = User()
        # Using `dummy_user`, a temporary User object, to assign attributes that are
        # validated during the password similarity check.
        user_username(dummy_user, self.cleaned_data.get('username'))
        user_email(dummy_user, self.cleaned_data.get('email'))
        setattr(
            dummy_user,
            'organization_name',
            self.cleaned_data.get('organization', ''),
        )
        setattr(dummy_user, 'full_name', self.cleaned_data.get('name', ''))

        password = self.cleaned_data.get('password1')
        if password:
            try:
                get_adapter().clean_password(password, user=dummy_user)
            except forms.ValidationError as e:
                self.add_error('password1', e)

        if (
            app_settings.SIGNUP_PASSWORD_ENTER_TWICE
            and 'password1' in self.cleaned_data
            and 'password2' in self.cleaned_data
        ):
            if self.cleaned_data['password1'] != self.cleaned_data['password2']:
                self.add_error(
                    'password2',
                    t('You must type the same password each time.'),
                )

        return self.cleaned_data


class ResetPasswordForm(BaseResetPasswordForm):
    def clean_email(self):
        # super().clean_email should set self.users to the list of users with this email
        cleaned = super().clean_email()
        domain = get_normalized_domain(cleaned)
        if SocialAppManagedDomain.is_managed(domain):
            if getattr(self, 'users', None):
                # filtering self.users will ensure we do not send password-reset links
                # to sso-managed users
                self.users = [
                    user for user in self.users if not user_is_managed_by_sso(user)
                ]

                # if the only user was an sso-managed user, raise an error
                if self.users == []:
                    raise forms.ValidationError(
                        t('Cannot set password for SSO-managed accounts')
                    )
        return cleaned


class UserTokenForm(BaseUserTokenForm):
    def clean(self):
        cleaned = super().clean()
        user = self.reset_user
        if user:
            if user_is_managed_by_sso(user):
                raise forms.ValidationError(
                    t('Cannot set password for SSO-managed accounts')
                )
        return cleaned
