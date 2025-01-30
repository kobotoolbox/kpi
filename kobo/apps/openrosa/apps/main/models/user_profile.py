import json

from django.conf import settings
from django.db import models
from guardian.conf import settings as guardian_settings

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.fields import LazyDefaultBooleanField
from kobo.apps.openrosa.libs.utils.country_field import COUNTRIES
from kobo.apps.openrosa.libs.utils.gravatar import (
    get_gravatar_img_link,
    gravatar_exists,
)


class UserProfile(models.Model):
    # This field is required.
    user = models.OneToOneField(User, related_name='profile', on_delete=models.CASCADE)

    # Other fields here
    name = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=255, blank=True)
    country = models.CharField(max_length=2, choices=COUNTRIES, blank=True)
    organization = models.CharField(max_length=255, blank=True)
    home_page = models.CharField(max_length=255, blank=True)
    twitter = models.CharField(max_length=255, blank=True)
    description = models.CharField(max_length=255, blank=True)
    # TODO Remove this field (`require_auth`) in the next release following the one where
    #  this commit has been deployed to production
    require_auth = models.BooleanField(default=True)
    address = models.CharField(max_length=255, blank=True)
    phonenumber = models.CharField(max_length=30, blank=True)
    num_of_submissions = models.IntegerField(default=0)
    attachment_storage_bytes = models.BigIntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    is_mfa_active = LazyDefaultBooleanField(default=False)
    validated_password = models.BooleanField(default=True)
    submissions_suspended = models.BooleanField(default=False)

    class Meta:
        app_label = 'main'
        permissions = (
            ('can_add_xform', 'Can add/upload an xform to user profile'),
            ('view_profile', 'Can view user profile'),
        )

    def __str__(self):
        return '%s[%s]' % (self.name, self.user.username)

    @classmethod
    def to_dict(cls, user_id: int) -> dict:
        """
        Retrieve all fields from the user's KC profile and return them in a
        dictionary
        """
        profile_model, _ = cls.objects.get_or_create(user_id=user_id)
        profile = profile_model.__dict__

        fields = [
            # Use a (kc_name, new_name) tuple to rename a field
            'name',
            'organization',
            ('home_page', 'organization_website'),
            ('description', 'bio'),
            ('phonenumber', 'phone_number'),
            'address',
            'city',
            'country',
            'twitter',
            'metadata',
        ]

        result = {}

        for field in fields:

            if isinstance(field, tuple):
                kc_name, field = field
            else:
                kc_name = field

            value = profile.get(kc_name)
            # When a field contains JSON (e.g. `metadata`), it gets loaded as a
            # `dict`. Convert it back to a string representation
            if isinstance(value, dict):
                value = json.dumps(value)
            result[field] = value
        return result

    @property
    def gravatar(self):
        return get_gravatar_img_link(self.user)

    @property
    def gravatar_exists(self):
        return gravatar_exists(self.user)

    @classmethod
    def set_mfa_status(cls, user_id: int, is_active: bool):
        user_profile, created = cls.objects.get_or_create(user_id=user_id)
        user_profile.is_mfa_active = int(is_active)
        user_profile.save(update_fields=['is_mfa_active'])

    @classmethod
    def set_password_details(
        cls,
        user_id: int,
        validated: bool,
    ):
        """
        Update the kobocat user's password_change_date and validated_password fields
        """
        user_profile, created = cls.objects.get_or_create(user_id=user_id)
        user_profile.validated_password = validated
        user_profile.save(update_fields=['validated_password'])


# TODO, remove this in favor of `kpi.utils.object_permission.get_anonymous_user()`
def get_anonymous_user_instance(user_class: User):
    """
    Force `AnonymousUser` to be saved with `pk` == `ANONYMOUS_USER_ID`
    """

    return user_class(
        pk=settings.ANONYMOUS_USER_ID,
        username=guardian_settings.ANONYMOUS_USER_NAME,
    )
