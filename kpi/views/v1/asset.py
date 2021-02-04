# coding: utf-8
from django.shortcuts import get_object_or_404
from rest_framework import exceptions, renderers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from kpi.constants import CLONE_ARG_NAME, PERM_MANAGE_ASSET, PERM_VIEW_ASSET
from kpi.models import Asset
from kpi.serializers.v1.asset import AssetSerializer, AssetListSerializer
from kpi.views.v2.asset import AssetViewSet as AssetViewSetV2


class AssetViewSet(AssetViewSetV2):
    """
    ## This document is for a deprecated version of kpi's API.

    **Please upgrade to latest release `/api/v2/assets/`**


    * Assign a asset to a collection <span class='label label-warning'>partially implemented</span>
    * Run a partial update of a asset <span class='label label-danger'>TODO</span>

    <span class='label label-danger'>TODO</span> Complete documentation

    ## List of asset endpoints

    Lists the asset endpoints accessible to requesting user, for anonymous access
    a list of public data endpoints is returned.

    <pre class="prettyprint">
    <b>GET</b> /assets/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/

    Get a hash of all `version_id`s of assets.
    Useful to detect any changes in assets with only one call to `API`

    <pre class="prettyprint">
    <b>GET</b> /assets/hash/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/hash/

    ## CRUD

    * `uid` - is the unique identifier of a specific asset

    Retrieves current asset
    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{uid}</code>/
    </pre>


    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/

    Creates or clones an asset.
    <pre class="prettyprint">
    <b>POST</b> /assets/
    </pre>


    > Example
    >
    >       curl -X POST https://[kpi-url]/assets/


    > **Payload to create a new asset**
    >
    >        {
    >           "name": {string},
    >           "settings": {
    >               "description": {string},
    >               "sector": {string},
    >               "country": {string},
    >               "share-metadata": {boolean}
    >           },
    >           "asset_type": {string}
    >        }

    > **Payload to clone an asset**
    >
    >       {
    >           "clone_from": {string},
    >           "name": {string},
    >           "asset_type": {string}
    >       }

    where `asset_type` must be one of these values:

    * block (can be cloned to `block`, `question`, `survey`, `template`)
    * question (can be cloned to `question`, `survey`, `template`)
    * survey (can be cloned to `block`, `question`, `survey`, `template`)
    * template (can be cloned to `survey`, `template`)

    Settings are cloned only when type of assets are `survey` or `template`.
    In that case, `share-metadata` is not preserved.

    When creating a new `block` or `question` asset, settings are not saved either.

    ### Deployment

    Retrieves the existing deployment, if any.
    <pre class="prettyprint">
    <b>GET</b> /assets/{uid}/deployment
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/deployment

    Creates a new deployment, but only if a deployment does not exist already.
    <pre class="prettyprint">
    <b>POST</b> /assets/{uid}/deployment
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/deployment

    Updates the `active` field of the existing deployment.
    <pre class="prettyprint">
    <b>PATCH</b> /assets/{uid}/deployment
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/deployment

    Overwrites the entire deployment, including the form contents, but does not change the deployment's identifier
    <pre class="prettyprint">
    <b>PUT</b> /assets/{uid}/deployment
    </pre>

    > Example
    >
    >       curl -X PUT https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/deployment


    ### Permissions
    Updates permissions of the specific asset
    <pre class="prettyprint">
    <b>PATCH</b> /assets/{uid}/permissions
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/permissions

    ### CURRENT ENDPOINT
    """

    def get_serializer_class(self):
        if self.action == 'list':
            return AssetListSerializer
        else:
            return AssetSerializer

    def get_serializer_context(self):
        return super(AssetViewSetV2, self).get_serializer_context()

    @action(
        detail=True,
        methods=["PATCH"],
        renderer_classes=[renderers.JSONRenderer],
    )
    def permissions(self, request, uid):
        target_asset = self.get_object()
        source_asset = get_object_or_404(
            Asset, uid=request.data.get(CLONE_ARG_NAME)
        )
        user = request.user
        response = {}
        http_status = status.HTTP_204_NO_CONTENT

        if user.has_perm(PERM_MANAGE_ASSET, target_asset) and user.has_perm(
            PERM_VIEW_ASSET, source_asset
        ):
            if not target_asset.copy_permissions_from(source_asset):
                http_status = status.HTTP_400_BAD_REQUEST
                response = {
                    "detail": "Source and destination objects don't seem to have the same type"
                }
        else:
            raise exceptions.PermissionDenied()

        return Response(response, status=http_status)
