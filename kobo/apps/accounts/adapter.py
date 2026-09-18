from allauth.account import app_settings as allauth_account_settings
from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.models import EmailAddress
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.helpers import render_authentication_error
from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.providers.base.constants import AuthProcess
from constance import config
from django.conf import settings
from django.db import transaction
from django.shortcuts import resolve_url
from django.utils import timezone
from django.utils.translation import gettext_lazy as t

from .models import SocialAppManagedDomain
from .signup_fields import SIGNUP_EXTRA_FIELD_NAMES


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return config.REGISTRATION_OPEN

    def login(self, request, user):
        # Override django-allauth login method to use specified authentication backend
        user.backend = settings.AUTHENTICATION_BACKENDS[0]
        super().login(request, user)

    def save_user(self, request, user, form, commit=True):
        # Which extra fields a form carries depends on the flow: the API form has
        # only newsletter/ToS, the HTML and SSO ones add profile metadata, and
        # `USER_METADATA_FIELDS` may drop some per server. So take the full list
        # and keep whatever was actually submitted
        extra_fields = [
            field_name
            for field_name in SIGNUP_EXTRA_FIELD_NAMES
            if field_name in form.cleaned_data
        ]
        with transaction.atomic():
            user = super().save_user(request, user, form, commit)
            extra_data = {k: form.cleaned_data[k] for k in extra_fields}

            # If the form contains a Terms of Service checkbox (checked)
            if extra_data.pop('terms_of_service', None):
                # We 'pop' because we don't want to save 'terms_of_service':true
                # in extra_details.data. Instead, save a now() date string as
                # the last ToS acceptance time in private_data.
                # See also: TOSView.post() in apps/accounts/tos.py, which
                # lets the frontend accept ToS on behalf of existing users.
                user.extra_details.private_data['last_tos_accept_time'] = (
                    timezone.now().strftime('%Y-%m-%dT%H:%M:%SZ')
                )

            user.extra_details.data.update(extra_data)
            if commit:
                user.extra_details.save()
        return user

    def set_password(self, user, password):
        with transaction.atomic():
            user.extra_details.password_date_changed = timezone.now()
            user.extra_details.validated_password = True
            user.extra_details.save(
                update_fields=['password_date_changed', 'validated_password']
            )
            user.set_password(password)
            user.save()

    def send_confirmation_mail(self, request, emailconfirmation, signup):
        """
        Send one of three confirmation emails, rather than allauth's two

        allauth picks between "activate your account" and "verify your address"
        with the `signup` flag alone, which leaves a resent activation link
        arriving as an address verification. Splitting them needs a third
        template and a rule to reach it; see `get_confirmation_email_template()`.

        Overriding means rebuilding the context allauth would have built, since
        its own version hardcodes the template prefix.
        """
        address = emailconfirmation.email_address
        ctx = {'user': address.user}
        if allauth_account_settings.EMAIL_VERIFICATION_BY_CODE_ENABLED:
            ctx['code'] = emailconfirmation.key
        else:
            ctx['key'] = emailconfirmation.key
            ctx['activate_url'] = self.get_email_confirmation_url(
                request, emailconfirmation
            )

        template = self.get_confirmation_email_template(address, signup)
        self.send_mail(template, address.email, ctx)

    def get_confirmation_email_template(self, address, signup):
        """
        Which of the three confirmation emails this send is

        Decided by what the account looks like rather than by which endpoint
        asked: an account with nothing verified yet is being activated, one that
        already has a verified address is changing it. The resend endpoint
        (`/api/v2/email-confirmations/`) serves both kinds of user, so the
        trigger cannot tell them apart on its own.
        """
        prefix = 'account/email/email_confirmation'
        if signup:
            return f'{prefix}_signup'

        has_verified_address = EmailAddress.objects.filter(
            user_id=address.user_id, verified=True
        ).exists()
        return prefix if has_verified_address else f'{prefix}_resend'

    def get_email_confirmation_url(self, request, emailconfirmation):
        url = super().get_email_confirmation_url(request, emailconfirmation)
        next = request.POST.get('next')
        if next is not None:
            return f'{url}?next={next}'
        return url


class SocialAccountAdapter(DefaultSocialAccountAdapter):

    def is_open_for_signup(self, request, sociallogin):
        email = sociallogin.user.email
        domain = email.split('@')[1].lower()
        app = getattr(sociallogin.provider, 'app', None)
        if app is None:
            managed_domain = False
        else:
            managed_domain = SocialAppManagedDomain.objects.filter(
                social_app__social_app=app,
                social_app__managed=True,
                domain__iexact=domain,
            ).exists()
        return config.REGISTRATION_OPEN or managed_domain

    def pre_social_login(self, request, sociallogin):
        """Allow only one linked SSO account per user."""
        # Only the connect flow links a new provider; login/signup are exempt.
        if sociallogin.state.get('process') != AuthProcess.CONNECT:
            return

        user = request.user
        if not user.is_authenticated:
            return

        incoming = sociallogin.account
        # Block only if a *different* account is already linked; reconnecting
        # the same one is fine.
        blocking_accounts = SocialAccount.objects.filter(user=user).exclude(
            provider=incoming.provider, uid=incoming.uid
        )
        if not blocking_accounts.exists():
            return

        # Reuse allauth's own error-rendering helper instead of a bespoke
        # response. Passing `state` through makes this forward-compatible:
        # once headless mode is enabled it'll redirect SPA callers with
        # `?error=...` instead of rendering HTML, with no change needed here
        raise ImmediateHttpResponse(
            render_authentication_error(
                request,
                incoming.provider,
                error='multiple_sso_not_allowed',
                extra_context={
                    'state': sociallogin.state,
                    'error_title': t('SSO account already linked'),
                    'error_message': t(
                        'You can only link one SSO account at a time. '
                        'Disconnect your existing SSO account before linking '
                        'a new one.'
                    ),
                    # Already validated against ALLOWED_HOSTS by allauth when
                    # it stashed the `next` parameter into the session state
                    'back_url': sociallogin.get_redirect_url(request)
                    or resolve_url(settings.LOGIN_REDIRECT_URL),
                },
            )
        )
