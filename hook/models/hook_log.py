# -*- coding: utf-8 -*-
from importlib import import_module
import logging

from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext as _
from jsonbfield.fields import JSONField as JSONBField
from rest_framework import status
from rest_framework.reverse import reverse
import requests


class HookLog(models.Model):

    hook = models.ForeignKey("Hook", related_name="logs", on_delete=models.CASCADE)
    uid = models.CharField(unique=True, max_length=36)  # Unique ID provided by submitted data
    tries = models.IntegerField(default=0)
    success = models.BooleanField(default=True)  # Could use status_code, but will speed-up queries.
    status_code = models.IntegerField(default=200)
    message = models.CharField(default="", max_length=500)
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date_modified"]

    def retry(self, data):
        """
        Retry to send data to external service
        only if it has failed before this try.
        :param data:
        :return: tuple,
        """
        if self.success is not True:
            if data:
                try:
                    ServiceDefinition = self.hook.get_service_definition()
                    parsed_data = ServiceDefinition.parse(self.uid, data)
                    ServiceDefinition.send(self.hook, parsed_data)
                    self.refresh_from_db()
                    status_code = status.HTTP_OK if self.success else self.status_code
                    return status_code, self.message
                except Exception as e:
                    logger = logging.getLogger("console_logger")
                    logger.error("HookLog.retry - {}".format(str(e)), exc_info=True)
                    return status.HTTP_500_INTERNAL_SERVER_ERROR,\
                           _("An error has occurred when sending the data. Please try again later.")

            return status.HTTP_500_INTERNAL_SERVER_ERROR,\
                   _("Could not retrieve data.")

        return status.HTTP_400_BAD_REQUEST,\
               _("Instance has already been sent to external endpoint successfully.")

    def save(self, *args, **kwargs):
        # Update date_modified each time object is saved
        self.date_modified = timezone.now()
        self.tries += 1
        self.hook.reset_totals()
        super(HookLog, self).save(*args, **kwargs)

    def __unicode__(self):
        return "<HookLog {uid}>".format(uid=self.uid)
