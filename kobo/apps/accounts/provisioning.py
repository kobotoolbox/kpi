from allauth.socialaccount.internal.flows.login import _login
from allauth.socialaccount.internal.flows.signup import clear_pending_signup
from allauth.socialaccount.models import SocialLogin
from django.conf import settings
from django.http import HttpResponseRedirect
from django.shortcuts import render, resolve_url
from django.utils import timezone
from django.views import View
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response
from kpi.versioning import APIV2Versioning
from .constants import SCIM_PROVISIONING_POLL_INTERVAL, SCIM_PROVISIONING_TIMEOUT
from .serializers import SocialAccountProvisioningResponseSerializer


@extend_schema(tags=['Authentication'])
@extend_schema_view(
    get=extend_schema(
        description=read_md('accounts', 'social_accounts/provisioning.md'),
        responses=open_api_200_ok_response(
            SocialAccountProvisioningResponseSerializer,
            require_auth=False,
            raise_access_forbidden=False,
            raise_not_found=False,
            validate_payload=False,
        ),
    ),
)
class SocialAccountProvisioningView(APIView):
    """
    Polling endpoint for first-time SSO users waiting for SCIM account provisioning.
    """

    authentication_classes = ()
    permission_classes = (AllowAny,)
    versioning_class = APIV2Versioning
    serializer_class = SocialAccountProvisioningResponseSerializer

    def get(self, request, *args, **kwargs):
        data = request.session.get('socialaccount_sociallogin')
        start_time = request.session.get('scim_provisioning_start')

        # If no active provisioning session, return expired without error
        if not data or not start_time:
            return Response(
                {
                    'ready': False,
                    'expired': True,
                    'redirect_url': None,
                },
                status=status.HTTP_200_OK,
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
            login_response = _login(request, sociallogin)
            redirect_url = getattr(login_response, 'url', None)
            if not redirect_url and login_response.has_header('Location'):
                redirect_url = login_response['Location']
            if not redirect_url:
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


class SocialAccountProvisioningHTMLView(View):
    """
    Renders the provisioning wait screen for current Django template flows.
    """

    def get(self, request, *args, **kwargs):
        data = request.session.get('socialaccount_sociallogin')
        start_time = request.session.get('scim_provisioning_start')

        if not data or not start_time:
            return HttpResponseRedirect(
                resolve_url(settings.LOGIN_URL or 'account_login')
            )

        return render(
            request,
            'socialaccount/provisioning.html',
            {
                'expired': False,
                'poll_interval': SCIM_PROVISIONING_POLL_INTERVAL,
                'timeout': SCIM_PROVISIONING_TIMEOUT,
            },
        )
