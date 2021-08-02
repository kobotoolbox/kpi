# coding: utf-8
import datetime

from django.db.models import Q
from markdownx.views import ImageUploadView
from private_storage.views import PrivateStorageView
from rest_framework import viewsets

from .forms import InAppMessageImageForm
from .models import InAppMessage, InAppMessageFile
from .permissions import InAppMessagePermissions
from .serializers import InAppMessageSerializer


class InAppMessageImageUploadView(ImageUploadView):
    """
    django-markdownx uses this view to POST files that a user drags-and-drops
    onto the editor (per `settings.MARKDOWNX_UPLOAD_URLS_PATH`)
    """
    form_class = InAppMessageImageForm


class InAppMessageFileContentView(PrivateStorageView):
    """
    A view that allows any authenticated user to access the contents of an
    `InAppMessageFile`. The primary purpose is to override
    `settings.PRIVATE_STORAGE_AUTH_FUNCTION`
    """
    model = InAppMessageFile
    model_file_field = 'content'

    def can_access_file(self, private_file):
        return private_file.request.user.is_authenticated


class InAppMessageViewSet(viewsets.ModelViewSet):
    """
    Retrieve a list of in-app messages or an individual message. Markdown fields
    are returned without modification, but converted HTML for each Markdown
    field is provided in the `html` object of each message. The most recently
    created messages appear first in the list.

    The `interactions` field is stored individually for each user, and any
    authenticated user may update it with a `PATCH`. Only superusers are
    allowed to update the other fields.
    """
    lookup_field = 'uid'
    queryset = InAppMessage.objects.all()
    serializer_class = InAppMessageSerializer
    permission_classes = [InAppMessagePermissions]

    def get_queryset(self):
        now = datetime.datetime.utcnow()
        return self.queryset.filter(
            Q(published=True) | Q(last_editor=self.request.user),
            valid_from__lte=now,
            valid_until__gte=now,
        ).order_by('-pk')
