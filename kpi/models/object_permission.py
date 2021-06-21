# coding: utf-8
from django.core.exceptions import ValidationError
from django.db import models

from kpi.fields.kpi_uid import KpiUidField
from kpi.utils.cache import void_cache_for_request


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

