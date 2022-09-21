from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.conf import settings
from django.utils.timezone import now


class AuditLog(models.Model):

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    # We cannot use ContentType FK because we handle models and shadow models.
    # Shadow models do not have content types related to this db.
    app_label = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)
    object_id = models.BigIntegerField()
    date_deleted = models.DateTimeField(default=now, db_index=True)

    class Meta:
        unique_together = ('app_label', 'model_name', 'object_id')
        index_together = ('app_label', 'model_name')
