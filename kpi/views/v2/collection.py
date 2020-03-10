# coding: utf-8
from django.forms import model_to_dict
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, exceptions
from rest_framework.response import Response

from kpi.filters import KpiObjectPermissionsFilter, SearchFilter
from kpi.models import Collection
from kpi.model_utils import disable_auto_field_update
from kpi.permissions import IsOwnerOrReadOnly, get_perm_name
from kpi.serializers.v2.collection import CollectionSerializer, CollectionListSerializer
from kpi.constants import CLONE_ARG_NAME, COLLECTION_CLONE_FIELDS


class CollectionViewSet(viewsets.ModelViewSet):

    """
    <span class='label label-danger'>TODO Documentation for this endpoint</span>

    ### CURRENT ENDPOINT
    """
    # Filtering handled by KpiObjectPermissionsFilter.filter_queryset()
    queryset = Collection.objects.select_related(
        'owner', 'parent'
    ).prefetch_related(
        'permissions',
        'permissions__permission',
        'permissions__user',
        'permissions__content_object',
        'usercollectionsubscription_set',
    ).all().order_by('-date_modified')
    permission_classes = (IsOwnerOrReadOnly,)
    filter_backends = (KpiObjectPermissionsFilter, SearchFilter)
    lookup_field = 'uid'

    def _clone(self):
        # Clone an existing collection.
        original_uid = self.request.data[CLONE_ARG_NAME]
        original_collection = get_object_or_404(Collection, uid=original_uid)
        view_perm = get_perm_name('view', original_collection)
        if not self.request.user.has_perm(view_perm, original_collection):
            raise Http404
        else:
            # Copy the essential data from the original collection.
            original_data = model_to_dict(original_collection)
            cloned_data = {keep_field: original_data[keep_field]
                          for keep_field in COLLECTION_CLONE_FIELDS}
            if original_collection.tag_string:
                cloned_data['tag_string']= original_collection.tag_string

            # Pull any additionally provided parameters/overrides from the
            # request.
            for param in self.request.data:
                cloned_data[param] = self.request.data[param]
            serializer = self.get_serializer(data=cloned_data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)

            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED,
                            headers=headers)

    def create(self, request, *args, **kwargs):
        if CLONE_ARG_NAME not in request.data:
            return super().create(request, *args, **kwargs)
        else:
            return self._clone()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer, *args, **kwargs):
        """ Only the owner is allowed to change `discoverable_when_public` """
        original_collection = self.get_object()
        if (self.request.user != original_collection.owner and
                'discoverable_when_public' in serializer.validated_data and
                (serializer.validated_data['discoverable_when_public'] !=
                    original_collection.discoverable_when_public)):
            raise exceptions.PermissionDenied()

        # Some fields shouldn't affect the modification date
        FIELDS_NOT_AFFECTING_MODIFICATION_DATE = {'discoverable_when_public'}
        changed_fields = set()
        for k, v in serializer.validated_data.items():
            if getattr(original_collection, k) != v:
                changed_fields.add(k)
        if changed_fields.issubset(FIELDS_NOT_AFFECTING_MODIFICATION_DATE):
            with disable_auto_field_update(Collection, 'date_modified'):
                return super().perform_update(
                    serializer, *args, **kwargs)

        return super().perform_update(serializer, *args, **kwargs)

    def get_serializer_class(self):
        if self.action == 'list':
            return CollectionListSerializer
        else:
            return CollectionSerializer
