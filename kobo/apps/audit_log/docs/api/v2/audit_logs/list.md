## List actions performed by users.

Only available for superusers.

    > Response 200

    >       {
    >           "count": 2,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >               {
    >                    "app_label": "foo",
    >                    "model_name": "bar",
    >                    "user": "http://kf.kobo.local/api/v2/users/kobo_user/",
    >                    "user_uid": "u12345",
    >                    "action": "delete",
    >                    "date_created": "2024-10-01T00:01:00Z",
    >                    "log_type": "asset-management",
    >               },
    >               {
    >                    "app_label": "kobo_auth",
    >                    "model_name": "user",
    >                    "user": "http://kf.kobo.local/api/v2/users/another_user/",
    >                    "user_uid": "u12345",
    >                    "username": "another_user",
    >                    "action": "auth",
    >                    "metadata": {
    >                        "source": "Firefox (Ubuntu)",
    >                        "auth_type": "Digest",
    >                        "ip_address": "1.2.3.4"
    >                   },
    >                    "date_created": "2024-10-01T00:00:00Z",
    >                    "log_type": "access"
    >                },
    >           ]
    >       }

Results from this endpoint can be filtered by a Boolean query specified in the

`q` parameter.

**Filterable fields:**

1. app_label

2. model_name

3. action
    a. Available actions:
    * create
    * delete
    * in-trash
    * put-back
    * remove
    * update
    * auth

4. log_type
    a. Available log types:
    * access
    * project-history
    * data-editing
    * submission-management
    * user-management
    * asset-management

5. date_created

6. user_uid

7. user__*
    a. user__username
    b. user__email
    c. user__is_superuser

8. metadata__*
    a. metadata__asset_uid
    b. metadata__auth_type
    c. some logs may have additional filterable fields in the metadata

**Some examples:**

1. All deleted submissions<br>
    `api/v2/audit-logs/?q=action:delete`

2. All deleted submissions of a specific project `aTJ3vi2KRGYj2NytSzBPp7`<br>
    `api/v2/audit-logs/?q=action:delete AND metadata__asset_uid:aTJ3vi2KRGYj2NytSzBPp7`

3. All submissions deleted by a specific user `my_username`<br>
    `api/v2/audit-logs/?q=action:delete AND user__username:my_username`

4. All deleted submissions submitted after a specific date<br>
    `/api/v2/audit-logs/?q=action:delete AND date_created__gte:2022-11-15`

5. All deleted submissions submitted after a specific date **and time**<br>
    `/api/v2/audit-logs/?q=action:delete AND date_created__gte:"2022-11-15 20:34"`

6. All authentications from superusers<br>
    `api/v2/audit-logs/?q=action:auth AND user__is_superuser:True`

*Notes: Do not forget to wrap search terms in double-quotes if they contain spaces
(e.g. date and time "2022-11-15 20:34")*
