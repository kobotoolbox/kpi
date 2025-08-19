from django.db.models import Q
from django.utils import timezone
from private_storage.views import PrivateStorageView
from rest_framework import viewsets

from kpi.utils.object_permission import get_database_user
from .models import InAppMessage, InAppMessageFile
from .permissions import InAppMessagePermissions
from .serializers import InAppMessageSerializer


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
        user = get_database_user(self.request.user)

        return self.queryset.distinct().filter(
            Q(published=True) | Q(last_editor=user),
            Q(inappmessageusers__isnull=True) | Q(inappmessageusers__user=user),
            valid_from__lte=timezone.now(),
            valid_until__gte=timezone.now(),
        ).order_by('-pk')
