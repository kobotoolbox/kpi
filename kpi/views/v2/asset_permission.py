# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework import viewsets, status
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models.object_permission import ObjectPermission
from kpi.permissions import AssetNestedObjectPermission
from kpi.serializers.v2.asset_permission import AssetPermissionSerializer
from kpi.utils.viewset_mixin import AssetNestedObjectViewsetMixin
from kpi.utils.object_permission_helper import ObjectPermissionHelper


class AssetPermissionViewSet(AssetNestedObjectViewsetMixin, NestedViewSetMixin,
                             viewsets.ModelViewSet):
    """

    ### CURRENT ENDPOINT
    """

    model = ObjectPermission
    lookup_field = "uid"
    serializer_class = AssetPermissionSerializer
    permission_classes = (AssetNestedObjectPermission,)

    def get_serializer_context(self):
        """
        Extra context provided to the serializer class.
        Inject asset_uid to avoid extra queries to DB inside the serializer.
        @TODO Check if there is a better way to do it?
        """
        return {
            'request': self.request,
            'format': self.format_kwarg,
            'view': self,
            'asset_uid': self.asset.uid
        }

    def get_queryset(self):
        return ObjectPermissionHelper.get_assignments_queryset(self.asset,
                                                               self.request.user)

    def list(self, request, *args, **kwargs):
        return super(AssetPermissionViewSet, self).list(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(asset=self.asset)

    #def perform_create(self, serializer):
    #    # Make sure the requesting user has the share_ permission on
    #    # the affected object
    #    codename = serializer.validated_data['permission'].codename
    #    if not self._requesting_user_can_share(affected_object, codename):
    #        raise exceptions.PermissionDenied()
    #    serializer.save()
