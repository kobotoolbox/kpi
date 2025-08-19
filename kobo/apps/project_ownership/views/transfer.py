from django.shortcuts import Http404
from django.db.models import Prefetch
from rest_framework import viewsets

from kpi.permissions import IsAuthenticated
from ..models import Transfer, TransferStatus
from ..serializers import TransferDetailSerializer


class TransferViewSet(viewsets.ReadOnlyModelViewSet):

    """
    ## List of transfers

    <span class='label label-danger'>Not implemented</span> Refer to invite list instead.

    ## Transfer detail

    It provides more details on error

    <pre class="prettyprint">
    <b>GET</b> /api/v2/project-ownership/invites/&lt;invite_uid&gt;/transfers/&lt;transfer_uid&gt;/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/transfers/pot54pTqM5qwKdZ4wnNdiwDY/

    <pre class="prettyprint">
    <b>HTTP 200 OK</b>
    {
       "url": "https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/transfers/pot54pTqM5qwKdZ4wnNdiwDY/",
       "asset": "https://[kpi]/api/v2/assets/a8rg3w7ZNL5Nwj7iHzKiyX/",
       "status": "in_progress",
       "error": null,
       "date_modified": "2023-12-14T21:17:29Z",
       "statuses": [
            {
                "status": "success",
                "status_type": "submissions",
                "error": null
            },
            {
                "status": "success",
                "status_type": "media_files",
                "error": null
            },
            {
                "status": "in_progress",
                "status_type": "attachments",
                "error": null
            },
            {
                "status": "in_progress",
                "status_type": "global",
                "error": null
            }
        ]
    }
    </pre>


    ### CURRENT ENDPOINT
    """

    model = Transfer
    lookup_field = 'uid'
    permission_classes = (IsAuthenticated,)
    serializer_class = TransferDetailSerializer

    def get_queryset(self):

        queryset = (
            self.model.objects.all()
            .select_related('asset')
            .only('asset__uid')
            .prefetch_related(
                Prefetch(
                    'statuses',
                    queryset=TransferStatus.objects.all(),
                    to_attr='prefetched_statuses',
                )
            )
        )

        return queryset

    def list(self, request, *args, **kwargs):
        raise Http404()
