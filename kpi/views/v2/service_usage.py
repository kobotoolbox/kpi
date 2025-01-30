from rest_framework import (
    renderers,
    viewsets,
)
from rest_framework.response import Response

from kpi.permissions import IsAuthenticated
from kpi.serializers.v2.service_usage import ServiceUsageSerializer
from kpi.utils.object_permission import get_database_user


class ServiceUsageViewSet(viewsets.GenericViewSet):
    """
    <span class='label label-warning'>⚠️ Deprecated</span>
    ## Service Usage Tracker

    <p>Tracks the total usage of different services for the logged-in user</p>
    <p>Tracks the submissions and NLP seconds/characters for the current month/year/all time</p>
    <p>Tracks the current total storage used</p>
    <p>Note: this endpoint is not currently used by the frontend to display usage information</p>
    <p>See /api/v2/organizations/{organization_id}/service_usage/ for the endpoint we use on the Usage page</p>

    <pre class="prettyprint">
    <b>GET</b> /api/v2/service_usage/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/service_usage/
    >       {
    >           "total_nlp_usage": {
    >               "asr_seconds_current_period": {integer},
    >               "asr_seconds_all_time": {integer},
    >               "mt_characters_current_period": {integer},
    >               "mt_characters_all_time": {integer},
    >           },
    >           "total_storage_bytes": {integer},
    >           "total_submission_count": {
    >               "current_period": {integer},
    >               "all_time": {integer},
    >           },
    >           "current_period_start": {string (date), ISO format},
    >           "current_period_end": {string (date), ISO format},
    >       }


    ### CURRENT ENDPOINT
    """

    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )
    pagination_class = None
    permission_classes = (IsAuthenticated,)

    def list(self, request, *args, **kwargs):
        serializer = ServiceUsageSerializer(
            get_database_user(request.user),
            context=self.get_serializer_context(),
        )
        return Response(data=serializer.data)
