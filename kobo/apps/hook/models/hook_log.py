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

from ..constants import HOOK_LOG_PENDING, HOOK_LOG_FAILED, HOOK_LOG_SUCCESS
from kpi.fields import KpiUidField


class HookLog(models.Model):

    hook = models.ForeignKey("Hook", related_name="logs", on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix="hl")
    data_id = models.IntegerField(default=0, db_index=True)  # `kc.logger.Instance.id`. Useful to retrieve data on retry
    tries = models.PositiveSmallIntegerField(default=0)
    status = models.PositiveSmallIntegerField(default=HOOK_LOG_PENDING)  # Could use status_code, but will speed-up queries.
    status_code = models.IntegerField(default=200)
    message = models.TextField(default="")
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_created"]

    def change_status(self, status=HOOK_LOG_PENDING):
        self.status = status
        self.save(reset_status=True)

    def retry(self, data):
        """
        Retries to send data to external service
        only if it has failed before this try.
        :param data: mixed.
        :return: tuple. status_code, response dict
        """
        if self.status == HOOK_LOG_FAILED:
            self.change_status()
            if data:
                try:
                    ServiceDefinition = self.hook.get_service_definition()
                    service_definition = ServiceDefinition(self.hook, data, self.data_id)
                    success = service_definition.send()
                    self.refresh_from_db()
                    return status.HTTP_200_OK, {
                        "success": success,
                        "message": self.message,
                        "status_code": self.status_code
                    }
                except Exception as e:
                    logger = logging.getLogger("console_logger")
                    logger.error("HookLog.retry - {}".format(str(e)), exc_info=True)
                    self.change_status(HOOK_LOG_FAILED)
                    return status.HTTP_500_INTERNAL_SERVER_ERROR, {
                        "detail": _("An error has occurred when sending the data. Please try again later.")
                    }
            self.change_status(HOOK_LOG_FAILED)
            return status.HTTP_500_INTERNAL_SERVER_ERROR, {
                "detail": _("Could not retrieve data.")
            }

        return status.HTTP_400_BAD_REQUEST, {
            "detail": _("Data is being or has already been processed")
        }

    def save(self, *args, **kwargs):
        # Update date_modified each time object is saved
        self.date_modified = timezone.now()
        # We don't want to alter tries when we only change the status
        if kwargs.pop("reset_status", False) is False:
            self.tries += 1
            self.hook.reset_totals()
        super(HookLog, self).save(*args, **kwargs)

    @property
    def status_str(self):
        if self.status == HOOK_LOG_PENDING:
            return "Pending"
        elif self.status == HOOK_LOG_FAILED:
            return "Failed"
        elif self.status == HOOK_LOG_SUCCESS:
            return "Success"

    def __unicode__(self):
        return "<HookLog {uid}>".format(uid=self.uid)
