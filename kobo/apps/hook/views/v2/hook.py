# coding: utf-8
from datetime import timedelta

import constance
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import ugettext as _
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.hook.constants import HOOK_LOG_FAILED, HOOK_LOG_PENDING
from kobo.apps.hook.models import Hook, HookLog
from kobo.apps.hook.serializers.v2.hook import HookSerializer
from kobo.apps.hook.tasks import retry_all_task
from kpi.permissions import AssetEditorSubmissionViewerPermission
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class HookViewSet(AssetNestedObjectViewsetMixin, NestedViewSetMixin,
                  viewsets.ModelViewSet):
    """

    ## External services

    Lists the external services endpoints accessible to requesting user

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/{asset_uid}/hooks/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/api/v2/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/

    ## CRUD

    * `asset_uid` - is the unique identifier of a specific asset
    * `uid` - is the unique identifier of a specific external service

    #### Retrieves an external service
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/hooks/<code>{uid}</code>
    </pre>


    > Example
    >
    >       curl -X GET https://[kpi-url]/api/v2/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/hfgha2nxBdoTVcwohdYNzb

    #### Add an external service to asset.
    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{asset_uid}</code>/hooks/
    </pre>


    > Example
    >
    >       curl -X POST https://[kpi-url]/api/v2/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/


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

    * `payload_template` is a custom wrapper around `%SUBMISSION%` when sending data to remote server.
       It can be used only with JSON submission format.

    For example:
    >           "payload_template": '{"fields": %SUBMISSION%}'

    #### Update an external service.
    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/assets/<code>{asset_uid}</code>/hooks/{uid}
    </pre>


    > Example
    >
    >       curl -X PATCH https://[kpi-url]/api/v2/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/hfgha2nxBdoTVcwohdYNzb


    Only specify properties to update in the payload. See above for payload structure

    #### Delete an external service.
    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/assets/<code>{asset_uid}</code>/hooks/{uid}
    </pre>


    > Example
    >
    >       curl -X DELETE https://[kpi-url]/api/v2/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/hfgha2nxBdoTVcwohdYNzb

    #### Retries all failed attempts
    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/assets/<code>{asset_uid}</code>/hooks/<code>{hook_uid}</code>/retry/
    </pre>

    **This call is asynchronous. Job is sent to Celery to be run in background**

    > Example
    >
    >       curl -X PATCH https://[kpi-url]/api/v2/assets/a9PkXcgVgaDXuwayVeAuY5/hooks/hfgha2nxBdoTVcwohdYNzb/retry/

    It returns all logs `uid`s that are being retried.

    ### CURRENT ENDPOINT
    """

    model = Hook
    lookup_field = "uid"
    serializer_class = HookSerializer
    permission_classes = (AssetEditorSubmissionViewerPermission,)

    def get_queryset(self):
        queryset = self.model.objects.filter(asset__uid=self.asset.uid)
        # Even though we only need 'uid', `select_related('asset__uid')`
        # actually pulled in the entire `kpi_asset` table under Django 1.8. In
        # Django 1.9, "select_related() prohibits non-relational fields for
        # nested relations."
        queryset = queryset.select_related('asset')
        return queryset

    def perform_create(self, serializer):
        serializer.save(asset=self.asset)

    @action(detail=True, methods=["PATCH"])
    def retry(self, request, uid=None, *args, **kwargs):
        hook = self.get_object()
        response = {"detail": _("Task successfully scheduled")}
        status_code = status.HTTP_200_OK
        if hook.active:
            seconds = HookLog.get_elapsed_seconds(constance.config.HOOK_MAX_RETRIES)
            threshold = timezone.now() - timedelta(seconds=seconds)

            records = hook.logs.filter(Q(date_modified__lte=threshold,
                                         status=HOOK_LOG_PENDING) |
                                       Q(status=HOOK_LOG_FAILED)). \
                values_list("id", "uid").distinct()
            # Prepare lists of ids
            hooklogs_ids = []
            hooklogs_uids = []
            for record in records:
                hooklogs_ids.append(record[0])
                hooklogs_uids.append(record[1])

            if len(records) > 0:
                # Mark all logs as PENDING
                HookLog.objects.filter(id__in=hooklogs_ids).update(status=HOOK_LOG_PENDING)
                # Delegate to Celery
                retry_all_task.delay(hooklogs_ids)
                response.update({
                    "pending_uids": hooklogs_uids
                })

            else:
                response["detail"] = _("No data to retry")
                status_code = status.HTTP_304_NOT_MODIFIED
        else:
            response["detail"] = _("Can not retry on disabled hooks")
            status_code = status.HTTP_400_BAD_REQUEST

        return Response(response, status=status_code)
