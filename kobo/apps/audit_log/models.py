from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.conf import settings
from django.utils.timezone import now


class AuditMethod(models.TextChoices):

    CREATE = 'create', 'CREATE'
    DELETE = 'delete', 'DELETE'
    UPDATE = 'update', 'UPDATE'


class AuditLog(models.Model):

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    # We cannot use ContentType FK because we handle models and shadow models.
    # Shadow models do not have content types related to this db.
    app_label = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)
    object_id = models.BigIntegerField()
    date_created = models.DateTimeField(default=now, db_index=True)
    metadata = models.JSONField(default=dict)
    method = models.CharField(
        max_length=6,
        choices=AuditMethod.choices,
        default=AuditMethod.DELETE,
        db_index=True
    )

    class Meta:
        index_together = (
            ('app_label', 'model_name', 'method'),
            ('app_label', 'model_name'),
        )
