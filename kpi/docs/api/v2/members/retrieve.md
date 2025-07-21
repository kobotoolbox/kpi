## Retrieve Member Details

Retrieves the details of a specific member within an organization by username.


    > Response 200

    >       {
    >           "url": "http://[kpi]/api/v2/organizations/org_12345/members/foo_bar/",
    >           "user": "http://[kpi]/api/v2/users/foo_bar/",
    >           "user__username": "foo_bar",
    >           "user__email": "foo_bar@example.com",
    >           "user__name": "Foo Bar",
    >           "role": "owner",
    >           "user__has_mfa_enabled": true,
    >           "date_joined": "2024-08-11T12:36:32Z",
    >           "user__is_active": true
    >       }
