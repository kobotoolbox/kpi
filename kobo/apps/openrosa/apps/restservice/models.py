# coding: utf-8
from django.db import models
from django.utils.translation import gettext_lazy

from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.restservice import SERVICE_CHOICES


class RestService(models.Model):

    class Meta:
        app_label = 'restservice'
        unique_together = ('service_url', 'xform', 'name')

    service_url = models.URLField(gettext_lazy("Service URL"))
    xform = models.ForeignKey(XForm, related_name="restservices", on_delete=models.CASCADE)
    name = models.CharField(max_length=50, choices=SERVICE_CHOICES)

    def __str__(self):
        return "%s:%s - %s" % (self.xform, self.long_name, self.service_url)

    def get_service_definition(self):
        m = __import__(''.join(['kobo.apps.openrosa.apps.restservice.services.',
                       self.name]),
                       globals(), locals(), ['ServiceDefinition'])
        return m.ServiceDefinition

    @property
    def long_name(self):
        sv = self.get_service_definition()
        return sv.verbose_name
