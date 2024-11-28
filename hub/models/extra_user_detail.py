from django.conf import settings
from django.db import models

from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.fields import KpiUidField
from kpi.mixins import StandardizeSearchableFieldMixin


class ExtraUserDetail(StandardizeSearchableFieldMixin, models.Model):
    uid = KpiUidField(uid_prefix='u')
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name='extra_details',
        on_delete=models.CASCADE,
    )
    data = models.JSONField(default=dict)
    private_data = models.JSONField(default=dict, blank=True)
    date_removal_requested = models.DateTimeField(null=True, blank=True)
    date_removed = models.DateTimeField(null=True, blank=True)
    password_date_changed = models.DateTimeField(null=True, blank=True)
    validated_password = models.BooleanField(default=True)

    def __str__(self):
        return "{}'s data: {}".format(self.user.__str__(), repr(self.data))

    def save(
        self,
        force_insert=False,
        force_update=False,
        using=None,
        update_fields=None,
    ):
        created = self.pk is None

        if not update_fields or (update_fields and 'data' in update_fields):
            self.standardize_json_field('data', 'organization', str)
            self.standardize_json_field('data', 'name', str)
            if not created:
                self._sync_org_details()

        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )

        # Sync `validated_password` field to `UserProfile` only when
        # this object is updated to avoid a race condition and an IntegrityError
        # when trying to save `UserProfile` object whereas the related
        # `KobocatUser` object has not been created yet.
        if (
            not settings.TESTING
            and not created
            and (
                not update_fields
                or (update_fields and 'validated_password' in update_fields)
            )
        ):
            UserProfile.set_password_details(
                self.user.id,
                self.validated_password,
            )

    def _sync_org_details(self):
        """
        Synchronizes the `name`, `organization_type`, and `organization_website` fields
        of the Organization model with the corresponding attributes in the `data` field
        of ExtraUserDetail. This is performed only if the user is the owner, and their
        organization is **not** a multi-member organization.

        This ensures that metadata updates are accurately reflected before the
        organization potentially transitions to a multi-member state.
        """
        user_organization = self.user.organization
        if user_organization.is_owner(self.user) and not user_organization.is_mmo:
            fields_to_update = []
            try:
                organization_name = self.data['organization'].strip()
            except (KeyError, AttributeError):
                pass
            else:
                if organization_name:
                    user_organization.name = organization_name
                    fields_to_update.append('name')

            try:
                organization_type = self.data['organization_type'].strip()
            except (KeyError, AttributeError):
                pass
            else:
                user_organization.organization_type = organization_type
                fields_to_update.append('organization_type')

            try:
                organization_website = self.data['organization_website'].strip()
            except (KeyError, AttributeError):
                pass
            else:
                user_organization.website = organization_website
                fields_to_update.append('website')

            if fields_to_update:
                user_organization.save(update_fields=fields_to_update)
