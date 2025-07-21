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
