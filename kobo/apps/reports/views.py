# coding: utf-8
from django.http import Http404
from rest_framework import viewsets, mixins

from kpi.constants import (
    ASSET_TYPE_SURVEY,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models import Asset
from kpi.utils.object_permission import (
    get_anonymous_user,
    get_objects_for_user,
)
from .serializers import ReportsListSerializer, ReportsDetailSerializer


class ReportsViewSet(mixins.ListModelMixin,
                     mixins.RetrieveModelMixin,
                     viewsets.GenericViewSet):
    """
        ## This document is for a deprecated version of kpi's Report Endpoint.

        **Please upgrade to the newest API version `/api/v2/assets/{asset_uid}/reports**
        **This endpoint may be removed in a future release**
    """

    lookup_field = 'uid'
    # Requesting user must have *any* of these permissions
    required_permissions = [
        PERM_VIEW_SUBMISSIONS,
        PERM_PARTIAL_SUBMISSIONS,
    ]

    def get_serializer_class(self):
        if self.action == 'list':
            return ReportsListSerializer
        else:
            return ReportsDetailSerializer

    def get_object(self):
        """
        Raise a 404 if the user is not allowed to access this asset or the
        asset is not deployed
        """
        asset = super().get_object()  # uses result of `get_queryset()`
        if not asset.has_deployment:
            raise Http404
        for codename in self.required_permissions:
            # `has_perm()` handles anonymous users
            if asset.has_perm(self.request.user, codename):
                # Having any of the `required_permissions` suffices
                return asset
        raise Http404

    def get_queryset(self):
        queryset = Asset.objects.filter(asset_type=ASSET_TYPE_SURVEY)
        if self.action == 'retrieve':
            # `get_object()` will do the checking; no need to manipulate the
            # queryset further
            return queryset.defer('content')

        # `ReportsListSerializer` needs only the UID; don't bother retrieving
        # anything else from the database
        queryset = queryset.only('uid')

        # Reduce the number of asset versions we have to consider by filtering
        # for accessible assets first
        owned_and_explicitly_shared = get_objects_for_user(
            self.request.user,
            self.required_permissions,
            queryset,
            all_perms_required=False,
        )
        subscribed_and_public = get_objects_for_user(
            get_anonymous_user(),
            self.required_permissions,
            queryset.filter(
                parent__userassetsubscription__user=self.request.user
            ),
            all_perms_required=False,
        )

        # Find which of these are deployed, using a custom manager method
        deployed_assets = (
            owned_and_explicitly_shared | subscribed_and_public
        ) & Asset.objects.deployed().distinct()

        return deployed_assets
