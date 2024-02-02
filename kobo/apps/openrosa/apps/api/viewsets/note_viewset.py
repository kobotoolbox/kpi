# coding: utf-8
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response

from kobo.apps.openrosa.apps.api.permissions import NoteObjectPermissions
from kobo.apps.openrosa.apps.logger.models import Note, XForm
from kobo.apps.openrosa.libs.constants import CAN_VIEW_XFORM
from kobo.apps.openrosa.libs.serializers.note_serializer import NoteSerializer
from kobo.apps.openrosa.libs.utils.guardian import (
    assign_perm,
    get_objects_for_user,
)
from ..utils.rest_framework.viewsets import OpenRosaModelViewSet


class NoteViewSet(OpenRosaModelViewSet):
    """
    ## Add Notes to a submission

    A `POST` payload of parameters:

        `note` - the note string to add to a data point
        `instance` - the data point id

     <pre class="prettyprint">
      <b>POST</b> /api/v1/notes</pre>

    Payload

        {"instance": 1, "note": "This is a note."}

      > Response
      >
      >     {
      >          "id": 1,
      >          "instance": 1,
      >          "note": "This is a note."
      >          ...
      >     }
      >
      >     HTTP 201 OK

    # Get List of notes for a data point

    A `GET` request will return the list of notes applied to a data point.

     <pre class="prettyprint">
      <b>GET</b> /api/v1/notes</pre>


      > Response
      >
      >     [{
      >          "id": 1,
      >          "instance": 1,
      >          "note": "This is a note."
      >          ...
      >     }, ...]
      >
      >
      >        HTTP 200 OK
    """
    serializer_class = NoteSerializer
    permission_classes = [NoteObjectPermissions]

    def get_queryset(self):
        viewable_xforms = get_objects_for_user(self.request.user,
                                               CAN_VIEW_XFORM,
                                               XForm,
                                               accept_global_perms=False)
        viewable_notes = Note.objects.filter(
            Q(instance__xform__in=viewable_xforms) | Q(instance__xform__shared_data=True)
        )
        return viewable_notes

    # This used to be post_save. Part of it is here, permissions validation
    # has been moved to the note serializer
    def perform_create(self, serializer):
        obj = serializer.save(user=self.request.user)
        assign_perm('add_note', self.request.user, obj)
        assign_perm('change_note', self.request.user, obj)
        assign_perm('delete_note', self.request.user, obj)
        assign_perm('view_note', self.request.user, obj)
        # make sure parsed_instance saves to mongo db
        obj.instance.parsed_instance.save()

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        instance = obj.instance
        obj.delete()
        # update mongo data
        instance.parsed_instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
