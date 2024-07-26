# coding: utf-8
from django.db import models

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Instance
from kpi.models.abstract_models import AbstractTimeStampedModel


class InstanceModification(AbstractTimeStampedModel):
    user = models.ForeignKey(User, null=True, on_delete=models.CASCADE)

    action = models.CharField(max_length=50)

    instance = models.ForeignKey(Instance, null=False,
                                 related_name="modifications", on_delete=models.CASCADE)
    xpath = models.CharField(max_length=50)

    class Meta:
        app_label = "viewer"

    def process_doc(self, doc):
        if self.action == "delete":
            doc.pop(self.xpath)

        return doc
