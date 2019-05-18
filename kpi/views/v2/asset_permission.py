# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework import viewsets, status
from rest_framework.mixins import CreateModelMixin, RetrieveModelMixin, \
    DestroyModelMixin, ListModelMixin
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models.object_permission import ObjectPermission
from kpi.permissions import AssetNestedObjectPermission
from kpi.serializers.v2.asset_permission import AssetPermissionSerializer
from kpi.utils.object_permission_helper import ObjectPermissionHelper
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AssetPermissionViewSet(AssetNestedObjectViewsetMixin, NestedViewSetMixin,
                             CreateModelMixin, RetrieveModelMixin,
                             DestroyModelMixin, ListModelMixin,
                             viewsets.GenericViewSet):
    """
    TODO documentation
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

    def destroy(self, request, *args, **kwargs):
        # TODO block owner's permission
        object_permission = self.get_object()
        user = object_permission.user
        codename = object_permission.permission.codename
        self.asset.remove_perm(user, codename)
        return Response(status=status.HTTP_204_NO_CONTENT)
