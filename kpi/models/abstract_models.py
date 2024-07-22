from django.db import models
from django.utils import timezone


def get_current_time():
    """
    Return the current time so that the timestamp is evaluated at the time of model instantiation rather than
    at the time of class definition
    """
    return timezone.now()


class AbstractTimeStampedModel(models.Model):
    """
    Abstract model to add created and modified timestamps to a model
    """
    date_created = models.DateTimeField(default=get_current_time)
    date_modified = models.DateTimeField(default=get_current_time)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields', None)
        if update_fields is None or 'date_modified' in update_fields:
            self.date_modified = timezone.now()
        super().save(*args, **kwargs)
