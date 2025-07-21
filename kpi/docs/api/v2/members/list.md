## List Members

Retrieves all members in the specified organization.

    > Response 200

    >       {
    >           "count": 2,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >               {
    >                   "url": "http://[kpi]/api/v2/organizations/org_12345/ \
    >                   members/foo_bar/",
    >                   "user": "http://[kpi]/api/v2/users/foo_bar/",
    >                   "user__username": "foo_bar",
    >                   "user__email": "foo_bar@example.com",
    >                   "user__name": "Foo Bar",
    >                   "role": "owner",
    >                   "user__has_mfa_enabled": true,
    >                   "date_joined": "2024-08-11T12:36:32Z",
    >                   "user__is_active": true,
    >                   "invite": {}
    >               },
    >               {
    >                   "url": "http://[kpi]/api/v2/organizations/org_12345/ \
    >                   members/john_doe/",
    >                   "user": "http://[kpi]/api/v2/users/john_doe/",
    >                   "user__username": "john_doe",
    >                   "user__email": "john_doe@example.com",
    >                   "user__name": "John Doe",
    >                   "role": "admin",
    >                   "user__has_mfa_enabled": false,
    >                   "date_joined": "2024-10-21T06:38:45Z",
    >                   "user__is_active": true,
    >                   "invite": {
    >                       "url": "http://[kpi]/api/v2/organizations/org_12345/
    >                       invites/83c725f1-3f41-4f72-9657-9e6250e130e1/",
    >                       "invited_by": "http://[kpi]/api/v2/users/raj_patel/",
    >                       "status": "accepted",
    >                       "invitee_role": "admin",
    >                       "created": "2024-10-21T05:38:45Z",
    >                       "modified": "2024-10-21T05:40:45Z",
    >                       "invitee": "john_doe"
    >                   }
    >               },
    >               {
    >                   "url": null,
    >                   "user": null,
    >                   "user__username": null,
    >                   "user__email": "null,
    >                   "user__extra_details__name": "null,
    >                   "role": null,
    >                   "user__has_mfa_enabled": null,
    >                   "date_joined": null,
    >                   "user__is_active": null,
    >                   "invite": {
    >                       "url": "http://[kpi]/api/v2/organizations/org_12345/
    >                       invites/83c725f1-3f41-4f72-9657-9e6250e130e1/",
    >                       "invited_by": "http://[kpi]/api/v2/users/raj_patel/",
    >                       "status": "pending",
    >                       "invitee_role": "admin",
    >                       "created": "2025-01-07T09:03:50Z",
    >                       "modified": "2025-01-07T09:03:50Z",
    >                       "invitee": "demo"
    >                   }
    >               },
    >           ]
    >       }

