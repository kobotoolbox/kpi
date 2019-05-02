# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

from django.db import transaction
from rest_framework import exceptions

from kpi.constants import PERM_SHARE_SUBMISSIONS
from kpi.filters import KpiAssignedObjectPermissionsFilter
from kpi.models import ObjectPermission
from kpi.serializers import ObjectPermissionSerializer
from .no_update_model import NoUpdateModelViewSet


class ObjectPermissionViewSet(NoUpdateModelViewSet):
    queryset = ObjectPermission.objects.all()
    serializer_class = ObjectPermissionSerializer
    lookup_field = 'uid'
    filter_backends = (KpiAssignedObjectPermissionsFilter, )

    def _requesting_user_can_share(self, affected_object, codename):
        r"""
            Return `True` if `self.request.user` is allowed to grant and revoke
            `codename` on `affected_object`. For `Collection`, this is always
            the same as checking that `self.request.user` has the
            `share_collection` permission on `affected_object`. For `Asset`,
            the result is determined by either `share_asset` or
            `share_submissions`, depending on the `codename`.
            :type affected_object: :py:class:Asset or :py:class:Collection
            :type codename: str
            :rtype bool
        """
        model_name = affected_object._meta.model_name
        if model_name == 'asset' and codename.endswith('_submissions'):
            share_permission = PERM_SHARE_SUBMISSIONS
        else:
            share_permission = 'share_{}'.format(model_name)
        return affected_object.has_perm(self.request.user, share_permission)

    def perform_create(self, serializer):
        # Make sure the requesting user has the share_ permission on
        # the affected object
        with transaction.atomic():
            affected_object = serializer.validated_data['content_object']
            codename = serializer.validated_data['permission'].codename
            if not self._requesting_user_can_share(affected_object, codename):
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
        # Make sure the requesting user has the share_ permission on
        # the affected object
        with transaction.atomic():
            affected_object = instance.content_object
            codename = instance.permission.codename
            if not self._requesting_user_can_share(affected_object, codename):
                raise exceptions.PermissionDenied()
            instance.content_object.remove_perm(
                instance.user,
                instance.permission.codename
            )
