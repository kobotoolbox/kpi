# coding: utf-8
from private_storage.views import PrivateStorageDetailView
from rest_framework import exceptions
from rest_framework.decorators import action
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.constants import PERM_CHANGE_ASSET, PERM_VIEW_ASSET
from kpi.filters import RelatedAssetPermissionsFilter
from kpi.models import AssetFile
from kpi.serializers.v2.asset_file import AssetFileSerializer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.views.no_update_model import NoUpdateModelViewSet


class AssetFileViewSet(AssetNestedObjectViewsetMixin, NestedViewSetMixin,
                       NoUpdateModelViewSet):

    """
    <span class='label label-danger'>TODO Documentation for this endpoint</span>

    ### CURRENT ENDPOINT
    """

    model = AssetFile
    lookup_field = 'uid'
    filter_backends = (RelatedAssetPermissionsFilter,)
    serializer_class = AssetFileSerializer

    def get_queryset(self):
        _queryset = self.model.objects.filter(asset__uid=self.asset_uid)
        return _queryset

    def perform_create(self, serializer):
        if not self.request.user.has_perm(PERM_CHANGE_ASSET, self.asset):
            raise exceptions.PermissionDenied()
        serializer.save(
            asset=self.asset,
            user=self.request.user
        )

    def perform_destroy(self, *args, **kwargs):
        if not self.request.user.has_perm(PERM_CHANGE_ASSET, self.asset):
            raise exceptions.PermissionDenied()
        return super().perform_destroy(*args, **kwargs)

    class PrivateContentView(PrivateStorageDetailView):
        model = AssetFile
        model_file_field = 'content'

        def can_access_file(self, private_file):
            return private_file.request.user.has_perm(
                PERM_VIEW_ASSET, private_file.parent_object.asset)

    @action(detail=True, methods=['get'])
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
