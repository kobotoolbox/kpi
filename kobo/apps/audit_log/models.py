from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.conf import settings
from django.utils.timezone import now

from kpi.fields.kpi_uid import UUID_LENGTH


class AuditAction(models.TextChoices):

    CREATE = 'create', 'CREATE'
    DELETE = 'delete', 'DELETE'
    IN_TRASH = 'in-trash', 'IN TRASH'
    PUT_BACK = 'put-back', 'PUT BACK'
    REMOVE = 'remove', 'REMOVE'
    UPDATE = 'update', 'UPDATE'


class AuditLog(models.Model):

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    # We cannot use ContentType FK because we handle models and shadow models.
    # Shadow models do not have content types related to this db.
    app_label = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)
    object_id = models.BigIntegerField()
    date_created = models.DateTimeField(default=now, db_index=True)
    metadata = models.JSONField(default=dict)
    action = models.CharField(
        max_length=10,
        choices=AuditAction.choices,
        default=AuditAction.DELETE,
        db_index=True
    )
    user_uid = models.CharField(db_index=True, max_length=UUID_LENGTH + 1)  # 1 is prefix length

    class Meta:
        indexes = [
            models.Index(fields=['app_label', 'model_name', 'action']),
            models.Index(fields=['app_label', 'model_name']),
        ]

    def save(
        self,
        force_insert=False,
        force_update=False,
        using=None,
        update_fields=None,
    ):
        if not self.user_uid:
            self.user_uid = self.user.extra_details.uid

        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )
