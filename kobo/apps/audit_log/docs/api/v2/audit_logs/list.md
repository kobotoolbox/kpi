## List actions performed by users.

<sup>*</sup> _Only available to superusers_

Results from this endpoint can be filtered by a Boolean query specified in the

`q` parameter.

**Filterable fields:**

1. app_label

2. model_name

3. action</br>
  a. Available actions:
   * create
   * delete
   * in-trash
   * put-back
   * remove
   * update
   * auth

4. log_type</br>
a. Available log types:
    * access
    * project-history
    * data-editing
    * submission-management
    * user-management
    * asset-management

5. date_created

6. user_uid

7. user__*</br>
a. user__username</br>
b. user__email</br>
c. user__is_superuser

8. metadata__*</br>
 a. metadata__asset_uid</br>
 b. metadata__auth_type</br>
 c. some logs may have additional filterable fields in the metadata

**Some examples:**

1. All deleted submissions
    `api/v2/audit-logs/?q=action:delete`

2. All deleted submissions of a specific project `aTJ3vi2KRGYj2NytSzBPp7`
    `api/v2/audit-logs/?q=action:delete AND metadata__asset_uid:aTJ3vi2KRGYj2NytSzBPp7`

3. All submissions deleted by a specific user `my_username`
    `api/v2/audit-logs/?q=action:delete AND user__username:my_username`

4. All deleted submissions submitted after a specific date
    `/api/v2/audit-logs/?q=action:delete AND date_created__gte:2022-11-15`

5. All deleted submissions submitted after a specific date **and time**
    `/api/v2/audit-logs/?q=action:delete AND date_created__gte:"2022-11-15 20:34"`

6. All authentications from superusers
    `api/v2/audit-logs/?q=action:auth AND user__is_superuser:True`

*Notes: Do not forget to wrap search terms in double-quotes if they contain spaces
(e.g. date and time "2022-11-15 20:34")*
