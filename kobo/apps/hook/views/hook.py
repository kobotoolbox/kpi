# -*- coding: utf-8 -*-
from __future__ import absolute_import

from datetime import datetime
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework_extensions.mixins import NestedViewSetMixin

from ..models.hook import Hook
from ..serializers.hook import HookSerializer
from kpi.models import Asset
from kpi.views import AssetOwnerFilterBackend


class HookViewSet(NestedViewSetMixin, viewsets.ModelViewSet):
    """

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
    >           "export_type": {string},
    >           "security_level": {string},
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

    * `security_level` must be one these values:

        1. `no_auth` (_default_)
        2. `basic_auth`

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

    ### CURRENT ENDPOINT
    """
    model = Hook
    lookup_field = "uid"
    filter_backends = (
        AssetOwnerFilterBackend,
    )
    serializer_class = HookSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        asset_uid = self.get_parents_query_dict().get("asset")
        queryset = self.model.objects.filter(asset__uid=asset_uid)
        queryset = queryset.select_related("asset__uid")
        return queryset

    def list(self, request, *args, **kwargs):
        # Because object permissions is done on hook only,
        # we need to check whether the user is the owner of the user to return a 404 when it's not.
        # We prefer to return 404 instead of 403 to avoid to expose existence of the Asset/Hook
        # to unauthorized user
        asset_uid = self.get_parents_query_dict().get("asset")
        asset = get_object_or_404(Asset, uid=asset_uid, owner=request.user)
        return super(HookViewSet, self).list(request, *args, **kwargs)

    def perform_create(self, serializer):
        asset_uid = self.get_parents_query_dict().get("asset")
        asset = get_object_or_404(Asset, uid=asset_uid)
        serializer.save(asset=asset)

