import dataclasses
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import requests
from allauth.account import app_settings as allauth_account_settings
from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.internal.flows.login import AUTHENTICATION_METHODS_SESSION_KEY
from allauth.account.models import EmailAddress
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.core.internal.httpkit import is_headless_request
from allauth.headless.adapter import DefaultHeadlessAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.adapter import get_adapter as get_socialaccount_adapter
from allauth.socialaccount.helpers import render_authentication_error
from allauth.socialaccount.models import SocialAccount, SocialApp
from allauth.socialaccount.providers.base.constants import AuthProcess
from constance import config
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import MultipleObjectsReturned
from django.db import transaction
from django.http import HttpResponseRedirect
from django.shortcuts import resolve_url
from django.utils import timezone
from django.utils.translation import gettext_lazy as t

from kobo.apps.kobo_scim.models import IdentityProvider
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
        ctx = {
            'user': address.user,
            'expire_hours': self.get_confirmation_expire_hours(),
        }
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

    def get_confirmation_expire_hours(self):
        """In hours, so the default 1 day reads "24 hours" as designed"""
        return allauth_account_settings.EMAIL_CONFIRMATION_EXPIRE_DAYS * 24

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

        social_account = self._resolve_active_social_account(request)
        if not social_account:
            return default_url
        return self._get_rp_initiated_logout_url(request, social_account) or default_url

    def _resolve_active_social_account(self, request):
        """
        Identify the SocialAccount associated with the user's active session.
        Returns None if authenticated via a non-social method (e.g. password)
        or if the active account cannot be uniquely resolved.
        """
        if not hasattr(request, 'session'):
            return None

        auth_methods = request.session.get(AUTHENTICATION_METHODS_SESSION_KEY, [])
        login_records = [
            record for record in auth_methods if not record.get('reauthenticated')
        ]
        if login_records:
            social_record = next(
                (
                    record
                    for record in login_records
                    if record.get('method') == 'socialaccount'
                ),
                None,
            )
            if not social_record:
                # Session started via password or other non-social method;
                # do not trigger RP-initiated logout.
                return None

            active_provider = social_record.get('provider') or request.session.get(
                'socialaccount_provider'
            )
            active_uid = social_record.get('uid') or request.session.get(
                'socialaccount_uid'
            )
        else:
            active_provider = request.session.get('socialaccount_provider')
            active_uid = request.session.get('socialaccount_uid')

        if active_provider:
            accounts = SocialAccount.objects.filter(
                user=request.user, provider=active_provider
            )
            if active_uid:
                accounts = accounts.filter(uid=active_uid)
            if accounts.count() != 1:
                return None
            return accounts.first()

        # When session has no provider metadata (e.g. legacy sessions or
        # direct calls), resolve only if the user has exactly one linked
        # social account. Multiple accounts without session context are
        # ambiguous and unresolvable.
        accounts = SocialAccount.objects.filter(user=request.user)
        if accounts.count() != 1:
            return None
        return accounts.first()

    def _get_rp_initiated_logout_url(self, request, social_account):
        """
        Build the RP-initiated logout redirect URL for a given SocialAccount,
        or None if RP logout is not configured or cannot be resolved.
        """
        try:
            social_app = get_socialaccount_adapter().get_app(
                request, social_account.provider
            )
        except SocialApp.DoesNotExist:
            return None
        except MultipleObjectsReturned:
            logging.error(
                'Multiple social applications match provider "%s"',
                social_account.provider,
            )
            return None

        custom_data = getattr(social_app, 'custom_data', None)
        if (
            not custom_data
            or custom_data.logout_behavior
            != SocialAppCustomData.LogoutBehavior.RP_INITIATED
        ):
            return None

        end_session_endpoint = (
            custom_data.end_session_endpoint
            or (social_app.settings and social_app.settings.get('end_session_endpoint'))
            or self._discover_end_session_endpoint(social_app)
        )
        if not end_session_endpoint:
            return None

        parsed = urlparse(end_session_endpoint)
        query_params = dict(parse_qsl(parsed.query))

        id_token = (
            social_account.extra_data.get('id_token')
            if isinstance(social_account.extra_data, dict)
            else None
        ) or (hasattr(request, 'session') and request.session.get('oidc_id_token'))
        if isinstance(id_token, str) and id_token.strip():
            query_params['id_token_hint'] = id_token

        post_logout_redirect_uri = (
            custom_data.post_logout_redirect_uri
            or (
                social_app.settings
                and social_app.settings.get('post_logout_redirect_uri')
            )
            or request.build_absolute_uri(settings.LOGIN_URL or '/')
        )
        if post_logout_redirect_uri:
            query_params['post_logout_redirect_uri'] = post_logout_redirect_uri

        if social_app.client_id:
            query_params['client_id'] = social_app.client_id

        return urlunparse(parsed._replace(query=urlencode(query_params)))

    def _discover_end_session_endpoint(self, social_app):
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
            resp.raise_for_status()
            data = resp.json()
            endpoint = (
                data.get('end_session_endpoint') if isinstance(data, dict) else None
            )
            value = endpoint if isinstance(endpoint, str) else ''
        except (requests.exceptions.RequestException, ValueError):
            logging.error(
                'Failed to retrieve OIDC discovery metadata from %s',
                well_known_url,
                exc_info=True,
            )
            value = ''

        timeout = 3600 if value else 300
        cache.set(cache_key, value, timeout=timeout)
        return value or None


class SocialAccountAdapter(DefaultSocialAccountAdapter):

    def get_app(self, request, provider, client_id=None):
        app = super().get_app(request, provider, client_id=client_id)
        if app:
            try:
                custom_data = app.custom_data
            except SocialAppCustomData.DoesNotExist:
                custom_data = None

            if (
                custom_data
                and custom_data.logout_behavior
                == SocialAppCustomData.LogoutBehavior.PROMPT_LOGIN
            ):
                settings = dict(app.settings or {})
                auth_params = dict(settings.get('auth_params', {}))
                auth_params['prompt'] = 'login'
                settings['auth_params'] = auth_params
                app.settings = settings
        return app

    def is_scim_enabled(self, request, sociallogin):
        app = getattr(sociallogin.provider, 'app', None)
        if app is None:
            try:
                app = self.get_app(request, sociallogin.account.provider)
            except (SocialApp.DoesNotExist, MultipleObjectsReturned):
                return False
        return IdentityProvider.objects.filter(social_app=app, is_active=True).exists()

    def is_open_for_signup(self, request, sociallogin):
        if self.is_scim_enabled(request, sociallogin):
            return False
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
        """
        Redirect first-time logins for SCIM-enabled IdPs to the provisioning wait
        screen, stash active social login metadata for RP-initiated logout, and
        allow only one linked SSO account per user during the connect flow.
        """
        # Handle SCIM provisioning race condition and session metadata for login/signup
        if sociallogin.state.get('process') != AuthProcess.CONNECT:
            if not sociallogin.is_existing and self.is_scim_enabled(
                request, sociallogin
            ):
                if getattr(sociallogin, 'provider', None) is None:
                    sociallogin.provider = self.get_provider(
                        request, sociallogin.account.provider
                    )
                email = sociallogin.user.email
                if (
                    email
                    and get_user_model().objects.filter(email__iexact=email).exists()
                ):
                    sociallogin.lookup()
                    if not sociallogin.is_existing:
                        raise ImmediateHttpResponse(
                            render_authentication_error(
                                request,
                                sociallogin.account.provider,
                                error='email_taken',
                                extra_context={
                                    'state': sociallogin.state,
                                    'error_message': (
                                        self.error_messages['email_taken']
                                        % sociallogin.provider.name
                                    ),
                                },
                            )
                        )
                if not sociallogin.is_existing:
                    request.session['scim_pending_sociallogin'] = (
                        sociallogin.serialize()
                    )
                    request.session['scim_provisioning_start'] = (
                        timezone.now().timestamp()
                    )
                    raise ImmediateHttpResponse(
                        HttpResponseRedirect(resolve_url('socialaccount_provisioning'))
                    )

            # Stash login metadata and id_token in session for deterministic logout handling.
            # Only login/signup flows establish an active social session; account connection does not.
            account = getattr(sociallogin, 'account', None)
            extra_data = getattr(account, 'extra_data', None)
            id_token = (
                extra_data.get('id_token') if isinstance(extra_data, dict) else None
            )
            if hasattr(request, 'session'):
                if isinstance(id_token, str) and id_token.strip():
                    request.session['oidc_id_token'] = id_token
                if account:
                    request.session['socialaccount_provider'] = account.provider
                    request.session['socialaccount_uid'] = account.uid
            return

        # Only the connect flow links a new provider; login/signup are exempt.
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


class HeadlessAdapter(DefaultHeadlessAdapter):
    """
    Adds `has_validated_password` to the user payload returned by the allauth
    session endpoint, so the frontend can read it there instead of `/me`
    """

    # allauth asks for the dataclass on every serialization, so build it once
    # rather than on each authentication response
    _user_dataclass = None

    def get_user_dataclass(self):
        # Override `get_user_dataclass()` and `user_as_dataclass()` rather than
        # `serialize_user()`: allauth only reflects the extra field in the
        # published OpenAPI schema when it is declared on the dataclass
        if HeadlessAdapter._user_dataclass is None:
            HeadlessAdapter._user_dataclass = dataclasses.make_dataclass(
                'User',
                [
                    (
                        'has_validated_password',
                        bool,
                        dataclasses.field(
                            # A default is required: allauth's
                            # `user_as_dataclass()` instantiates this class
                            # without knowing about the field.
                            # `user_as_dataclass()` below fills in the real value
                            default=True,
                            metadata={
                                'description': (
                                    'Whether the account password is valid. '
                                    'An administrator can invalidate it, '
                                    'setting this to false and restricting '
                                    'the account.'
                                ),
                                'example': True,
                            },
                        ),
                    )
                ],
                bases=(super().get_user_dataclass(),),
            )

        return HeadlessAdapter._user_dataclass

    def user_as_dataclass(self, user):
        user_dataclass = super().user_as_dataclass(user)
        return dataclasses.replace(
            user_dataclass,
            has_validated_password=self._has_validated_password(user),
        )

    def _has_validated_password(self, user) -> bool:
        """
        `ExtraUserDetail.validated_password` is the source of truth; the KoboCAT
        copy on `UserProfile` is synced from it. It defaults to True and only an
        administrator sets it to False, so an account without `extra_details`
        was never invalidated
        """
        if not user.pk:
            return True

        try:
            extra_details = user.extra_details
        except get_user_model().extra_details.RelatedObjectDoesNotExist:
            return True

        return extra_details.validated_password
