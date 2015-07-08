from django.db import models
from markitup.fields import MarkupField

class SitewideMessage(models.Model):
    class Meta:
        app_label = 'hub'

    slug = models.CharField(max_length=50)
    body = MarkupField()
    def __str__(self):
        return self.slug