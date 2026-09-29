from allauth.account.adapter import get_adapter as get_account_adapter
from allauth.usersessions.adapter import get_adapter
from allauth.usersessions.models import UserSession
from django.contrib.auth import logout as auth_logout
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from kpi.permissions import IsAuthenticated
from kpi.schema_extensions.v2.logout.serializers import LogoutResponse
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response


class LogoutView(APIView):
    """
    Log out the current user session and return the redirect URL.
    Returns HTTP 200 with JSON to avoid background browser redirect/CORS issues.
    """

    permission_classes = (AllowAny,)

    @extend_schema(
        tags=['User / team / organization / usage'],
        description=read_md('kpi', 'logout/post.md'),
        responses=open_api_200_ok_response(
            LogoutResponse,
            require_auth=False,
            validate_payload=False,
            raise_access_forbidden=False,
            raise_not_found=False,
        ),
    )
    def post(self, request, *args, **kwargs):
        adapter = get_account_adapter()
        redirect_url = adapter.get_logout_redirect_url(request)

        if request.user.is_authenticated:
            auth_logout(request)

        return Response({'redirect_url': redirect_url}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes((IsAuthenticated,))
def logout_from_all_devices(request):
    """
    Log calling user out from all devices

    <pre class="prettyprint">
    <b>POST</b> /logout-all/
    </pre>

    > Example
    >
    >       curl -H 'Authorization Token 12345' -X POST https://[kpi-url]/logout-all

    > Response 200

    >  { "Logged out of all sessions" }

    """
    user = request.user
    all_user_sessions = UserSession.objects.purge_and_list(user)
    adapter = get_adapter()
    adapter.end_sessions(all_user_sessions)
    return Response('Logged out of all sessions')
