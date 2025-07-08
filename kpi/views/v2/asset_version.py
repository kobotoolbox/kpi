# coding: utf-8
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models import AssetVersion
from kpi.permissions import AssetVersionReadOnlyPermission
from kpi.serializers.v2.asset_version import (
    AssetVersionListSerializer,
    AssetVersionSerializer,
)
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


@extend_schema(
    tags=['Versions'],
)
@extend_schema_view(
    create=extend_schema(),
    destroy=extend_schema(),
    list=extend_schema(),
    update=extend_schema(
        exclude=True,
    ),
    retrieve=extend_schema(),
    partial_update=extend_schema(
        exclude=True,
    ),
)
class AssetVersionViewSet(AssetNestedObjectViewsetMixin,
                          NestedViewSetMixin, viewsets.ModelViewSet):
    """
    ## GET asset versions

    ### List
    Lists the versions of forms

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/versions/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/versions/

    ### Detailed
    Returns the details of an asset version

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/versions/<code>{version_uid}</code>/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/versions/v74yayoFtERWDeRHPaHVhZ/

    ### CURRENT ENDPOINT
    """

    model = AssetVersion
    lookup_field = 'uid'
    permission_classes = (AssetVersionReadOnlyPermission,)

    def get_serializer_class(self):
        if self.action == 'list':
            return AssetVersionListSerializer
        else:
            return AssetVersionSerializer

    def get_queryset(self):
        _deployed = self.request.query_params.get('deployed', None)
        _queryset = self.model.objects.filter(asset__uid=self.asset_uid)
        if _deployed is not None:
            _queryset = _queryset.filter(deployed=_deployed)
        if self.action == 'list':
            # Save time by only retrieving fields from the DB that the
            # serializer will use
            _queryset = _queryset.only(
                'uid', 'deployed', 'date_modified', 'asset_id')
        # `AssetVersionListSerializer.get_url()` asks for the asset UID
        _queryset = _queryset.select_related('asset')
        return _queryset
