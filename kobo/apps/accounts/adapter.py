from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.forms import SignupForm
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


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return config.REGISTRATION_OPEN

    def login(self, request, user):
        # Override django-allauth login method to use specified authentication backend
        user.backend = settings.AUTHENTICATION_BACKENDS[0]
        super().login(request, user)

    def save_user(self, request, user, form, commit=True):
        # Compare allauth SignupForm with our custom field
        standard_fields = set(SignupForm().fields.keys())
        extra_fields = set(form.fields.keys()).difference(standard_fields)
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
