import secrets

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import fields
from django_request_cache import cache_for_request

from kobo.apps.openrosa.libs.constants import OPENROSA_APP_LABELS
from kobo.apps.openrosa.libs.permissions import get_model_permission_codenames
from kobo.apps.organizations.models import Organization, create_organization
from kpi.fields import KpiUidField
from kpi.utils.database import update_autofield_sequence, use_db
from kpi.utils.permissions import is_user_anonymous


class User(AbstractUser):

    class Meta:
        db_table = 'auth_user'
        swappable = 'AUTH_USER_MODEL'

    def has_perm(self, perm, obj=None):
        # If it is a KoboCAT permissions, check permission in KoboCAT DB first
        # 3 options:
        # - `obj` is not None and its app_label belongs to KoboCAT
        # - `perm` format is <app_label>.<perm>, we check the app label
        # - `perm` belongs to KoboCAT permission codenames
        if obj:
            if obj._meta.app_label in OPENROSA_APP_LABELS:
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
    def organization(self):
        if is_user_anonymous(self):
            return

        # Database allows multiple organizations per user, but we restrict it to one.
        if (
            organization := Organization.objects.filter(organization_users__user=self)
            .order_by('-organization_users__created')
            .first()
        ):
            return organization

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


class DataCollectorGroup(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    uid = KpiUidField(uid_prefix='dcg', primary_key=True)
    name = fields.CharField(max_length=200)

    def __str__(self):
        return '{} ({})'.format(self.name, self.uid)


class DataCollector(models.Model):
    uid = KpiUidField(uid_prefix='dc', primary_key=True)
    name = fields.CharField(null=True, blank=True, max_length=200)
    token = fields.CharField(max_length=40)
    group = models.ForeignKey(
        DataCollectorGroup, on_delete=models.SET_NULL, related_name='data_collectors',
        null=True, blank=True
    )

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = self.generate_key()
        super().save()

    def rotate_token(self):
        self.token = None
        self.save()

    @classmethod
    def generate_key(cls):
        return secrets.token_hex(20)
