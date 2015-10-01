from django.db import models
from django.conf import settings
from markitup.fields import MarkupField

class SitewideMessage(models.Model):
    slug = models.CharField(max_length=50)
    body = MarkupField()
    def __str__(self):
        return self.slug

class FormBuilderPreference(models.Model):
    KPI = 'K'
    DKOBO = 'D'
    BUILDER_CHOICES = (
        (KPI, 'kpi'),
        (DKOBO, 'dkobo')
    )
    user = models.OneToOneField(settings.AUTH_USER_MODEL)
    preferred_builder = models.CharField(
        max_length=1,
        choices=BUILDER_CHOICES,
        default=DKOBO
    )
