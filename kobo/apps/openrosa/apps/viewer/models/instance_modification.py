# coding: utf-8
from django.db import models

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Instance


class InstanceModification(models.Model):
    user = models.ForeignKey(User, null=True, on_delete=models.CASCADE)

    action = models.CharField(max_length=50)

    instance = models.ForeignKey(Instance, null=False,
                                 related_name="modifications", on_delete=models.CASCADE)
    xpath = models.CharField(max_length=50)

    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "viewer"

    def process_doc(self, doc):
        if self.action == "delete":
            doc.pop(self.xpath)

        return doc
