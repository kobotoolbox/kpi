# -*- coding: utf-8 -*-
from importlib import import_module

from django.db import models
from django.utils import timezone
from jsonbfield.fields import JSONField as JSONBField


class HookLog(models.Model):

    hook = models.ForeignKey("Hook", related_name="logs", on_delete=models.CASCADE)
    uid = models.CharField(unique=True, max_length=36)  # Unique ID provided by submitted data
    tries = models.IntegerField(default=0)
    status_code = models.IntegerField(default=200)
    message = models.CharField(default="", max_length=500)
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date_modified"]

    def save(self, *args, **kwargs):
        # Update date_modified each time object is saved
        self.date_modified = timezone.now()
        self.tries += 1
        super(HookLog, self).save(*args, **kwargs)
