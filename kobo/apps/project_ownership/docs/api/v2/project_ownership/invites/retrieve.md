## Invite detail

It can be useful to monitor the invite status while the transfer is being process

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

