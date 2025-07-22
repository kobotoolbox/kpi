## Update an invite status

Update the status of an invite.
Status accepted:
- `cancelled`
- `accepted`
- `declined`

_**Notes**: When submitting `accepted` the invite status becomes automatically `in_progress`_

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
