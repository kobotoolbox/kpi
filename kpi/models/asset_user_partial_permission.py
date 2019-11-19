# coding: utf-8
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.utils import timezone


class AssetUserPartialPermission(models.Model):
    """
    Many-to-Many table which provides users' permissions
    on other users' submissions

    For example,
        - Asset:
            - uid: aAAAAAA
            - id: 1
        - User:
            - username: someuser
            - id: 1
    We want someuser to be able to view otheruser's submissions
    Records should be
    `permissions` is dict formatted as is:
    asset_id | user_id | permissions
        1    |    1    | {"someuser": ["view_submissions"]}

    Using a list per user for permissions, gives the opportunity to add other permissions
    such as `change_submissions`, `delete_submissions` for later purpose
    """

    class Meta:
        unique_together = [['asset', 'user']]

    asset = models.ForeignKey('Asset', related_name='asset_partial_permissions',
                              on_delete=models.CASCADE)
    user = models.ForeignKey('auth.User', related_name='user_partial_permissions',
                             on_delete=models.CASCADE)
    permissions = JSONBField(default=dict)
    date_created = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)

    def save(self, *args, **kwargs):

        if self.pk is not None:
            self.date_modified = timezone.now()

        super().save(*args, **kwargs)
