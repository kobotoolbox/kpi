## Retrieve transfer details


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
