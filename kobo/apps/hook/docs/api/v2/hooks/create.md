## Add an external service to asset.


    > **Payload to create a new external service**
    >
    >        {
    >           "name": {string},
    >           "endpoint": {string},
    >           "active": {boolean},
    >           "email_notification": {boolean},
    >           "export_type": {string},
    >           "subset_fields": [{string}],
    >           "auth_level": {string},
    >           "settings": {
    >               "username": {string},
    >               "password": {string},
    >               "custom_headers": {
    >                   {string}: {string}
    >                   ...
    >                   {string}: {string}
    >               }
    >           },
    >           "payload_template": {string}
    >        }

Where

* `name` and `endpoint` are required
* `active` is True by default
* `export_type` must be one these values:

    1. `json` (_default_)
    2. `xml`

* `email_notification` is a boolean. If true, User will be notified when request to remote server has failed.
* `auth_level` must be one these values:

    1. `no_auth` (_default_)
    2. `basic_auth`

* `subset_fields` is the list of fields of the form definition. Only these fields should be present in data sent to remote server
* `settings`.`custom_headers` is dictionary of `custom header`: `value`

For example:
>         "settings": {
>             "customer_headers": {
>                 "Authorization" : "Token 1af538baa9045a84c0e889f672baf83ff24"
>             }

* `payload_template` is a custom wrapper around `%SUBMISSION%` when sending data to remote server.
   It can be used only with JSON submission format.

For example:
>         "payload_template": '{"fields": %SUBMISSION%}'
