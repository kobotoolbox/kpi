from allauth.usersessions.adapter import get_adapter
from allauth.usersessions.models import UserSession
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from kpi.permissions import IsAuthenticated


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
