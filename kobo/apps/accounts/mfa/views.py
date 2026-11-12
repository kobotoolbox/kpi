from allauth.mfa.adapter import get_adapter
from allauth.mfa.internal.flows.add import validate_can_add_authenticator
from allauth.mfa.models import Authenticator
from allauth.mfa.totp.internal import auth as totp_auth
from django.db.models import QuerySet
from django.utils.translation import gettext as t
from rest_framework.exceptions import NotFound
from rest_framework.generics import ListAPIView
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST
from rest_framework.views import APIView

from kpi.permissions import IsAuthenticated
from kpi.utils.log import logging
from ..throttling import auth_success, rate_limit
from .flows import activate_totp, deactivate_totp, regenerate_codes
from .permissions import EnforceSuperuserMFA, IsMfaEnabled
from .serializers import MfaCodeSerializer, UserMfaMethodSerializer
from .utils import MFA_METHOD_NAME, get_totp_authenticator


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


class MfaMethodDeactivateView(APIView):
    permission_classes = (IsAuthenticated, IsMfaEnabled, EnforceSuperuserMFA)

    @staticmethod
    def post(request: Request, method: str) -> Response:
        username = request.username
        with rate_limit(
            'login_failed',
            request=request,
            username=username,
            rollback_signal=auth_success,
        ):
            serializer = MfaCodeSerializer(
                data=request.data, context={'user': request.user, 'method': method}
            )
            serializer.is_valid(raise_exception=True)
            deactivate_totp(request, method)
            return Response({})


class MfaMethodRegenerateCodesView(APIView):
    permission_classes = (IsAuthenticated, IsMfaEnabled)

    @staticmethod
    def post(request: Request, method: str) -> Response:
        username = request.username
        with rate_limit(
            'login_failed',
            request=request,
            username=username,
            rollback_signal=auth_success,
        ):
            serializer = MfaCodeSerializer(
                data=request.data, context={'user': request.user, 'method': method}
            )
            serializer.is_valid(raise_exception=True)
            recovery_codes = regenerate_codes(request, method)
            backup_codes = recovery_codes.get_unused_codes()
            return Response({'backup_codes': backup_codes})
