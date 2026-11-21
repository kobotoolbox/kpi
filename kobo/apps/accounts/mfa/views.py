from http import HTTPStatus
from typing import Any

from allauth.account.adapter import get_adapter as get_account_adapter
from allauth.account.internal.stagekit import unstash_login
from allauth.headless.base.response import UnauthorizedResponse
from allauth.headless.internal.restkit.response import ErrorResponse
from allauth.headless.mfa.response import (
    RecoveryCodesNotFoundResponse,
    RecoveryCodesResponse,
)
from allauth.headless.mfa.views import (
    AuthenticateView as BaseHeadlessMfaAuthenticateView,
)
from allauth.headless.mfa.views import (
    ManageRecoveryCodesView as BaseHeadlessManageRecoveryCodesView,
)
from allauth.headless.mfa.views import ManageTOTPView as BaseHeadlessManageTOTPView
from allauth.headless.mfa.views import (
    ReauthenticateView as BaseHeadlessMfaReauthenticateView,
)
from allauth.mfa.adapter import get_adapter
from allauth.mfa.adapter import get_adapter as get_mfa_adapter
from allauth.mfa.base.views import AuthenticateView, ReauthenticateView
from allauth.mfa.internal.flows.add import validate_can_add_authenticator
from allauth.mfa.models import Authenticator
from allauth.mfa.recovery_codes.internal.flows import view_recovery_codes
from allauth.mfa.totp.internal import auth as totp_auth
from django.db.models import QuerySet
from django.http import HttpRequest, HttpResponse, HttpResponseBase
from django.utils.translation import gettext as t
from rest_framework import serializers
from rest_framework.exceptions import NotFound, Throttled
from rest_framework.generics import ListAPIView
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST
from rest_framework.views import APIView

from kpi.permissions import IsAuthenticated
from kpi.utils.log import logging
from ..mixins import ThrottledHeadlessMfaMixin, ThrottledMfaMixin
from ..throttling import auth_success, rate_limit
from .flows import activate_totp, regenerate_codes
from .inputs import MfaAuthenticateInput, MfaReauthenticateInput
from .permissions import IsMfaEnabled
from .serializers import MfaCodeSerializer, UserMfaMethodSerializer
from .utils import MFA_METHOD_NAME, get_totp_authenticator, has_hashed_migrated_codes


class MfaListUserMethodsView(ListAPIView):
    """
    Display user's methods with dates
    """

    serializer_class = UserMfaMethodSerializer
    permission_classes = (IsAuthenticated,)
    pagination_class = None

    def get_queryset(self) -> QuerySet:
        return Authenticator.objects.filter(
            user_id=self.request.user.id, type=Authenticator.Type.TOTP
        )


class MfaMethodActivationView(APIView):
    permission_classes = (IsAuthenticated, IsMfaEnabled)

    @staticmethod
    def post(request: Request, method: str) -> Response:
        if method != MFA_METHOD_NAME:
            raise NotFound

        user = request.user
        adapter = get_adapter()
        validate_can_add_authenticator(user)

        response_data = {}
        status = HTTP_200_OK
        totp = get_totp_authenticator(user)
        if totp is not None:
            # Already active: show the current secret again
            secret = adapter.decrypt(totp.data['secret'])
        else:
            try:
                # Kept in the session until the confirmation endpoint
                # validates a code against it
                secret = totp_auth.get_totp_secret(regenerate=True)
            except Exception as cause:
                status = HTTP_400_BAD_REQUEST
                # Log the cause, but never expose it to the client
                logging.error(cause, exc_info=True)
                response_data['error'] = t(
                    'Could not activate this method. Please try again later.'
                )

        if status == HTTP_200_OK:
            response_data['details'] = adapter.build_totp_url(user, secret)

        return Response(response_data, status=status)


class MfaMethodConfirmView(APIView):
    permission_classes = (IsAuthenticated, IsMfaEnabled)

    @staticmethod
    def post(request: Request, method: str) -> Response:
        toto, recovery_codes = activate_totp(request, method)
        backup_codes = recovery_codes.get_unused_codes()
        return Response({'backup_codes': backup_codes})


class MfaReauthenticateView(ReauthenticateView, ThrottledMfaMixin):
    def post(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponseBase:
        try:
            with rate_limit(
                'login_failed', request.user.username, request, auth_success
            ):
                return super().post(request, *args, **kwargs)
        except Throttled:
            return self.throttled_response(request)

    def get_error_form(self):
        return self.get_form()


class HeadlessManageTOTPView(BaseHeadlessManageTOTPView):
    """
    Refuses to turn MFA off when the MFA adapter forbids it (superusers while
    `SUPERUSER_AUTH_ENFORCEMENT` is on). allauth only checks
    `can_delete_authenticator()` in its templated form, not in headless mode
    """

    def delete(self, request, *args, **kwargs):
        authenticator = self._get_authenticator()
        adapter = get_mfa_adapter()
        if authenticator and not adapter.can_delete_authenticator(authenticator):
            return ErrorResponse(
                request,
                exception=adapter.validation_error('cannot_delete_authenticator'),
                status=HTTPStatus.FORBIDDEN,
            )
        return super().delete(request, *args, **kwargs)


class HeadlessManageRecoveryCodesView(BaseHeadlessManageRecoveryCodesView):
    """
    Shows how many recovery codes migrated from the former 2FA system are left,
    but not the codes: only their hashes are stored, which allauth would show
    as if they were the codes
    """

    def get(self, request, *args, **kwargs):
        recovery_codes, can_view = view_recovery_codes(request)
        if not recovery_codes:
            return RecoveryCodesNotFoundResponse(request)
        return RecoveryCodesResponse(
            request,
            recovery_codes.instance,
            can_view=can_view and not has_hashed_migrated_codes(recovery_codes),
        )


class HeadlessMfaReauthenticateView(
    BaseHeadlessMfaReauthenticateView, ThrottledHeadlessMfaMixin
):
    """
    Re-authentication with a 2FA code, accepting legacy recovery codes like the
    templated page does
    """

    input_class = MfaReauthenticateInput

    def dispatch(
        self, request: HttpRequest, *args: Any, **kwargs: Any
    ) -> HttpResponseBase:
        try:
            with rate_limit(
                'login_failed', request.user.username, request, auth_success
            ):
                return super().dispatch(request, *args, **kwargs)
        except Throttled:
            return self.throttled_response(request)


class HeadlessMfaAuthenticateView(
    BaseHeadlessMfaAuthenticateView, ThrottledHeadlessMfaMixin
):
    """
    The 2FA step of the login, accepting legacy recovery codes like the
    templated page does
    """

    input_class = MfaAuthenticateInput

    def dispatch(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        # at this point the user is only present in the session
        login = unstash_login(request, peek=True)
        if not login or not login.user:
            return UnauthorizedResponse(request)
        username = login.user.username
        try:
            with rate_limit('login_failed', username, request, auth_success):
                return super().dispatch(request, *args, **kwargs)
        except Throttled:
            return self.throttled_response(request)


class MfaAuthenticateView(AuthenticateView, ThrottledMfaMixin):

    def post(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        username = self.form.user.username
        try:
            with rate_limit('login_failed', username, request, auth_success):
                return super().post(request, *args, **kwargs)
        except Throttled:
            return self.throttled_response(request)

    def get_error_form(self):
        return self.form


class MfaMethodRegenerateCodesView(APIView):
    permission_classes = (IsAuthenticated, IsMfaEnabled)

    def post(self, request: Request, method: str) -> Response:
        username = request.user.username
        try:
            with rate_limit('login_failed', username, request, auth_success):
                mfa_serializer = MfaCodeSerializer(
                    data=request.data, context={'user': request.user, 'method': method}
                )
                mfa_serializer.is_valid(raise_exception=True)
                recovery_codes = regenerate_codes(request, method)
                backup_codes = recovery_codes.get_unused_codes()
                return Response({'backup_codes': backup_codes})
        except Throttled:
            # can't use ThrottledHeadlessMfaMixin here because it relies on some
            # namespace magic in allauth's ApiResponse, and this is in a different
            # namespace
            raise serializers.ValidationError(
                {
                    'code': [
                        get_account_adapter().error_messages['too_many_login_attempts']
                    ]
                }
            )
