## Create an invite


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
