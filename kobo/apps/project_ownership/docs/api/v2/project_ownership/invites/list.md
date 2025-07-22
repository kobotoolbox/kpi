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

