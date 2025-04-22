access_logs_get = """
Access logs

Lists all access logs for all users. Only available to superusers.

Submissions will be grouped together by user by hour

<pre class="prettyprint">
<b>GET</b> /api/v2/access-logs/
</pre>

> Example
>
>       curl -X GET https://[kpi-url]/access-logs/

> Response 200

>       {
>           "count": 10,
>           "next": null,
>           "previous": null,
>           "results": [
>                {
>                    "user": "http://localhost/api/v2/users/admin/",
>                    "user_uid": "u12345",
>                    "username": "admin",
>                    "metadata": {
>                        "source": "Firefox (Ubuntu)",
>                        "auth_type": "digest",
>                        "ip_address": "172.18.0.6"
>                   },
>                    "date_created": "2024-08-19T16:48:58Z",
>                },
>                {
>                    "user": "http://localhost/api/v2/users/someuser/",
>                    "user_uid": "u5678",
>                    "username": "someuser",
>                    "metadata": {
>                        "auth_type": "submission-group",
>                    },
>                    "date_created": "2024-08-19T16:00:00Z"
>                },
>                ...
>           ]
>       }

Results from this endpoint can be filtered by a Boolean query
specified in the `q` parameter.

**Filterable fields:**

1. date_created

2. user_uid

3. user__*

    a. user__username

    b. user__email

    c. user__is_superuser

4. metadata__*

    a. metadata__auth_type

        available auth types:

        i. django-loginas

        ii. token

        iii. digest

        iv. basic

        v. submission-group

        vi. kpi.backends.ModelBackend

        vii. authorized-application

        viii. oauth2

        ix. unknown

    b. metadata__source

    c. metadata__ip_address

    d. metadata__initial_user_uid

    e. metadata__initial_user_username

    f. metadata__authorized_app_name

This endpoint can be paginated with 'offset' and 'limit' parameters, eg
>      curl -X GET https://[kpi-url]/access-logs/?offset=100&limit=50
"""

access_logs_me = """
Access logs

Lists all access logs for the authenticated user

Submissions will be grouped together by hour

<pre class="prettyprint">
<b>GET</b> /api/v2/access-logs/me/
</pre>

> Example
>
>       curl -X GET https://[kpi-url]/access-logs/me/

> Response 200

>       {
>           "count": 10,
>           "next": null,
>           "previous": null,
>           "results": [
>                {
>                    "user": "http://localhost/api/v2/users/admin/",
>                    "user_uid": "u12345",
>                    "username": "admin",
>                    "metadata": {
>                        "source": "Firefox (Ubuntu)",
>                        "auth_type": "Digest",
>                        "ip_address": "172.18.0.6"
>                    },
>                    "date_created": "2024-08-19T16:48:58Z"
>                },
>                {
>                    "user": "http://localhost/api/v2/users/admin/",
>                    "user_uid": "u12345",
>                    "username": "admin",
>                    "metadata": {
>                        "auth_type": "submission-group",
>                    },
>                    "date_created": "2024-08-19T16:00:00Z"
>                },
>                ...
>           ]
>       }

This endpoint can be paginated with 'offset' and 'limit' parameters, eg
>      curl -X GET https://[kpi-url]/access-logs/me/?offset=100&limit=50

will return entries 100-149

"""

access_logs_export_get = """
Access logs export

Lists all access logs export tasks for all users. Only available to superusers.

<pre class="prettyprint">
<b>GET</b> /api/v2/access-logs/export
</pre>

> Example
>

>       curl -X GET https://[kpi-url]/access-logs/export

> Response 200
>
>       [
>           {
>               "uid": "aleooVUrhe3cRrLY5urRhxLA",
>               "status": "complete",
>               "date_created": "2024-11-26T21:27:08.403181Z"
>           },
>           {
>               "uid": "aleMzK7RnuaPokb86TZF2N4d",
>               "status": "complete",
>               "date_created": "2024-11-26T20:18:55.982974Z"
>           }
>       ]
"""

access_logs_export_post = """
Access logs export

### Creates an export task

<pre class="prettyprint">
<b>POST</b> /api/v2/access-log/export
</pre>

> Example
>
>       curl -X POST https://[kpi-url]/access-logs/export

> Response 202
>
>       [
>           "status: created"
>       ]
>
"""

access_logs_me_export_get = """
Access logs export

Lists all access logs export tasks for the authenticated user

<pre class="prettyprint">
<b>GET</b> /api/v2/access-logs/me/export
</pre>

> Example
>
>       curl -X GET https://[kpi-url]/access-logs/me/export

> Response 200
>
>       [
>           {
>               "uid": "aleooVUrhe3cRrLY5urRhxLA",
>               "status": "complete",
>               "date_created": "2024-11-26T21:27:08.403181Z"
>           },
>           {
>               "uid": "aleMzK7RnuaPokb86TZF2N4d",
>               "status": "complete",
>               "date_created": "2024-11-26T20:18:55.982974Z"
>           }
>       ]
"""

access_logs_me_export_post = """
Access logs export

Creates an export task

<pre class="prettyprint">
<b>POST</b> /api/v2/access-log/me/export
</pre>

> Example
>
>       curl -X POST https://[kpi-url]/access-logs/me/export

> Response 202
>
>       [
>           "status: created"
>       ]
>
"""
