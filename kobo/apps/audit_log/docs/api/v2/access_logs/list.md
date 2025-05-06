### Lists all access logs for all users. Only available to superusers.

Submissions will be grouped together by user by hour

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

      _The metadata field is only returned when the `auth-type` is not `submission-group`._

    c. metadata__ip_address

      _The metadata field is only returned when the `auth-type` is not `submission-group`._

    d. metadata__initial_user_uid

     _The metadata field is only returned when the `auth-type` is `django-loginas`._

    e. metadata__initial_user_username

     _The metadata field is only returned when the `auth-type` is `django-loginas`._

    f. metadata__authorized_app_name

    _The metadata field is only returned when the `auth-type` is `authorized-application`._

This endpoint can be paginated with `offset` and `limit` parameters, e.g.:

```shell
curl -X GET https://[kpi-url]/access-logs/?offset=100&limit=50
```

will return entries 100-149
