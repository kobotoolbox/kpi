from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import requests
from allauth.account import app_settings as allauth_account_settings
from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.internal.flows.login import (
    AUTHENTICATION_METHODS_SESSION_KEY,
)
from allauth.account.models import EmailAddress
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.core.internal.httpkit import is_headless_request
from allauth.socialaccount.adapter import (
    DefaultSocialAccountAdapter,
    get_adapter as get_socialaccount_adapter,
)
from allauth.socialaccount.helpers import render_authentication_error
from allauth.socialaccount.models import SocialAccount, SocialApp
from allauth.socialaccount.providers.base.constants import AuthProcess
from constance import config
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import MultipleObjectsReturned
from django.db import transaction
from django.shortcuts import resolve_url
from django.utils import timezone
from django.utils.translation import gettext_lazy as t

from kpi.utils.log import logging

from .models import SocialAppCustomData, SocialAppManagedDomain
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

    def should_send_confirmation_mail(self, request, email_address, signup):
        """
        Don't resend a confirmation link when an unverified user logs in through
        the headless API

        allauth consults this only on its implicit send: a login, or a signup,
        with an unverified address. The SPA asks for another link explicitly
        through `/api/v2/email-confirmations/` instead. Signup still sends the
        first activation email, and the templated pages keep the old behaviour
        until they are retired.
        """
        if is_headless_request(request) and not signup:
            return False
        return super().should_send_confirmation_mail(request, email_address, signup)

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

    def get_logout_redirect_url(self, request):
        default_url = super().get_logout_redirect_url(request)
        if (
            not request
            or not getattr(request, 'user', None)
            or not request.user.is_authenticated
        ):
            return default_url

        try:
            active_provider = None
            active_uid = None

            if hasattr(request, 'session'):
                active_provider = request.session.get('socialaccount_provider')
                active_uid = request.session.get('socialaccount_uid')
                if not active_provider:
                    auth_methods = request.session.get(
                        AUTHENTICATION_METHODS_SESSION_KEY, []
                    )
                    if auth_methods:
                        latest_auth = auth_methods[-1]
                        if latest_auth.get('method') == 'socialaccount':
                            active_provider = latest_auth.get('provider')
                            active_uid = latest_auth.get('uid')
                        else:
                            # User authenticated via password or non-social method;
                            # do not trigger RP-initiated logout.
                            return default_url

            if active_provider:
                accounts = SocialAccount.objects.filter(
                    user=request.user, provider=active_provider
                )
                if active_uid:
                    accounts = accounts.filter(uid=active_uid)
                if accounts.count() != 1:
                    return default_url
                social_account = accounts.first()
            else:
                # When session has no provider metadata (e.g. legacy sessions or
                # direct calls), resolve only if the user has exactly one linked
                # social account. Multiple accounts without session context are
                # ambiguous and unresolvable.
                accounts = SocialAccount.objects.filter(user=request.user)
                if accounts.count() != 1:
                    return default_url
                social_account = accounts.first()
                active_provider = social_account.provider

            try:
                social_app = get_socialaccount_adapter().get_app(
                    request, active_provider
                )
            except SocialApp.DoesNotExist:
                return default_url
            except MultipleObjectsReturned:
                logging.error(
                    'Multiple social applications match provider "%s"', active_provider
                )
                return default_url

            custom_data = getattr(social_app, 'custom_data', None)
            if (
                not custom_data
                or custom_data.logout_behavior
                != SocialAppCustomData.LogoutBehavior.RP_INITIATED
            ):
                return default_url

            end_session_endpoint = (
                custom_data.end_session_endpoint
                or (
                    social_app.settings
                    and social_app.settings.get('end_session_endpoint')
                )
                or self._discover_end_session_endpoint(social_app, social_account)
            )
            if not end_session_endpoint:
                return default_url

            parsed = urlparse(end_session_endpoint)
            query_params = dict(parse_qsl(parsed.query))

            id_token = (
                social_account.extra_data.get('id_token')
                if isinstance(social_account.extra_data, dict)
                else None
            ) or (hasattr(request, 'session') and request.session.get('oidc_id_token'))
            if id_token:
                query_params['id_token_hint'] = id_token

            post_logout_redirect_uri = (
                custom_data.post_logout_redirect_uri
                or (
                    social_app.settings
                    and social_app.settings.get('post_logout_redirect_uri')
                )
                or request.build_absolute_uri(resolve_url(settings.LOGIN_URL or '/'))
            )
            if post_logout_redirect_uri:
                query_params['post_logout_redirect_uri'] = post_logout_redirect_uri

            if social_app.client_id:
                query_params['client_id'] = social_app.client_id

            return urlunparse(parsed._replace(query=urlencode(query_params)))
        except Exception:
            return default_url

    def _discover_end_session_endpoint(self, social_app, social_account):
        try:
            provider = social_account.get_provider()
            if hasattr(provider, 'server_metadata') and isinstance(
                provider.server_metadata, dict
            ):
                endpoint = provider.server_metadata.get('end_session_endpoint')
                if endpoint:
                    return endpoint
        except Exception:
            pass

        server_url = (social_app.settings or {}).get('server_url')
        if not server_url:
            return None

        cache_key = f'oidc_end_session_{social_app.pk}_{server_url}'
        cached = cache.get(cache_key)
        if cached is not None:
            return cached or None

        well_known_url = server_url.rstrip('/')
        if not well_known_url.endswith('/.well-known/openid-configuration'):
            well_known_url += '/.well-known/openid-configuration'

        try:
            resp = requests.get(well_known_url, timeout=5)
            if resp.status_code == 200:
                endpoint = resp.json().get('end_session_endpoint')
                cache.set(cache_key, endpoint or '', timeout=3600)
                return endpoint
        except Exception:
            pass

        cache.set(cache_key, '', timeout=300)
        return None


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
        # Stash login metadata and id_token in session for deterministic logout handling
        account = getattr(sociallogin, 'account', None)
        extra_data = getattr(account, 'extra_data', None)
        id_token = extra_data.get('id_token') if isinstance(extra_data, dict) else None
        if hasattr(request, 'session'):
            if id_token:
                request.session['oidc_id_token'] = id_token
            if account:
                request.session['socialaccount_provider'] = account.provider
                request.session['socialaccount_uid'] = account.uid

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
