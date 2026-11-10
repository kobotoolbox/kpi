from typing import Any

from allauth.account.models import EmailAddress
from allauth.account.views import LoginView as BaseLoginView
from allauth.headless.account.views import LoginView as BaseHeadlessLoginView
from allauth.socialaccount.adapter import get_adapter as get_socialaccount_adapter
from allauth.socialaccount.models import SocialAccount, SocialApp
from django.conf import settings
from django.contrib.auth import logout
from django.core.exceptions import MultipleObjectsReturned
from django.http import Http404, HttpRequest, HttpResponse, HttpResponseBase
from django.shortcuts import resolve_url
from django.urls import reverse
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import generics, mixins, status, viewsets
from rest_framework.exceptions import Throttled
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from kpi.permissions import IsAuthenticated
from kpi.utils.log import logging
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    ErrorDetailSerializer,
    open_api_200_ok_response,
    open_api_201_created_response,
    open_api_204_empty_response,
)
from kpi.versioning import APIV2Versioning
from .constants import EMAIL_CONFIRMATION_REQUESTED_DETAIL
from .extend_schemas.api.v2.email.examples import (
    get_email_confirmation_request_examples,
    get_email_create_examples,
)
from .extend_schemas.api.v2.email.serializers import (
    EmailConfirmationRequestPayload,
    EmailConfirmationRequestResponse,
    EmailReauthenticationRequiredResponse,
    EmailRequestPayload,
)
from .forms import LoginForm
from .mixins import MultipleFieldLookupMixin
from .permissions import NotManagedSSOPermission
from .reauthentication import (
    is_session_authenticated,
    reauthentication_required,
    reauthentication_required_response,
    validate_stateless_reauthentication,
)
from .serializers import (
    EmailAddressSerializer,
    EmailConfirmationRequestSerializer,
    SocialAccountSerializer,
    SocialAppDetailSerializer,
)
from .throttling import EmailConfirmationRequestEmailThrottle, auth_success, rate_limit
from .utils import throttled_json_response, throttled_template_response


@extend_schema(tags=['User / team / organization / usage'])
@extend_schema_view(
    list=extend_schema(
        description=read_md('accounts', 'me/email/list.md'),
        responses=open_api_200_ok_response(
            EmailAddressSerializer,
            raise_not_found=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    create=extend_schema(
        description=read_md('accounts', 'me/email/create.md'),
        request={'application/json': EmailRequestPayload},
        examples=get_email_create_examples(),
        responses={
            **open_api_201_created_response(
                EmailAddressSerializer,
                raise_not_found=False,
                raise_access_forbidden=False,
            ),
            (status.HTTP_403_FORBIDDEN, 'application/json'): OpenApiResponse(
                response=EmailReauthenticationRequiredResponse,
                description=(
                    'The session is valid but the user has not re-authenticated'
                    ' recently enough. Walk the user through every flow listed'
                    ' in `flows`, then retry this request.'
                ),
                examples=[
                    OpenApiExample(
                        name='Re-authentication required',
                        value={
                            'detail': (
                                'Re-authentication is required for this action.'
                            ),
                            'code': 'reauthentication_required',
                            'flows': [
                                {'id': 'reauthenticate'},
                                {'id': 'mfa_reauthenticate', 'types': ['totp']},
                            ],
                        },
                        response_only=True,
                        media_type='application/json',
                    )
                ],
            ),
            (
                status.HTTP_429_TOO_MANY_REQUESTS,
                'application/json',
            ): OpenApiResponse(
                response=ErrorDetailSerializer,
                description=(
                    'Too many email change attempts. The endpoint is rate'
                    ' limited because it accepts `current_password`.'
                ),
                examples=[
                    OpenApiExample(
                        name='Throttled',
                        value={
                            'detail': (
                                'Request was throttled. Expected available in'
                                ' 3600 seconds.'
                            )
                        },
                        response_only=True,
                        media_type='application/json',
                    )
                ],
            ),
        },
    ),
)
class EmailAddressViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    Viewset for managing current user email address

    Available actions:
    - list           → GET       /me/
    - create         → CREATE    /me/

    Documentation:
    - docs/api/v2/me/email/list.md
    - docs/api/v2/me/email/create.md
    """

    queryset = EmailAddress.objects.all()
    serializer_class = EmailAddressSerializer
    permission_classes = (IsAuthenticated,)
    versioning_class = APIV2Versioning
    throttle_scope = 'email_change'

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def get_throttles(self):
        # The create action accepts `current_password`, so it must be throttled
        # to prevent unbounded password-guessing attempts when account-level
        # rate limiting is disabled and DRF has no global throttle configured
        if self.action == 'create':
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def create(self, request, *args, **kwargs):
        # Validate the email before re-authenticating: verifying a 2FA code spends
        # it, so nothing that could still reject the request may run afterwards
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Changing the email address is a sensitive action: a stolen session or
        # token could otherwise be used to take the account over. Require
        # re-authentication, by whichever means the caller is able to provide
        if is_session_authenticated(request):
            if reauthentication_required(request):
                return reauthentication_required_response(request)
        else:
            validate_stateless_reauthentication(request)

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    def delete(self, request, format=None):
        request.user.emailaddress_set.filter(
            primary=False, verified=False
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=['User / team / organization / usage'])
@extend_schema_view(
    post=extend_schema(
        description=read_md('accounts', 'email_confirmations/create.md'),
        request={'application/json': EmailConfirmationRequestPayload},
        responses=open_api_200_ok_response(
            EmailConfirmationRequestResponse,
            require_auth=False,
            raise_access_forbidden=False,
            raise_not_found=False,
            raise_throttled=True,
            validations_errors={'email': ['Enter a valid email address.']},
        ),
        examples=get_email_confirmation_request_examples(),
    ),
)
class EmailConfirmationView(APIView):
    """
    Send another account confirmation email, on request

    Available actions:
    - create         → POST     /api/v2/email-confirmations/

    Documentation:
    - docs/api/v2/email_confirmations/create.md

    The response is identical whether the address is unverified, already verified,
    or unknown, so the endpoint cannot be used to discover who holds an account.
    Mail is only ever sent in the first of those cases.

    Which email that is depends on the account: one with nothing verified yet is
    being activated and gets the activation email, while one that already has a
    verified address is partway through an email change and gets the address
    verification email.
    """

    permission_classes = (AllowAny,)
    versioning_class = APIV2Versioning
    serializer_class = EmailConfirmationRequestSerializer
    throttle_classes = (EmailConfirmationRequestEmailThrottle,)

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        for address in self._get_unverified_addresses(
            serializer.validated_data['email']
        ):
            self._send_confirmation(request, address)

        return Response(
            {'detail': EMAIL_CONFIRMATION_REQUESTED_DETAIL},
            status=status.HTTP_200_OK,
        )

    def _get_unverified_addresses(self, email):
        """
        Get every unverified row for this address whose owner is still active

        One address can belong to several accounts, and each owner is entitled to
        their own link.

        Matched on the lowercased address, the way allauth looks this table up,
        because `iexact` compiles to `UPPER(email) = UPPER(%s)`, which no index
        covers and which turns into a sequential scan over a row per user.
        """
        return EmailAddress.objects.filter(
            email=email.strip().lower(), verified=False, user__is_active=True
        ).select_related('user')

    def _send_confirmation(self, request, address):
        """
        Send one confirmation link

        `signup=False` because no signup is happening here. Which of the three
        emails that becomes is decided by `AccountAdapter`, from whether the
        account already has a verified address.

        Delivery failures are logged rather than raised: mail is only ever
        attempted for a registered address, so a 5xx would confirm the address is
        registered.
        """
        try:
            # Not allauth's `send_verification_email_to_address()`: that also
            # queues a Django message, which an anonymous caller receives as a
            # cookie reading "Confirmation email sent to <address>."
            address.send_confirmation(request, signup=False)
        except Exception:
            logging.exception(
                'Failed to send a requested confirmation email for EmailAddress %s',
                address.pk,
            )


@extend_schema(tags=['User / team / organization / usage'])
@extend_schema_view(
    destroy=extend_schema(
        description=read_md('accounts', 'me/social/delete.md'),
        responses=open_api_204_empty_response(
            raise_access_forbidden=True,
            validate_payload=False,
        ),
    ),
    list=extend_schema(
        description=read_md('accounts', 'me/social/list.md'),
        responses=open_api_200_ok_response(
            SocialAccountSerializer,
            raise_not_found=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('accounts', 'me/social/retrieve.md'),
        responses=open_api_200_ok_response(
            SocialAccountSerializer,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
)
class SocialAccountViewSet(
    MultipleFieldLookupMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Viewset for managing current user's socials

    Available actions:
    - destroy        → DELETE   /me/social-accounts/{provider}/{uid_social_account}/
    - list           → GET      /me/social-accounts/
    - retrieve       → GET      /me/social-accounts/{provider}/{uid_social_account}/

    Documentation:
    - docs/api/v2/me/social/destroy.md
    - docs/api/v2/me/social/list.md
    - docs/api/v2/me/social/retrieve.md
    """

    lookup_value_regex = r'(?P<provider>[^/.]+)/(?P<uid_social_account>[-\w]+)'
    lookup_fields = ['provider', 'uid']
    lookup_field_map = {'uid': 'uid_social_account'}
    queryset = SocialAccount.objects.all()
    serializer_class = SocialAccountSerializer
    permission_classes = (IsAuthenticated,)
    versioning_class = APIV2Versioning

    def get_permissions(self):
        if self.action == 'destroy':
            return (
                IsAuthenticated(),
                NotManagedSSOPermission(),
            )
        return super().get_permissions()

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)


@extend_schema(tags=['Configuration'])
@extend_schema_view(
    get=extend_schema(
        description=read_md('accounts', 'social_apps/retrieve.md'),
        responses=open_api_200_ok_response(
            SocialAppDetailSerializer,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
)
class SocialAppView(generics.RetrieveAPIView):
    """
    Public, display-only detail view for a configured Social Application (SSO
    provider)

    Available actions:
    - retrieve       → GET      /api/v2/social-apps/{provider_id}/

    Documentation:
    - docs/api/v2/social_apps/retrieve.md

    Organizations with a provider that is deliberately hidden from the login page
    (`SocialAppCustomData.is_public = False`) reach it through a direct link that
    only varies by `provider_id`. The SPA rebuilds that screen client-side, so it
    needs to turn a `provider_id` from the URL into a display name and to tell a
    real provider from a typo, so it can render the right 404.

    Hidden providers therefore resolve here, exactly as they already do at
    `/accounts/oidc/{provider_id}/login/`. That URL is "not advertised, but usable
    by anyone with the link", and a caller asking about a provider already knows
    the only thing that link requires. Listing stays filtered to public providers
    in `/environment`; there is deliberately no list route here.
    """

    serializer_class = SocialAppDetailSerializer
    permission_classes = (AllowAny,)
    versioning_class = APIV2Versioning
    lookup_url_kwarg = 'provider_id'

    def get_object(self):
        provider_id = self.kwargs[self.lookup_url_kwarg]
        # Resolve through allauth's adapter rather than querying `SocialApp`
        # directly, so this endpoint agrees with the two flows it sits between:
        # the legacy `/accounts/oidc/{provider_id}/login/` page, and allauth's
        # headless `auth/provider/redirect`, which the SPA posts to next. Both
        # look providers up this way, so a 200 here means the redirect will work
        try:
            social_app = get_socialaccount_adapter().get_app(self.request, provider_id)
        except SocialApp.DoesNotExist:
            raise Http404
        except MultipleObjectsReturned:
            # Several apps share this id, so it cannot be resolved to one
            # provider - the same misconfiguration would break the login flow
            # itself. Report it as unresolvable and leave a trace for operators
            logging.error(
                'Multiple social applications match provider id "%s"', provider_id
            )
            raise Http404

        # A no-op under `AllowAny`, but overriding `get_object()` is what skips
        # object-level checks. Kept so tightening `permission_classes` is enough
        self.check_object_permissions(self.request, social_app)
        return social_app


# HeadlessMfaLoginView and MfaLoginView replace the default allauth views in
# kobo/urls.py


class HeadlessLoginView(BaseHeadlessLoginView):

    def dispatch(self, request, *args: Any, **kwargs: Any) -> HttpResponseBase:
        request_data = self._parse_json(request)
        username = request_data['username']
        try:
            with rate_limit('login_failed', username, request, auth_success):
                return super().dispatch(request, *args, **kwargs)
        except Throttled:
            return throttled_json_response(request)


class LoginView(BaseLoginView):
    form_class = LoginForm

    def post(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponseBase:
        form = self.get_form()
        username = form.data['login']
        try:
            with rate_limit('login_failed', username, request, auth_success):
                return super().post(request, *args, **kwargs)
        except Throttled:
            return throttled_template_response(self, form, '__all__')

    def form_valid(self, form) -> HttpResponse:
        """
        Overload parent method to drop a stale session before logging in.
        """
        # `form.user` is the account being authenticated. Remember it before
        # anything else: allauth calls `get_success_url()` before the login`
        # completes, and the `logout()` below clears `request.user`, so
        # `request.user` is not a reliable reference to the target user there.
        self._login_user = form.user

        user = self.request.user
        if user.is_authenticated and user.pk != form.user.pk:
            logout(self.request)

        return super().form_valid(form)

    def get_success_url(self):
        """
        Overload parent method to validate `next` url
        """
        redirect_to = super().get_success_url()

        if not redirect_to:
            redirect_to = self.request.POST.get(
                self.redirect_field_name,
                self.request.GET.get(self.redirect_field_name, ''),
            )

        # We do not want to redirect a regular user to `/admin/` if they
        # are not a superuser. Otherwise, they are successfully authenticated,
        # redirected to the admin platform, then disconnected because of the
        # lack of permissions. Check the account being authenticated
        # (`self._login_user`), not `request.user`: this runs before the login
        # completes, and a stale session may have just been logged out.
        user = getattr(self, '_login_user', self.request.user)
        if (
            user.is_authenticated
            and self.redirect_field_name in self.request.POST
            and not user.is_superuser
            and redirect_to.startswith(reverse('admin:index'))
        ):
            return resolve_url(settings.LOGIN_REDIRECT_URL)

        return redirect_to
