
from kpi.permissions import IsAuthenticated
from ...audit_log.base_views import AuditLoggedModelViewSet
from ..filters import InviteFilter
from ..models import Invite
from ..serializers import InviteSerializer


class InviteViewSet(AuditLoggedModelViewSet):
    """
    ## List of invites

    Invites sent or received by current user about transfer project ownership.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/project-ownership/invites/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/project-ownership/invites/

    <pre class="prettyprint">
    <b>HTTP 200 OK</b>
    {
        "count": 1
        "next": ...
        "previous": ...
        "results": [
            {
               "url": "https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/",
               "recipient": "https://[kpi]/api/v2/users/bob/",
               "status": "complete",
               "date_created": "2023-12-14T21:17:27Z",
               "date_modified": "2023-12-14T21:17:29Z",
               "transfers": [
                   {
                       "url": "https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/transfers/pot54pTqM5qwKdZ4wnNdiwDY/",
                       "asset": "https://[kpi]/api/v2/assets/a8rg3w7ZNL5Nwj7iHzKiyX/",
                       "status": "success",
                       "error": null,
                       "date_modified": "2023-12-14T21:17:29Z"
                   }
               ]
           }
        ]
    }
    </pre>

    List can be filtered with `mode` parameter,  e.g.: display only received invites.

    Possible values for `mode`:

    - `sender`
    - `recipient`


    ## Create an invite

    <pre class="prettyprint">
    <b>POST</b> /api/v2/project-ownership/invites/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/project-ownership/invites/


    > Payload to create (send) an invite
    >
    >       {
    >            "recipient": "https://[kpi]/api/v2/users/alice/",
    >            "assets": [
    >                "a8rg3w7ZNL5Nwj7iHzKiyX"
    >            ]
    >       }

    <pre class="prettyprint">
    <b>HTTP 201 OK</b>
    {
        "url": "https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/",
        "recipient": "https://[kpi]/api/v2/users/alice/",
        "status": "pending",
        "date_created": "2023-12-14T21:17:27Z",
        "date_modified": "2023-12-14T21:17:29Z",
        "transfers": [
           {
               "url": "https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/transfers/pot54pTqM5qwKdZ4wnNdiwDY/",
               "asset": "https://[kpi]/api/v2/assets/a8rg3w7ZNL5Nwj7iHzKiyX/",
               "status": "pending",
               "error": null,
               "date_modified": "2023-12-14T21:17:29Z"
           }
        ]
    }
    </pre>

    ## Cancel an invite

    <span class='label label-warning'>Only the sender can cancel an invite, and **if only if** the invite is still pending.</span>

    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/project-ownership/invites/&lt;invite_uid&gt;/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/


    > Payload to cancel an invite
    >
    >       {
    >            "status": "cancelled"
    >       }

    <pre class="prettyprint">
    <b>HTTP 200 OK</b>
    {
        "url": "https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/",
        "recipient": "https://[kpi]/api/v2/users/alice/",
        "status": "cancelled",
        "date_created": "2023-12-14T21:17:27Z",
        "date_modified": "2023-12-14T21:17:29Z",
        "transfers": [
           {
               "url": "https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/transfers/pot54pTqM5qwKdZ4wnNdiwDY/",
               "asset": "https://[kpi]/api/v2/assets/a8rg3w7ZNL5Nwj7iHzKiyX/",
               "status": "cancelled",
               "error": null,
               "date_modified": "2023-12-14T21:17:29Z"
           }
        ]
    }
    </pre>

    ## Accept or decline an invite

    <span class='label label-warning'>Only the recipient can accept or decline, **if and only if** the invite is still pending.</span>

    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/project-ownership/invites/&lt;invite_uid&gt;/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/

    > Payload to accept (or decline) an invite
    >
    >       {
    >            "status": "accepted|declined"
    >       }

    <pre class="prettyprint">
    <b>HTTP 200 OK</b>
    {
        "url": "https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/",
        "recipient": "https://[kpi]/api/v2/users/alice/",
        "status": "in_progress|declined",
        "date_created": "2023-12-14T21:17:27Z",
        "date_modified": "2023-12-14T21:17:29Z",
        "transfers": [
           {
               "url": "https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/transfers/pot54pTqM5qwKdZ4wnNdiwDY/",
               "asset": "https://[kpi]/api/v2/assets/a8rg3w7ZNL5Nwj7iHzKiyX/",
               "status": "in_progress|cancelled",
               "error": null,
               "date_modified": "2023-12-14T21:17:29Z"
           }
        ]
    }
    </pre>

    _**Notes**: When submitting `accepted` the invite status becomes automatically `in_progress`_


    ## Invite detail

    It can be useful to monitor the invite status while the transfer is being
    process

    <pre class="prettyprint">
    <b>GET</b> /api/v2/project-ownership/invites/&lt;invite_uid&gt;/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/

    <pre class="prettyprint">
    <b>HTTP 200 OK</b>
    {
        "url": "https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/",
        "recipient": "https://[kpi]/api/v2/users/alice/",
        "status": "in_progress",
        "date_created": "2023-12-14T21:17:27Z",
        "date_modified": "2023-12-14T21:17:29Z",
        "transfers": [
           {
               "url": "https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/transfers/pot54pTqM5qwKdZ4wnNdiwDY/",
               "asset": "https://[kpi]/api/v2/assets/a8rg3w7ZNL5Nwj7iHzKiyX/",
               "status": "in_progress",
               "error": null,
               "date_modified": "2023-12-14T21:17:29Z"
           },
           ...
          {
               "url": "https://[kpi]/api/v2/project-ownership/invites/poi52fGkwDjQeZkUxcaou39q/transfers/potKpv6rc9xGoPwSHft2prWs/",
               "asset": "https://[kpi]/api/v2/assets/a8jyVbhvaPSBRtYqoshiLE/",
               "status": "success",
               "error": null,
               "date_modified": "2023-12-14T21:16:29Z"
           }
        ]
    }
    </pre>


    ### CURRENT ENDPOINT
    """

    model = Invite
    lookup_field = 'uid'
    serializer_class = InviteSerializer
    permission_classes = (IsAuthenticated,)
    filter_backends = (InviteFilter, )
    log_type = 'project-history'
    logged_fields = ['recipient.username', 'status', 'transfers']

    def get_queryset(self):

        queryset = (
            self.model.objects
            .select_related('sender')
            .select_related('recipient')
        )

        return queryset
