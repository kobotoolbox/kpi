## List actions performed by users.

⚠️ _Only available to superusers_

Results from this endpoint can be filtered by a Boolean query specified in the `q` parameter.

**Filterable fields:**

* app_label
* model_name
* action
  Available actions:
   * create
   * delete
   * in-trash
   * put-back
   * remove
   * update
   * auth
* log_type
  Available log types:
    * access
    * project-history
    * data-editing
    * submission-management
    * user-management
    * asset-management
* date_created
* user_uid
* user__username
* user__email
* user__is_superuser
* metadata__asset_uid
* metadata__auth_type

*Notes: Some logs may have additional filterable fields in the metadata*

**Some examples:**

* All deleted submissions
    `api/v2/audit-logs/?q=action:delete`
* All deleted submissions of a specific project `aTJ3vi2KRGYj2NytSzBPp7`
    `api/v2/audit-logs/?q=action:delete AND metadata__asset_uid:aTJ3vi2KRGYj2NytSzBPp7`
* All submissions deleted by a specific user `my_username`
    `api/v2/audit-logs/?q=action:delete AND user__username:my_username`
* All deleted submissions submitted after a specific date
    `/api/v2/audit-logs/?q=action:delete AND date_created__gte:2022-11-15`
* All deleted submissions submitted after a specific date **and time**
    `/api/v2/audit-logs/?q=action:delete AND date_created__gte:"2022-11-15 20:34"`
* All authentications from superusers
    `api/v2/audit-logs/?q=action:auth AND user__is_superuser:True`

*Notes: Do not forget to wrap search terms in double-quotes if they contain spaces
(e.g. date and time "2022-11-15 20:34")*
