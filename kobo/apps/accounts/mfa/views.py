from allauth.account.views import LoginView
from allauth.mfa.adapter import get_adapter
from allauth.mfa.internal.flows.add import validate_can_add_authenticator
from allauth.mfa.totp.internal import auth as totp_auth
from django.db.models import QuerySet
from django.urls import reverse
from rest_framework.generics import ListAPIView
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST
from rest_framework.views import APIView

from kpi.permissions import IsAuthenticated
from kpi.utils.log import logging
from ..forms import LoginForm
from .flows import activate_totp, deactivate_totp, regenerate_codes
from .models import MfaMethodsWrapper
from .permissions import IsMfaEnabled
from .serializers import TOTPCodeSerializer, UserMfaMethodSerializer


class MfaLoginView(LoginView):
    form_class = LoginForm

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
        # lack of permissions.
        user = self.request.user
        if (
            user.is_authenticated
            and self.redirect_field_name in self.request.POST
            and not user.is_superuser
            and redirect_to.startswith(reverse('admin:index'))
        ):
            return ''

        return redirect_to


class MfaListUserMethodsView(ListAPIView):
    """
    Display user's methods with dates
    """

    serializer_class = UserMfaMethodSerializer
    permission_classes = (IsAuthenticated,)
    pagination_class = None

    def get_queryset(self) -> QuerySet:
        return MfaMethodsWrapper.objects.filter(user_id=self.request.user.id)


class MfaMethodActivationView(APIView):
    permission_classes = (IsAuthenticated, IsMfaEnabled)

    @staticmethod
    def post(request: Request, method: str) -> Response:
        user = request.user
        adapter = get_adapter()
        validate_can_add_authenticator(user)

        mfa, created = MfaMethodsWrapper.objects.get_or_create(
            user_id=user.pk,
            name=method,
        )
        response_data = {}
        status = HTTP_200_OK
        if created or mfa.totp is None:
            try:
                mfa.is_active = False  # Activate until we verify the totp code
                mfa.secret = adapter.encrypt(totp_auth.get_totp_secret(regenerate=True))
                mfa.save()
            except Exception as cause:
                status = HTTP_400_BAD_REQUEST
                logging.error(cause, exc_info=True)
                response_data['error'] = str(cause)

        if status == HTTP_200_OK:
            secret = adapter.decrypt(mfa.secret)
            totp_url = adapter.build_totp_url(user, secret)
            response_data['details'] = totp_url

        return Response(response_data, status=status)


class MfaMethodConfirmView(APIView):
    permission_classes = (IsAuthenticated, IsMfaEnabled)

    @staticmethod
    def post(request: Request, method: str) -> Response:
        toto, recovery_codes = activate_totp(request, method)
        backup_codes = recovery_codes.get_unused_codes()
        return Response({'backup_codes': backup_codes})


class MfaMethodDeactivateView(APIView):
    permission_classes = (IsAuthenticated, IsMfaEnabled)

    @staticmethod
    def post(request: Request, method: str) -> Response:
        serializer = TOTPCodeSerializer(
            data=request.data, context={'user': request.user, 'method': method}
        )
        serializer.is_valid(raise_exception=True)
        deactivate_totp(request, method)
        return Response({})


class MfaMethodRegenerateCodesView(APIView):
    permission_classes = (IsAuthenticated, IsMfaEnabled)

    @staticmethod
    def post(request: Request, method: str) -> Response:
        serializer = TOTPCodeSerializer(
            data=request.data, context={'user': request.user, 'method': method}
        )
        serializer.is_valid(raise_exception=True)
        recovery_codes = regenerate_codes(request, method)
        backup_codes = recovery_codes.get_unused_codes()
        return Response({'backup_codes': backup_codes})
