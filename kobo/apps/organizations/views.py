from django.db.models import QuerySet
from rest_framework import viewsets

from kpi.permissions import IsAuthenticated
from .models import Organization, create_organization
from .permissions import IsOrgAdminOrReadOnly
from .serializers import OrganizationSerializer


class OrganizationViewSet(viewsets.ModelViewSet):
    """
    Organizations are groups of users with assigned permissions and configurations

    - Organization admins can manage the organization and it's membership
    - Connect to authentication mechanisms and enforce policy
    - Create teams and projects under the organization
    """

    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    lookup_field = 'id'
    permission_classes = (IsAuthenticated, IsOrgAdminOrReadOnly)

    def get_queryset(self) -> QuerySet:
        user = self.request.user
        queryset = super().get_queryset().filter(users=user)
        if self.action == "list" and not queryset:
            # Very inefficient get or create queryset.
            # It's temporary and should be removed later.
            create_organization(user, f"{user.username}'s organization")
            queryset = queryset.all()  # refresh
        return queryset
