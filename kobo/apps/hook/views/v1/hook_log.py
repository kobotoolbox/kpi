# coding: utf-8
from kobo.apps.hook.views.v2.hook_log import HookLogViewSet as HookLogViewSetV2
from kobo.apps.hook.serializers.v1.hook_log import HookLogSerializer


class HookLogViewSet(HookLogViewSetV2):
    """
    ## This document is for a deprecated version of kpi's API.

    **Please upgrade to latest release `/api/v2/assets/{uid}/hooks/{hook_uid}/logs/`**

    ## Logs of an external service

    ** Users can't add, update or delete logs with the API. They can only retry failed attempts (see below)**

    #### Lists logs of an external services endpoints accessible to requesting user
    <pre class="prettyprint">
    <b>GET</b> /assets/{asset_uid}/hooks/{hook_uid}/logs/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/hSBxsiVNa5UxkVAjwu6dFB/logs/



    * `asset_uid` - is the unique identifier of a specific asset
    * `hook_uid` - is the unique identifier of a specific external service
    * `uid` - is the unique identifier of a specific log

    #### Retrieves a log
    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{asset_uid}</code>/hooks/<code>{hook_uid}</code>/logs/<code>{uid}</code>/
    </pre>


    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/hfgha2nxBdoTVcwohdYNzb/logs/3005940a-6e30-4699-813a-0ee5b2b07395/


    #### Retries a failed attempt
    <pre class="prettyprint">
    <b>PATCH</b> /assets/<code>{asset_uid}</code>/hooks/<code>{hook_uid}</code>/logs/<code>{uid}</code>/retry/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/hfgha2nxBdoTVcwohdYNzb/logs/3005940a-6e30-4699-813a-0ee5b2b07395/retry/


    ### CURRENT ENDPOINT
    """
    URL_NAMESPACE = None

    serializer_class = HookLogSerializer
