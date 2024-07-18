from django.db import models
from django.utils import timezone


class AbstractTimeStampedModel(models.Model):
    """
    Abstract model to add created and modified timestamps to a model
    """
    date_created = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields', None)
        if update_fields is None or 'date_modified' in update_fields:
            self.date_modified = timezone.now()
        super().save(*args, **kwargs)
