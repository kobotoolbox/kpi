# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

from kpi.views.v2.hook_signal import HookSignalViewSet as HookSignalViewSetV2


class HookSignalViewSet(HookSignalViewSetV2):
    """
    ## This document is for a deprecated version of kpi's API.

    **Please upgrade to latest release `/api/v2/collections/`**


    This endpoint is only used to trigger asset's hooks if any.

    Tells the hooks to post an instance to external servers.
    <pre class="prettyprint">
    <b>POST</b> /assets/<code>{uid}</code>/hook-signal/
    </pre>


    > Example
    >
    >       curl -X POST https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/hook-signal/


    > **Expected payload**
    >
    >        {
    >           "instance_id": {integer}
    >        }

    """

    pass
