# coding: utf-8

from rest_framework import (
    renderers,
    serializers,
    status,
    viewsets,
)
from rest_framework.response import Response

from kpi.models import Asset


class ServiceUsageViewSet(viewsets.ViewSet):
    """
    ## Service Usage Tracker
    Tracks the submissions for the current month
    Tracks the current total storage used
    <pre class="prettyprint">
    <b>GET</b> /api/v2/service_usage/
    </pre>
    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/service_usage/
    ### CURRENT ENDPOINT
    """
    http_method_names = ['get']
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )

    def list(self, request, *args, **kwargs):
        data = {
            'total_submission_count_current_month': 0,
            'total_submission_count_all_time': 0,
            'total_storage_bytes': 0,
            'per_asset_usage': [],
        }

        assets = Asset.objects.filter(owner=request.user)

        current_month_total = 0
        all_time_total = 0
        total_storage_bytes = 0

        for asset in assets:
            if asset._deployment_data:
                form_usage = asset.deployment.service_usage(request)
                data['per_asset_usage'].append(form_usage)
                current_month_total += form_usage['submission_count_current_month']
                all_time_total += form_usage['submission_count_all_time']
                total_storage_bytes += form_usage['storage_bytes']

        data['total_submission_count_current_month'] = current_month_total
        data['total_submission_count_all_time'] = all_time_total
        data['total_storage_bytes'] = total_storage_bytes

        return Response(data, status=status.HTTP_200_OK)
