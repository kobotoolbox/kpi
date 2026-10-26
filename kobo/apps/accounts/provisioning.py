from allauth.socialaccount.internal.flows.login import _login
from allauth.socialaccount.internal.flows.signup import clear_pending_signup
from allauth.socialaccount.models import SocialLogin
from django.conf import settings
from django.shortcuts import resolve_url
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    ErrorDetailSerializer,
    open_api_200_ok_response,
)
from kpi.versioning import APIV2Versioning
from .constants import SCIM_PROVISIONING_TIMEOUT
from .serializers import SocialAccountProvisioningResponseSerializer


@extend_schema(tags=['Authentication'])
@extend_schema_view(
    get=extend_schema(
        description=read_md('accounts', 'social_accounts/provisioning.md'),
        responses={
            **open_api_200_ok_response(
                SocialAccountProvisioningResponseSerializer,
                require_auth=False,
                raise_access_forbidden=False,
                raise_not_found=False,
                validate_payload=False,
            ),
            (status.HTTP_400_BAD_REQUEST, 'application/json'): OpenApiResponse(
                response=ErrorDetailSerializer,
                description='No pending provisioning session found.',
            ),
        },
    ),
)
class SocialAccountProvisioningView(APIView):
    """
    Polling endpoint for first-time SSO users waiting for SCIM account provisioning.
    """

    permission_classes = (AllowAny,)
    versioning_class = APIV2Versioning
    serializer_class = SocialAccountProvisioningResponseSerializer

    def get(self, request, *args, **kwargs):
        data = request.session.get('socialaccount_sociallogin')
        start_time = request.session.get('scim_provisioning_start')

        if not data or not start_time:
            return Response(
                {'detail': 'No pending provisioning session found.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check timeout / expiration
        now = timezone.now().timestamp()
        if now - start_time > SCIM_PROVISIONING_TIMEOUT:
            clear_pending_signup(request)
            request.session.pop('scim_provisioning_start', None)
            return Response(
                {
                    'ready': False,
                    'expired': True,
                    'redirect_url': None,
                },
                status=status.HTTP_200_OK,
            )

        sociallogin = SocialLogin.deserialize(data)
        sociallogin.lookup()

        if sociallogin.is_existing:
            # SCIM created the account! Clear provisioning state and log in.
            clear_pending_signup(request)
            request.session.pop('scim_provisioning_start', None)
            _login(request, sociallogin)
            redirect_url = sociallogin.get_redirect_url(request) or resolve_url(
                settings.LOGIN_REDIRECT_URL
            )
            return Response(
                {
                    'ready': True,
                    'expired': False,
                    'redirect_url': redirect_url,
                },
                status=status.HTTP_200_OK,
            )

        # Still waiting
        return Response(
            {
                'ready': False,
                'expired': False,
                'redirect_url': None,
            },
            status=status.HTTP_200_OK,
        )
