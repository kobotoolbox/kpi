## Create Organization Invite

* Create organization invites for registered and unregistered users.
* Set the role for which the user is being invited -
(Choices: `member`, `admin`). Default is `member`.


    > Example
    >
    >     curl -X POST https://[kpi]/api/v2/organizations/org_12345/invites/

    > Payload

    >     {
    >         "invitees": ["demo14", "demo13@demo13.com", "demo20@demo20.com"]
    >         "role": "member"
    >     }

    > Response 200

    >     [
    >         {
    >             "url": "http://kf.kobo.local/api/v2/organizations/
                  org_12345/invites/f3ba00b2-372b-4283-9d57-adbe7d5b1bf1/",
    >             "invited_by": "http://kf.kobo.local/api/v2/users/raj_patel/",
    >             "status": "pending",
    >             "invitee_role": "member",
    >             "created": "2024-12-20T13:35:13Z",
    >             "modified": "2024-12-20T13:35:13Z",
    >             "invitee": "demo14"
    >         },
    >         {
    >             "url": "http://kf.kobo.local/api/v2/organizations/
                  org_12345/invites/5e79e0b4-6de4-4901-bbe5-59807fcdd99a/",
    >             "invited_by": "http://kf.kobo.local/api/v2/users/raj_patel/",
    >             "status": "pending",
    >             "invitee_role": "member",
    >             "created": "2024-12-20T13:35:13Z",
    >             "modified": "2024-12-20T13:35:13Z",
    >             "invitee": "demo13"
    >         },
    >         {
    >             "url": "http://kf.kobo.local/api/v2/organizations/
                  org_12345/invites/3efb7217-171f-47a5-9a42-b23055e499d4/",
    >             "invited_by": "http://kf.kobo.local/api/v2/users/raj_patel/",
    >             "status": "pending",
    >             "invitee_role": "member",
    >             "created": "2024-12-20T13:35:13Z",
    >             "modified": "2024-12-20T13:35:13Z",
    >             "invitee": "demo20@demo20.com"
    >         }
    >     ]
