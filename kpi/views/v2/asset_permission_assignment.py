# coding: utf-8
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.translation import ugettext as _
from rest_framework import exceptions, viewsets, status, renderers
from rest_framework.decorators import action
from rest_framework.mixins import CreateModelMixin, RetrieveModelMixin, \
    DestroyModelMixin, ListModelMixin
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.constants import (
    CLONE_ARG_NAME,
    PERM_MANAGE_ASSET,
    PERM_VIEW_ASSET,
)
from kpi.deployment_backends.kc_access.utils import \
    remove_applicable_kc_permissions
from kpi.models.asset import Asset
from kpi.models.object_permission import ObjectPermission
from kpi.permissions import AssetNestedObjectPermission
from kpi.serializers.v2.asset_permission_assignment import (
    AssetBulkInsertPermissionSerializer,
    AssetPermissionAssignmentSerializer,
)
from kpi.utils.object_permission_helper import ObjectPermissionHelper
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AssetPermissionAssignmentViewSet(AssetNestedObjectViewsetMixin,
                                       NestedViewSetMixin,
                                       CreateModelMixin, RetrieveModelMixin,
                                       DestroyModelMixin, ListModelMixin,
                                       viewsets.GenericViewSet):
    """
    ## Permission assignments of an asset

    This endpoint shows assignments on an asset. An assignment implies:

    - a `Permission` object
    - a `User` object

    **Roles' permissions:**

    - Owner sees all permissions
    - Viewers see owner's permissions and their permissions
    - Anonymous users see only owner's permissions


    `uid` - is the unique identifier of a specific asset

    **Retrieve assignments**
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/permission-assignments/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/assets/aSAvYreNzVEkrWg5Gdcvg/permission-assignments/


    **Assign a permission**
    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{uid}</code>/permission-assignments/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/permission-assignments/ \\
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



    **Remove a permission assignment**

    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/assets/<code>{uid}</code>/permission-assignments/{permission_uid}/
    </pre>

    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/permission-assignments/pG6AeSjCwNtpWazQAX76Ap/


    **Assign all permissions at once**

    <span class='label label-danger'>All permissions will erased (except the owner's) before new assignments</span>
    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{uid}</code>/permission-assignments/bulk/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/permission-assignments/bulk/

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


    **Clone permissions from another asset**

    <span class='label label-danger'>All permissions will erased (except the owner's) before new assignments</span>
    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/assets/<code>{uid}</code>/permission-assignments/clone/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/permission-assignments/clone/

    > _Payload to clone permissions from another asset_
    >
    >        {
    >           "clone_from": "{source_asset_uid}"
    >        }

    ### CURRENT ENDPOINT
    """

    model = ObjectPermission
    lookup_field = "uid"
    serializer_class = AssetPermissionAssignmentSerializer
    permission_classes = (AssetNestedObjectPermission,)
    pagination_class = None
    # filter_backends = Just kidding! Look at this instead:
    #     kpi.utils.object_permission_helper.ObjectPermissionHelper.get_user_permission_assignments_queryset

    @action(detail=False, methods=['POST'], renderer_classes=[renderers.JSONRenderer],
            url_path='bulk')
    def bulk_assignments(self, request, *args, **kwargs):
        """
        Assigns all permissions at once for the same asset.

        :param request:
        :return: JSON
        """

        assignments = request.data

        # We don't want to lock tables, only queries to rollback in case
        # one assignment fails.
        with transaction.atomic():

            # First, delete *all* `from_kc_only` flags
            # TODO: Remove after kobotoolbox/kobocat#642
            if self.asset.has_deployment:
                self.asset.deployment.remove_from_kc_only_flag()

            # Then delete all assignments before assigning new ones.
            # If something fails later, this query should rollback
            perms_to_delete = self.asset.permissions.exclude(
                user__username=self.asset.owner.username)
            for perm in perms_to_delete.all():
                self.asset.remove_perm(perm.user,
                                       perm.permission.codename)

            for assignment in assignments:
                context_ = dict(self.get_serializer_context())
                context_['bulk'] = True
                if 'partial_permissions' in assignment:
                    context_['partial_permissions'] = assignment['partial_permissions']

                serializer = AssetBulkInsertPermissionSerializer(
                    data=assignment,
                    context=context_
                )
                serializer.is_valid(raise_exception=True)
                serializer.save(asset=self.asset)

            # returns asset permissions. Users who can change permissions can
            # see all permissions.
            return self.list(request, *args, **kwargs)

    @action(detail=False, methods=['PATCH'],
            renderer_classes=[renderers.JSONRenderer])
    def clone(self, request, *args, **kwargs):

        source_asset_uid = self.request.data[CLONE_ARG_NAME]
        source_asset = get_object_or_404(Asset, uid=source_asset_uid)
        user = request.user

        if user.has_perm(PERM_MANAGE_ASSET, self.asset) and \
                user.has_perm(PERM_VIEW_ASSET, source_asset):
            if not self.asset.copy_permissions_from(source_asset):
                http_status = status.HTTP_400_BAD_REQUEST
                response = {'detail': _("Source and destination objects don't "
                                        "seem to have the same type")}
                return Response(response, status=http_status)
        else:
            raise exceptions.PermissionDenied()

        # returns asset permissions. Users who can change permissions can
        # see all permissions.
        return self.list(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        object_permission = self.get_object()
        user = object_permission.user
        # If the user is not the owner of the asset, but trying to delete the
        # owner's permissions, raise permission denied error. However, if they
        # are the owner of the asset, they should also be prevented from
        # deleting their own permissions, but given a more appropriate
        # response. Only those with `manage_asset` permissions can delete all
        # permissions from other non-owners with whom the form is shared.
        if (
            not request.user.has_perm(PERM_MANAGE_ASSET, self.asset)
            and (request.user.pk != self.asset.owner_id)
            and (request.user.pk != user.pk)
        ):
            raise exceptions.PermissionDenied()
        elif user.pk == self.asset.owner_id:
            return Response({
                'detail': _("Owner's permissions cannot be deleted")
            }, status=status.HTTP_409_CONFLICT)

        codename = object_permission.permission.codename
        self.asset.remove_perm(user, codename)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get_serializer_context(self):
        """
        Extra context provided to the serializer class.
        Inject asset_uid to avoid extra queries to DB inside the serializer.
        """

        context_ = super().get_serializer_context()
        context_.update({
            'asset_uid': self.asset.uid
        })
        return context_

    def get_queryset(self):
        return ObjectPermissionHelper. \
            get_user_permission_assignments_queryset(self.asset,
                                                     self.request.user)

    def perform_create(self, serializer):
        serializer.save(asset=self.asset)
