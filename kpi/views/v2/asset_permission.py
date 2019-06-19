# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework import viewsets, status, renderers
from rest_framework.decorators import list_route
from rest_framework.mixins import CreateModelMixin, RetrieveModelMixin, \
    DestroyModelMixin, ListModelMixin
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models.object_permission import ObjectPermission
from kpi.permissions import AssetNestedObjectPermission
from kpi.serializers.v2.asset_permission import AssetPermissionSerializer, \
    AssetBulkInsertPermissionSerializer
from kpi.utils.object_permission_helper import ObjectPermissionHelper
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AssetPermissionViewSet(AssetNestedObjectViewsetMixin, NestedViewSetMixin,
                             CreateModelMixin, RetrieveModelMixin,
                             DestroyModelMixin, ListModelMixin,
                             viewsets.GenericViewSet):
    """
    ## Permissions of an asset

    This endpoint shows assignments on an asset. An assignment implies:

    - a `Permission` object
    - a `User` object

    **Roles' permissions:**

    - Owner sees all permissions
    - Editors see all permissions
    - Viewers see owner's permissions and their permissions
    - Anonymous users see only owner's permissions


    `uid` - is the unique identifier of a specific asset

    **Retrieve assignments**
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/permissions/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/assets/aSAvYreNzVEkrWg5Gdcvg/permissions/


    **Assign a permission**
    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{uid}</code>/permissions/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/permissions/ \\
    >            -H 'Content-Type: application/json' \\
    >            -d '<payload>'  # Payload is sent as the string


    > _Payload to assign a permission_
    >
    >        {
    >           "user": "https://[kpi]/api/v2/users/{username}/",
    >           "permission": "https://[kpi]/api/v2/permissions/{codename}/",
    >        }

    > _Payload to assign partial permissions_
    >
    >        {
    >           "user": "https://[kpi]/api/v2/users/{username}/",
    >           "permission": "https://[kpi]/api/v2/permissions/{partial_permission_codename}/",
    >           "partial_permissions": [
    >               {
    >                   "url": "https://[kpi]/api/v2/permissions/{codename}/",
    >                   "filters": [
    >                       {"_submitted_by": {"$in": ["{username}", "{username}"]}}
    >                   ]
    >              },
    >           ]
    >        }

    N.B.:

    - Only submissions support partial (`view`) permissions so far.
    - Filters use Mongo Query Engine to narrow down results.
    - Implied permissions will be also assigned. (e.g. `change_asset` will add `view_asset` too)



    **Remove a permission**
    <span class='label label-info'>TODO - Block owner deletion</span>
    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/assets/<code>{uid}</code>/permissions/{permission_uid}/
    </pre>

    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/permissions/pG6AeSjCwNtpWazQAX76Ap/


    **Assign all permissions at once**

    <span class='label label-danger'>All permissions will erased (except the owner's) before new assignments</span>
    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{uid}</code>/permissions/bulk/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/permissions/bulk/

    > _Payload to assign all permissions at once_
    >
    >        [{
    >           "user": "https://[kpi]/api/v2/users/{username}/",
    >           "permission": "https://[kpi]/api/v2/permissions/{codename}/",
    >        },
    >        {
    >           "user": "https://[kpi]/api/v2/users/{username}/",
    >           "permission": "https://[kpi]/api/v2/permissions/{codename}/",
    >        },...]

    ### CURRENT ENDPOINT
    """

    model = ObjectPermission
    lookup_field = "uid"
    serializer_class = AssetPermissionSerializer
    permission_classes = (AssetNestedObjectPermission,)

    @list_route(methods=['POST'], renderer_classes=[renderers.JSONRenderer],
                url_path='bulk')
    def bulk_assignments(self, request, *args, **kwargs):
        """
        Assigns all permissions at once for the same asset.

        :param request:
        :return: JSON
        """

        assignments = request.data

        # First delete all assignments before assigning new ones.
        # If something fails later, this query should rollback
        self.asset.permissions.exclude(user__username=self.asset.owner.username).delete()

        for assignment in assignments:
            context_ = dict(self.get_serializer_context())
            if 'partial_permissions' in assignment:
                context_.update({'partial_permissions': assignment['partial_permissions']})
            serializer = AssetBulkInsertPermissionSerializer(
                data=assignment,
                context=context_
            )
            serializer.is_valid(raise_exception=True)
            serializer.save(asset=self.asset)

        # returns asset permissions. Users who can change permissions can
        # see all permissions.
        return self.list(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        # TODO block owner's permission
        object_permission = self.get_object()
        user = object_permission.user
        codename = object_permission.permission.codename
        self.asset.remove_perm(user, codename)
        return Response(status=status.HTTP_204_NO_CONTENT)

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
