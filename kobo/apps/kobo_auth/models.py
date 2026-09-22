from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Func, Value
from django.db.models.functions import Lower
from django_request_cache import cache_for_request

from kobo.apps.openrosa.libs.constants import OPENROSA_APP_LABELS
from kobo.apps.openrosa.libs.permissions import get_model_permission_codenames
from kobo.apps.organizations.models import (
    EmptyOrganization,
    Organization,
    create_organization,
)
from kpi.utils.database import update_autofield_sequence, use_db
from kpi.utils.permissions import is_user_anonymous


class User(AbstractUser):

    class Meta:
        db_table = 'auth_user'
        swappable = 'AUTH_USER_MODEL'
        indexes = [
            models.Index(
                Func(
                    Lower('email'),
                    Value('@'),
                    Value(2),
                    function='split_part',
                    output_field=models.CharField(),
                ),
                name='auth_user_email_domain_idx',
            ),
        ]

    def has_perm(self, perm, obj=None):
        # If it is a KoboCAT permissions, check permission in KoboCAT DB first
        # 3 options:
        # - `obj` is not None and its app_label belongs to KoboCAT
        # - `perm` format is <app_label>.<perm>, we check the app label
        # - `perm` belongs to KoboCAT permission codenames
        if obj and obj._meta.app_label in OPENROSA_APP_LABELS:
            with use_db(settings.OPENROSA_DB_ALIAS):
                return super().has_perm(perm, obj)

        if '.' in perm:
            app_label, _ = perm.split('.', 1)
            if app_label in OPENROSA_APP_LABELS:
                with use_db(settings.OPENROSA_DB_ALIAS):
                    return super().has_perm(perm, obj)

        if perm in get_model_permission_codenames():
            with use_db(settings.OPENROSA_DB_ALIAS):
                return super().has_perm(perm, obj)

        # Otherwise, check in KPI DB
        return super().has_perm(perm, obj)

    @property
    @cache_for_request
    def is_org_owner(self):
        """
        Shortcut to check if the user is the owner of the organization, allowing
        direct access via the User object instead of calling `organization.is_owner()`.
        """
        return self.organization.is_owner(self)

    @property
    @cache_for_request
    def organization(self) -> Organization:
        """
        Return the organization the user belongs to, or a falsy
        `EmptyOrganization` when they belong to none, so that callers can access
        organization attributes without guarding against `None` first.
        """

        if is_user_anonymous(self):
            return EmptyOrganization()

        # Database allows multiple organizations per user, but we restrict it to one.
        if (
            organization := Organization.objects.filter(organization_users__user=self)
            .order_by('-organization_users__created')
            .first()
        ):
            return organization

        try:
            date_removed = self.extra_details.date_removed
        except self.__class__.extra_details.RelatedObjectDoesNotExist:
            date_removed = None

        if not self.is_active or date_removed:
            return EmptyOrganization()

        return create_organization(
            self, f"{self.username}'s organization"
        )

    def sync_to_openrosa_db(self):
        User = self.__class__  # noqa
        User.objects.using(settings.OPENROSA_DB_ALIAS).bulk_create(
            [self],
            update_conflicts=True,
            update_fields=[
                'password',
                'last_login',
                'is_superuser',
                'first_name',
                'last_name',
                'email',
                'is_staff',
                'is_active',
                'date_joined',
            ],
            unique_fields=['pk'],
        )
        update_autofield_sequence(User)
