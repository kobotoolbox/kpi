## Update Organization Invite

* Update an organization invite to accept, decline, cancel, expire, or resend.
* Update the role of the invitee to `admin` or `member`. Only the owner or admin can update the role.

  <pre class="prettyprint">
  <b>PATCH</b> /api/v2/organizations/{organization_id}/invites/{invite_guid}/
  </pre>

    > Example
    >
    >     curl -X PATCH https://[kpi]/api/v2/organizations/org_12345/invites/f3ba00b2-372b-4283-9d57-adbe7d5b1bf1/  # noqa

    > Payload (Update Status)

    >     {
    >         "status": "accepted"
    >     }

    > Payload (Update Role - Only owner or admin can update role)

    >     {
    >         "role": "admin"
    >     }

    > Response 200

    >     {
    >         "url": "http://kf.kobo.local/api/v2/organizations/org_12345/invites/f3ba00b2-372b-4283-9d57-adbe7d5b1bf1/",  # noqa
    >         "invited_by": "http://kf.kobo.local/api/v2/users/raj_patel/",
    >         "status": "accepted",
    >         "invitee_role": "member",
    >         "created": "2024-12-20T13:35:13Z",
    >         "modified": "2024-12-20T13:35:13Z",
    >         "invitee": "demo14"
    >     }
