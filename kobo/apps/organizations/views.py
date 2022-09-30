from django.contrib.auth.models import User
from django.db.models import QuerySet
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from kobo.apps.organizations.models import (
    Organization,
    OrganizationOwner,
    OrganizationUser,
)
from kobo.apps.organizations.serializers import OrganizationSerializer


class OrganizationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet
):
    """
    todo: create documentation
    """
    serializer_class = OrganizationSerializer
    lookup_field = 'uid'
    permission_classes = (IsAuthenticated,)
    extra_context = None

    def _check_org(self, queryset):
        user = self.request.user
        org = Organization.objects.create(
            name=f'{user.username}\'s organization',
            slug=f'{user.username}s-organization',
        )
        org.add_user(user, is_admin=True)
        return self.get_queryset()

    def get_queryset(self) -> QuerySet:
        orgs = Organization.objects.filter(users__id=self.request.user.id)
        if not orgs:
            orgs = self._check_org(orgs)
        return orgs
