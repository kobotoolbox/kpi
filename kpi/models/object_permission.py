# coding: utf-8
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django_request_cache import cache_for_request

from kpi.fields.kpi_uid import KpiUidField
from kpi.utils.cache import void_cache_for_request


@cache_for_request
def get_anonymous_user():
    """ Return a real User in the database to represent AnonymousUser. """
    try:
        user = User.objects.get(pk=settings.ANONYMOUS_USER_ID)
    except User.DoesNotExist:
        username = getattr(
            settings,
            'ANONYMOUS_DEFAULT_USERNAME_VALUE',
            'AnonymousUser'
        )
        user = User.objects.create(
            pk=settings.ANONYMOUS_USER_ID,
            username=username
        )
    return user


def perm_parse(perm, obj=None):
    if obj is not None:
        obj_app_label = ContentType.objects.get_for_model(obj).app_label
    else:
        obj_app_label = None
    try:
        app_label, codename = perm.split('.', 1)
        if obj_app_label is not None and app_label != obj_app_label:
            raise ValidationError('The given object does not belong to the app '
                                  'specified in the permission string.')
    except ValueError:
        app_label = obj_app_label
        codename = perm
    return app_label, codename


class ObjectPermission(models.Model):
    """
    An object-level permission assignment for an `Asset`.
    It was formerly a generic object-level permission assignment, but the class
    name will change soon to `AssetPermission`.
    """
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    permission = models.ForeignKey('auth.Permission', on_delete=models.CASCADE)
    deny = models.BooleanField(
        default=False,
        help_text='Blocks inheritance of this permission when set to True'
    )
    inherited = models.BooleanField(default=False)
    asset = models.ForeignKey(
        'kpi.Asset', related_name='permissions', on_delete=models.CASCADE
    )
    uid = KpiUidField(uid_prefix='p')

    @property
    def kind(self):
        return 'objectpermission'

    @property
    def label(self):
        return self.asset.get_label_for_permission(self.permission)

    class Meta:
        unique_together = ('user', 'permission', 'deny', 'inherited', 'asset')

    @void_cache_for_request(keys=('__get_all_object_permissions',
                                  '__get_all_user_permissions',))
    def save(self, *args, **kwargs):
        if ('kpi', 'asset') != (
            self.permission.content_type.app_label,
            self.permission.content_type.model,
        ):
            raise ValidationError(
                'The content type of the permission does '
                'not match that of the object.'
            )
        super().save(*args, **kwargs)

    @void_cache_for_request(keys=('__get_all_object_permissions',
                                  '__get_all_user_permissions',))
    def delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)

    def __str__(self):
        for required_field in ('user', 'permission'):
            if not hasattr(self, required_field):
                return 'incomplete ObjectPermission'
        return '{}{} {} {}'.format(
            'inherited ' if self.inherited else '',
            str(self.permission.codename),  # TODO Test if cast is still needed
            'denied from' if self.deny else 'granted to',
            str(self.user)  # TODO Test if cast is still needed
        )

