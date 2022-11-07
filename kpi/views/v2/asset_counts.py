from django.conf import settings
from django.http import Http404

from rest_framework import mixins, viewsets
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models.asset import Asset
from kpi.permissions import ViewSubmissionPermission
from kpi.serializers.v2.asset_counts import AssetCountsSerializer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AssetCountsViewSet(
    AssetNestedObjectViewsetMixin,
    NestedViewSetMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    ### Counts Endpoint

    Returns up to the last 31 days of daily counts and total counts of submissions to a survey.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/{uid}/counts/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/counts/

     > Response
    >
    >       HTTP 200 Ok
    >        {
    >           "daily_submission_counts": {
    >               "2022-10-20": 7,
    >           },
    >           "total_submission_count": 37
    >        }
    >

    #### Queries

    Query days to return the last x amount of daily counts up to a maximum of 31 days.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/{uid}/counts/?days={int}
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/counts/?days=7

    ### CURRENT ENDPOINT
    """
    parent_model = Asset
    permission_classes = [ViewSubmissionPermission]

    def list(self, request, *args, **kwargs):
        if not self.asset.has_deployment:
            raise Http404
        context = self.get_serializer_context()
        context['days'] = request.query_params.get(
            'days', settings.DEFAULT_SUBMISSIONS_COUNT_NUMBER_OF_DAYS
        )
        serializer = AssetCountsSerializer(self.asset, context=context)
        return Response(serializer.data)
