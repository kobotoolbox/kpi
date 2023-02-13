from django.contrib.auth.models import User
from django.db.models import QuerySet

from organizations.utils import create_organization
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.serializers import OrganizationSerializer


class OrganizationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    todo: create documentation
    """

    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    lookup_field = 'uid'
    permission_classes = (IsAuthenticated,)
    extra_context = None

    def get_queryset(self) -> QuerySet:
        user = self.request.user
        queryset = super().get_queryset().filter(users=user)
        if not queryset:
            # Very inefficient get or create queryset.
            # It's temporary and should be removed later.
            create_organization(user, f"{user.username}'s organization", model=Organization)
            queryset = queryset.all()  # refresh
        return queryset
