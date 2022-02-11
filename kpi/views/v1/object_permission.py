# coding: utf-8
from django.db import transaction
from rest_framework import exceptions

from kpi.filters import KpiAssignedObjectPermissionsFilter
from kpi.models import ObjectPermission
from kpi.serializers import ObjectPermissionSerializer
from kpi.views.no_update_model import NoUpdateModelViewSet


class ObjectPermissionViewSet(NoUpdateModelViewSet):
    queryset = ObjectPermission.objects.all()
    serializer_class = ObjectPermissionSerializer
    lookup_field = 'uid'
    filter_backends = (KpiAssignedObjectPermissionsFilter, )

    def perform_create(self, serializer):
        # Make sure the requesting user has the manage_ permission on
        # the affected object
        with transaction.atomic():
            affected_object = serializer.validated_data['content_object']
            codename = serializer.validated_data['permission'].codename
            if not affected_object.has_perm(
                self.request.user, PERM_MANAGE_ASSET
            ):
                raise exceptions.PermissionDenied()
            serializer.save()

    def perform_destroy(self, instance):
        # Only directly-applied permissions may be modified; forbid deleting
        # permissions inherited from ancestors
        if instance.inherited:
            raise exceptions.MethodNotAllowed(
                self.request.method,
                detail='Cannot delete inherited permissions.'
            )
        # Make sure the requesting user has the manage_ permission on
        # the affected object
        with transaction.atomic():
            affected_object = instance.content_object
            codename = instance.permission.codename
            if not affected_object.has_perm(
                self.request.user, PERM_MANAGE_ASSET
            ):
                raise exceptions.PermissionDenied()
            instance.content_object.remove_perm(
                instance.user,
                instance.permission.codename
            )
