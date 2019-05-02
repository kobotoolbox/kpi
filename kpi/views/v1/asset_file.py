# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

from private_storage.views import PrivateStorageDetailView
from rest_framework import exceptions
from rest_framework.decorators import detail_route
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.constants import PERM_CHANGE_ASSET, PERM_VIEW_ASSET
from kpi.filters import RelatedAssetPermissionsFilter
from kpi.models import Asset, AssetFile
from kpi.serializers import AssetFileSerializer

from .no_update_model import NoUpdateModelViewSet


class AssetFileViewSet(NestedViewSetMixin, NoUpdateModelViewSet):
    model = AssetFile
    lookup_field = 'uid'
    filter_backends = (RelatedAssetPermissionsFilter,)
    serializer_class = AssetFileSerializer

    def get_queryset(self):
        _asset_uid = self.get_parents_query_dict()['asset']
        _queryset = self.model.objects.filter(asset__uid=_asset_uid)
        return _queryset

    def perform_create(self, serializer):
        asset = Asset.objects.get(uid=self.get_parents_query_dict()['asset'])
        if not self.request.user.has_perm(PERM_CHANGE_ASSET, asset):
            raise exceptions.PermissionDenied()
        serializer.save(
            asset=asset,
            user=self.request.user
        )

    def perform_destroy(self, *args, **kwargs):
        asset = Asset.objects.get(uid=self.get_parents_query_dict()['asset'])
        if not self.request.user.has_perm(PERM_CHANGE_ASSET, asset):
            raise exceptions.PermissionDenied()
        return super(AssetFileViewSet, self).perform_destroy(*args, **kwargs)

    class PrivateContentView(PrivateStorageDetailView):
        model = AssetFile
        model_file_field = 'content'

        def can_access_file(self, private_file):
            return private_file.request.user.has_perm(
                PERM_VIEW_ASSET, private_file.parent_object.asset)

    @detail_route(methods=['get'])
    def content(self, *args, **kwargs):
        view = self.PrivateContentView.as_view(
            model=AssetFile,
            slug_url_kwarg='uid',
            slug_field='uid',
            model_file_field='content'
        )
        af = self.get_object()
        # TODO: simply redirect if external storage with expiring tokens (e.g.
        # Amazon S3) is used?
        #   return HttpResponseRedirect(af.content.url)
        return view(self.request, uid=af.uid)
