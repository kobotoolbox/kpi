from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):

    date_created = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields', {})
        if not update_fields or 'date_modified' in update_fields:
            self.date_modified = timezone.now()

        super().save(*args, **kwargs)
