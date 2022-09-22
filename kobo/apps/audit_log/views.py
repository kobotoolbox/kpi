from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAdminUser
from rest_framework.renderers import JSONRenderer

from kpi.filters import SearchFilter
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    """

    model = AuditLog
    serializer_class = AuditLogSerializer
    permission_classes = (IsAdminUser,)  # Allow any user with `is_staff=True`
    renderer_classes = (JSONRenderer,)
    queryset = AuditLog.objects.all()
    filter_backends = (SearchFilter,)

    search_default_field_lookups = [
        'app_label__icontains',
        'model_name__icontains',
        'metadata__icontains',
    ]
