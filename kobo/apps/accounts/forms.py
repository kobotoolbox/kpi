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

from .models import SocialAppManagedDomain
from .signup_fields import validate_email_domain


class LoginForm(BaseLoginForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['login'].widget.attrs['placeholder'] = ''
        self.fields['password'].widget.attrs['placeholder'] = ''
        self.label_suffix = ''


class KoboSignupMixin:
    """
    Validation shared by the HTML and SSO signup forms

    The fields live in `signup_fields.SignupExtraFieldsForm` so the headless API
    gets them too. Only behaviour that must override allauth's stays here, since
    that requires sitting above allauth's classes in the MRO.
    """

    def clean(self):
        """
        Override parent form to pass extra user's attributes to validation.
        """
        # Skips every allauth `clean()` below this mixin. `SignupForm.clean()`
        # already redoes allauth's password checks, and running both would show
        # each error twice
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
        # Remove upstream placeholders (see `SignupForm.__init__`)
        for field_name in ['username', 'email']:
            if field_name in self.fields:
                self.fields[field_name].widget.attrs['placeholder'] = ''

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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Presentation only. Kept here, not in `SignupExtraFieldsForm`, because
        # that class runs before allauth adds the password fields

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
