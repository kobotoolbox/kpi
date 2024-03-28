# coding: utf-8
from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from guardian.conf import settings as guardian_settings
from rest_framework.authtoken.models import Token

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.libs.utils.guardian import (
    get_perms_for_model,
    assign_perm,
)
from kobo.apps.openrosa.apps.logger.fields import LazyDefaultBooleanField
from kobo.apps.openrosa.apps.main.signals import set_api_permissions
from kobo.apps.openrosa.libs.utils.country_field import COUNTRIES
from kobo.apps.openrosa.libs.utils.gravatar import (
    get_gravatar_img_link,
    gravatar_exists,
)
from kpi.utils.database import use_db


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

    def __str__(self):
        return '%s[%s]' % (self.name, self.user.username)

    @property
    def gravatar(self):
        return get_gravatar_img_link(self.user)

    @property
    def gravatar_exists(self):
        return gravatar_exists(self.user)

    @property
    def twitter_clean(self):
        if self.twitter.startswith("@"):
            return self.twitter[1:]
        return self.twitter

    class Meta:
        app_label = 'main'
        permissions = (
            ('can_add_xform', "Can add/upload an xform to user profile"),
            ('view_profile', "Can view user profile"),
        )


# TODO Get rid of post signals below. There are only needed to KC unit tests.
#  KPI does create KoboCAT object permissions and KoboCAT Token.
#  See below:

# 1) KC Token object is created when KPI calls `KobocatToken.sync()`
#    in `kpi.signals.save_kobocat_token()`
def create_auth_token(sender, instance=None, created=False, **kwargs):
    if created:
        with use_db(settings.OPENROSA_DB_ALIAS):
            if User.objects.filter(pk=instance.pk).exists() or settings.TESTING:
                Token.objects.get_or_create(user_id=instance.pk)


post_save.connect(create_auth_token, sender=User, dispatch_uid='auth_token')

# 2) KC object permissions are created when KPI calls `grant_kc_model_level_perms()`
#    in `kpi.signals.save_kobocat_user()`
post_save.connect(
    set_api_permissions, sender=User, dispatch_uid='set_api_permissions'
)


# 3) Same as #2,
def set_object_permissions(sender, instance=None, created=False, **kwargs):
    if created:
        with use_db(settings.OPENROSA_DB_ALIAS):
            if User.objects.filter(pk=instance.pk).exists() or settings.TESTING:
                for perm in get_perms_for_model(UserProfile):
                    assign_perm(perm.codename, instance.user, instance)


post_save.connect(
    set_object_permissions,
    sender=UserProfile,
    dispatch_uid='set_object_permissions',
)


# TODO, remove this in favor of `kpi.utils.object_permission.get_anonymous_user()`
def get_anonymous_user_instance(user_class: User):
    """
    Force `AnonymousUser` to be saved with `pk` == `ANONYMOUS_USER_ID`
    """

    return user_class(
        pk=settings.ANONYMOUS_USER_ID,
        username=guardian_settings.ANONYMOUS_USER_NAME,
    )
