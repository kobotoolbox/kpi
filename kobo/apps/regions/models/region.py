# coding: utf-8
from django.contrib import admin
from django.db import models

from kpi.fields import KpiUidField

from .assignments import AssignmentRegionM2MInline


class Region(models.Model):

    uid = KpiUidField(uid_prefix='r')
    name = models.CharField(max_length=200)
    countries = models.JSONField(default=list)
    permissions = models.JSONField(default=list)
    assignments = models.ManyToManyField(
        'Assignment',
        related_name='assignments',
        through='AssignmentRegionM2M',
    )

    class Meta:
        verbose_name = 'region'
        ordering = ['name']

    def __str__(self):
        return self.name


class RegionAdmin(admin.ModelAdmin):

    list_display = ('name', 'countries', 'permissions')
    exclude = ('uid',)
    inlines = (AssignmentRegionM2MInline,)
