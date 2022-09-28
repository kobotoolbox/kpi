from django.db.models import QuerySet
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from kobo.apps.organizations.models import (
    Organization,
    OrganizationOwner,
    OrganizationUser,
)
from kobo.apps.organizations.serializer import OrganizationSerializer


class OrganizationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet
):
    """
    todo: create documentation
    """
    serializer_class = OrganizationSerializer
    permission_classes = (IsAuthenticated,)
    extra_context = None

    def _check_org(self, queryset):
        username = self.request.user.username
        if not queryset:
            org = Organization.objects.create(
                name=f'{username}\'s organization',
                slug=f'{username}s-organization',
            )
            org_user = OrganizationUser.objects.create(
                user=self.request.user,
                organization=org,
            )
            OrganizationOwner.objects.create(
                user=org_user,
                organization=org,
            )
            user_orgs = self.request.user.organizations_organization.values_list(
                'id',
                flat=True,
            ).all()

            return user_orgs
        return queryset

    def get_queryset(self) -> QuerySet:
        orgs = Organization.objects.filter(users__id=self.request.user.id)
        orgs = self._check_org(orgs)
        return orgs
from django.db.models import QuerySet
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from kobo.apps.organizations.models import (
    Organization,
    OrganizationOwner,
    OrganizationUser,
)
from kobo.apps.organizations.serializer import OrganizationSerializer


class OrganizationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet
):
    """
    todo: create documentation
    """
    serializer_class = OrganizationSerializer
    permission_classes = (IsAuthenticated,)
    extra_context = None

    def _check_org(self, queryset):
        username = self.request.user.username
        if not queryset:
            org = Organization.objects.create(
                name=f'{username}\'s organization',
                slug=f'{username}s-organization',
            )
            org_user = OrganizationUser.objects.create(
                user=self.request.user,
                organization=org,
            )
            OrganizationOwner.objects.create(
                user=org_user,
                organization=org,
            )
            user_orgs = self.request.user.organizations_organization.values_list(
                'id',
                flat=True,
            ).all()

            return user_orgs
        return queryset

    def get_queryset(self) -> QuerySet:
        orgs = Organization.objects.filter(users__id=self.request.user.id)
        orgs = self._check_org(orgs)
        return orgs
from django.db.models import QuerySet
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from kobo.apps.organizations.models import (
    Organization,
    OrganizationOwner,
    OrganizationUser,
)
from kobo.apps.organizations.serializer import OrganizationSerializer


class OrganizationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet
):
    """
    todo: create documentation
    """
    serializer_class = OrganizationSerializer
    permission_classes = (IsAuthenticated,)
    extra_context = None

    def _check_org(self, queryset):
        username = self.request.user.username
        if not queryset:
            org = Organization.objects.create(
                name=f'{username}\'s organization',
                slug=f'{username}s-organization',
            )
            org_user = OrganizationUser.objects.create(
                user=self.request.user,
                organization=org,
            )
            OrganizationOwner.objects.create(
                user=org_user,
                organization=org,
            )
            user_orgs = self.request.user.organizations_organization.values_list(
                'id',
                flat=True,
            ).all()

            return user_orgs
        return queryset

    def get_queryset(self) -> QuerySet:
        orgs = Organization.objects.filter(users__id=self.request.user.id)
        orgs = self._check_org(orgs)
        return orgs
