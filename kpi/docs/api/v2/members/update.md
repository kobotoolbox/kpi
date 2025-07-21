## Update Member Role

Updates the role of a member within the organization to `admin` or
`member`.

- **admin**: Grants the member admin privileges within the organization
- **member**: Revokes admin privileges, setting the member as a regular user

    > Payload

    >     {
    >         "role": "admin"
    >     }

    > Response 200

    >     {
    >         "url": "http://[kpi]/api/v2/organizations/org_12345/members/foo_bar/",
    >         "user": "http://[kpi]/api/v2/users/foo_bar/",
    >         "user__username": "foo_bar",
    >         "user__email": "foo_bar@example.com",
    >         "user__name": "Foo Bar",
    >         "role": "admin",
    >         "user__has_mfa_enabled": true,
    >         "date_joined": "2024-08-11T12:36:32Z",
    >         "user__is_active": true
    >     }
