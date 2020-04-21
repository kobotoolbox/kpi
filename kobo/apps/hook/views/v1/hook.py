# coding: utf-8
from kobo.apps.hook.views.v2.hook import HookViewSet as HookViewSetV2
from kobo.apps.hook.serializers.v1.hook import HookSerializer


class HookViewSet(HookViewSetV2):
    """
    ## This document is for a deprecated version of kpi's API.

    **Please upgrade to latest release `/api/v2/assets/{uid}/hooks/`**

    ## External services

    Lists the external services endpoints accessible to requesting user

    <pre class="prettyprint">
    <b>GET</b> /assets/{asset_uid}/hooks/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/

    ## CRUD

    * `asset_uid` - is the unique identifier of a specific asset
    * `uid` - is the unique identifier of a specific external service

    #### Retrieves an external service
    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{asset_uid}</code>/hooks/<code>{uid}</code>
    </pre>


    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/hfgha2nxBdoTVcwohdYNzb

    #### Add an external service to asset.
    <pre class="prettyprint">
    <b>POST</b> /assets/<code>{asset_uid}</code>/hooks/
    </pre>


    > Example
    >
    >       curl -X POST https://[kpi-url]/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/


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
    >           }
    >        }

    where

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
    >           "settings": {
    >               "customer_headers": {
    >                   "Authorization" : "Token 1af538baa9045a84c0e889f672baf83ff24"
    >               }

    #### Update an external service.
    <pre class="prettyprint">
    <b>PATCH</b> /assets/<code>{asset_uid}</code>/hooks/{uid}
    </pre>


    > Example
    >
    >       curl -X PATCH https://[kpi-url]/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/hfgha2nxBdoTVcwohdYNzb


    Only specify properties to update in the payload. See above for payload structure

    #### Delete an external service.
    <pre class="prettyprint">
    <b>DELETE</b> /assets/<code>{asset_uid}</code>/hooks/{uid}
    </pre>


    > Example
    >
    >       curl -X DELETE https://[kpi-url]/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/hfgha2nxBdoTVcwohdYNzb

    #### Retries all failed attempts
    <pre class="prettyprint">
    <b>PATCH</b> /assets/<code>{asset_uid}</code>/hooks/<code>{hook_uid}</code>/retry/
    </pre>

    **This call is asynchronous. Job is sent to Celery to be run in background**

    > Example
    >
    >       curl -X PATCH https://[kpi-url]/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/hfgha2nxBdoTVcwohdYNzb/retry/

    It returns all logs `uid`s that are being retried.

    ### CURRENT ENDPOINT
    """
    URL_NAMESPACE = None

    serializer_class = HookSerializer
