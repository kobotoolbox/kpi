# -*- coding: utf-8 -*-
from importlib import import_module

from django.db import models
from datetime import datetime
from jsonbfield.fields import JSONField as JSONBField

from kpi.fields import KpiUidField


class Hook(models.Model):

    # Export types
    XML = "xml"
    JSON = "json"

    # Authentication levels
    NO_AUTH = "no_auth"
    BASIC_AUTH = "basic_auth"

    # Export types list
    EXPORT_TYPE_CHOICES = (
        (XML, XML),
        (JSON, JSON)
    )

    # Authentication levels list
    SECURITY_LEVEL_CHOICES = (
        (NO_AUTH, NO_AUTH),
        (BASIC_AUTH, BASIC_AUTH)
    )

    asset = models.ForeignKey("kpi.Asset", related_name="hooks", on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix="h")
    name = models.CharField(max_length=255, blank=False)
    endpoint = models.CharField(max_length=500, blank=False)
    active = models.BooleanField(default=True)
    export_type = models.CharField(choices=EXPORT_TYPE_CHOICES, default=JSON, max_length=10)
    security_level = models.CharField(choices=SECURITY_LEVEL_CHOICES, default=NO_AUTH, max_length=10)
    success_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    settings = JSONBField(default=dict)
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        # Update date_modified each time object is saved
        self.date_modified = datetime.now()
        super(Hook, self).save(*args, **kwargs)

    def __unicode__(self):
        return u"%s:%s - %s" % (self.asset, self.name, self.endpoint)

    def get_service_definition(self):
        mod = import_module("hook.services.service_{}".format(self.export_type))
        return getattr(mod, "ServiceDefinition")
