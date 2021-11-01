import copy
import json
from datetime import datetime

from django.db.models import Sum
from django.urls import reverse
from rest_framework import (
    renderers,
    serializers,
    status,
    viewsets,
)
from rest_framework.response import Response

from kpi.exceptions import ObjectDeploymentDoesNotExist
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatSubmissionCounter,
    KobocatXForm,
    ReadOnlyKobocatAttachments,
    ReadOnlyKobocatInstance
)
from kpi.models import Asset
from kpi.permissions import IsOwnerOrReadOnly


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

    def _get_deployment(self):
        """
        Returns the deployment for the asset specified by the request
        """
        if not self.asset.has_deployment:
            raise ObjectDeploymentDoesNotExist(
                _('The specified asset has not been deployed')
            )

        return self.asset.deployment

    def list(self, request, *args, **kwargs):
        assets = Asset.objects.deployed().filter(owner=request.user)

        # deployment.current_month_submission_count_all_projects
        response_data = {
            'current_month_submission_count_total': '',
            # 'total_storage_bytes': '',
            'per_asset_usage': [],
        }
        total_count = 0
        for asset in assets:
            response_data.get('per_asset_usage').append({
                'asset': request.build_absolute_uri(
                    reverse('api_v2:asset-detail', kwargs={'uid': asset.uid}),
                ),
                'asset__name': asset.name,
                'submission_count': asset.deployment.current_month_submission_count,
                # 'storage_bytes': 0,
            })
            total_count += asset.deployment.current_month_submission_count

        response_data['current_month_submission_count_total'] = total_count
        return Response(response_data, status=status.HTTP_200_OK)
