# coding: utf-8
from django.contrib.auth.models import Permission
from rest_framework import viewsets

from kpi.models.asset import Asset
from kpi.serializers.v2.permission import PermissionSerializer


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    **Display all assignable permissions for `Asset`**

    The `implied` property of a given permission shows which additional
    permissions are automatically granted when assigning that particular
    permission.

    The `contradictory` property shows which permissions are removed when
    assigning that particular permission.


    <pre class="prettyprint">
    <b>GET</b> /api/v2/permissions/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/permissions/

    > Response
    >
    >        {
    >           "count": 9,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >               {
    >                   "url": "http://kpi/api/v2/permissions/change_submissions/",
    >                   "codename": "change_submissions",
    >                   "implied": [
    >                       "http://kpi/api/v2/permissions/view_asset/"
    >                   ],
    >                   "contradictory": [
    >                       "http://kpi/api/v2/permissions/partial_submissions/"
    >                   ],
    >                   "name": "Can modify submitted data for asset"
    >                },
    >                ...
    >               {
    >                   "url": "http://kpi/api/v2/permissions/add_submissions/",
    >                   "codename": "add_submissions",
    >                   "implied": [],
    >                   "contradictory": [],
    >                   "name": "Can submit data to asset"
    >                }
    >           ]
    >        }


    <pre class="prettyprint">
    <b>GET</b> /api/v2/permissions/{codename}
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/permissions/change_submissions


    > Response
    >
    >               {
    >                   "url": "http://kpi/api/v2/permissions/change_submissions/",
    >                   "codename": "change_submissions",
    >                   "implied": [
    >                       "http://kpi/api/v2/permissions/view_asset/"
    >                   ],
    >                   "contradictory": [
    >                       "http://kpi/api/v2/permissions/partial_submissions/"
    >                   ],
    >                   "name": "Can modify submitted data for asset"
    >                }


    ### CURRENT ENDPOINT
    """

    queryset = Permission.objects.all()
    model = Permission
    lookup_field = 'codename'
    serializer_class = PermissionSerializer

    def get_queryset(self, *args, **kwargs):
        queryset = super().get_queryset(*args, **kwargs)
        # Codenames are unique per content_type. So, we ensure we don't return
        # codenames for different app or content_type
        queryset = queryset.filter(
            content_type__app_label='kpi',
            content_type__model='asset',
            codename__in=Asset.ASSIGNABLE_PERMISSIONS,
        ).select_related('content_type')
        return queryset
