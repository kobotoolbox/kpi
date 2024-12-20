from django.db import models
from django.utils import timezone


def _get_default_datetime():
    """
    Return the current time so that the timestamp is evaluated at the time of
    model instantiation rather than at the time of class definition. This allows
    for easier mocking in test cases compared to using timezone.now directly.
    """
    return timezone.now()


class AbstractTimeStampedModel(models.Model):
    """
    Abstract model to add created and modified timestamps to a model
    """
    date_created = models.DateTimeField(default=_get_default_datetime)
    date_modified = models.DateTimeField(default=_get_default_datetime)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields', None)
        if update_fields is None or 'date_modified' not in update_fields:
            self.date_modified = timezone.now()
            if update_fields:
                update_fields.append('date_modified')
        super().save(*args, **kwargs)
