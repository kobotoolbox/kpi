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

from kpi.constants import CLONE_ARG_NAME, PERM_SHARE_COLLECTION, \
    PERM_VIEW_COLLECTION
from kpi.models.collection import Collection
from kpi.models.object_permission import ObjectPermission
from kpi.permissions import CollectionNestedObjectPermission
from kpi.serializers.v2.collection_permission_assignment import CollectionPermissionAssignmentSerializer, \
    CollectionBulkInsertPermissionSerializer
from kpi.utils.object_permission_helper import ObjectPermissionHelper
from kpi.utils.viewset_mixins import CollectionNestedObjectViewsetMixin


class CollectionPermissionAssignmentViewSet(CollectionNestedObjectViewsetMixin,
                                           NestedViewSetMixin,
                                           CreateModelMixin, RetrieveModelMixin,
                                           DestroyModelMixin, ListModelMixin,
                                           viewsets.GenericViewSet):
    
    # TODO Refactor AssetPermissionAssignmentViewSet & CollectionPermissionAssignmentViewSet tox
    # use same core.

    """
    ## Permission assignments of an collection

    This endpoint shows assignments on an collection. An assignment implies:

    - a `Permission` object
    - a `User` object

    **Roles' permissions:**

    - Owner sees all permissions
    - Editors see all permissions
    - Viewers see owner's permissions and their permissions
    - Anonymous users see only owner's permissions


    `uid` - is the unique identifier of a specific collection

    **Retrieve assignments**
    <pre class="prettyprint">
    <b>GET</b> /api/v2/collections/<code>{uid}</code>/permissions/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/collections/cSAvYreNzVEkrWg5Gdcvg/permissions/


    **Assign a permission**
    <pre class="prettyprint">
    <b>POST</b> /api/v2/collections/<code>{uid}</code>/permissions/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/collections/cSAvYreNzVEkrWg5Gdcvg/permissions/ \\
    >            -H 'Content-Type: application/json' \\
    >            -d '<payload>'  # Payload is sent as the string


    > _Payload to assign a permission_
    >
    >        {
    >           "user": "https://[kpi]/api/v2/users/{username}/",
    >           "permission": "https://[kpi]/api/v2/permissions/{codename}/",
    >        }

    N.B.:

    - Implied permissions will be also assigned. (e.g. `change_collection` will add `view_collection` too)



    **Remove a permission**

    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/collections/<code>{uid}</code>/permissions/{permission_uid}/
    </pre>

    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/collections/cSAvYreNzVEkrWg5Gdcvg/permissions/pG6AeSjCwNtpWazQAX76Ap/


    **Assign all permissions at once**

    <span class='label label-danger'>All permissions will erased (except the owner's) before new assignments</span>
    <pre class="prettyprint">
    <b>POST</b> /api/v2/collections/<code>{uid}</code>/permissions/bulk/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/collections/cSAvYreNzVEkrWg5Gdcvg/permissions/bulk/

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


    **Clone permissions from another collection**

    <span class='label label-danger'>All permissions will erased (except the owner's) before new assignments</span>
    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/collections/<code>{uid}</code>/permissions/clone/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/collections/cSAvYreNzVEkrWg5Gdcvg/permissions/clone/

    > _Payload to clone permissions from another collection_
    >
    >        {
    >           "clone_from": "{source_collection_uid}"
    >        }

    ### CURRENT ENDPOINT
    """

    model = ObjectPermission
    lookup_field = "uid"
    serializer_class = CollectionPermissionAssignmentSerializer
    permission_classes = (CollectionNestedObjectPermission,)
    pagination_class = None

    @action(detail=False, methods=['POST'],
            renderer_classes=[renderers.JSONRenderer], url_path='bulk')
    def bulk_assignments(self, request, *args, **kwargs):
        """
        Assigns all permissions at once for the same collection.

        :param request:
        :return: JSON
        """

        assignments = request.data

        # We don't want to lock tables, only queries to rollback in case
        # one assignment fails.
        with transaction.atomic():

            # First delete all assignments before assigning new ones.
            # If something fails later, this query should rollback
            self.collection.permissions.exclude(
                user__username=self.collection.owner.username).delete()

            for assignment in assignments:
                context_ = dict(self.get_serializer_context())
                serializer = CollectionBulkInsertPermissionSerializer(
                    data=assignment,
                    context=context_
                )
                serializer.is_valid(raise_exception=True)
                serializer.save(collection=self.collection)

            # returns collection permissions. Users who can change permissions can
            # see all permissions.
            return self.list(request, *args, **kwargs)

    @action(detail=False, methods=['PATCH'],
            renderer_classes=[renderers.JSONRenderer])
    def clone(self, request, *args, **kwargs):

        source_collection_uid = self.request.data[CLONE_ARG_NAME]
        source_collection = get_object_or_404(Collection, uid=source_collection_uid)
        user = request.user

        if user.has_perm(PERM_SHARE_COLLECTION, self.collection) and \
                user.has_perm(PERM_VIEW_COLLECTION, source_collection):
            if not self.collection.copy_permissions_from(source_collection):
                http_status = status.HTTP_400_BAD_REQUEST
                response = {'detail': _("Source and destination objects don't "
                                        "seem to have the same type")}
                return Response(response, status=http_status)
        else:
            raise exceptions.PermissionDenied()

        # returns collection permissions. Users who can change permissions can
        # see all permissions.
        return self.list(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        object_permission = self.get_object()
        user = object_permission.user
        if user.pk == self.collection.owner_id:
            return Response({
                'detail': _("Owner's permissions cannot be deleted")
            }, status=status.HTTP_409_CONFLICT)

        codename = object_permission.permission.codename
        self.collection.remove_perm(user, codename)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get_serializer_context(self):
        """
        Extra context provided to the serializer class.
        Inject collection_uid to avoid extra queries to DB inside the serializer.
        """
        context_ = super().get_serializer_context()
        context_.update({
            'collection_uid': self.collection.uid
        })
        return context_

    def get_queryset(self):
        return ObjectPermissionHelper. \
            get_user_permission_assignments_queryset(self.collection,
                                                     self.request.user)

    def perform_create(self, serializer):
        serializer.save(collection=self.collection)
