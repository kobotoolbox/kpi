# coding: utf-8
from django.contrib import admin
from django.db import models


class BaseRegionService(models.Model):

    class Meta:
        abstract = True
        ordering = ['name']

    # Name of service (e.g.: Google)
    name = models.CharField(max_length=100)
    # Unique identifier (e.g.: GOOG)
    permissions = models.CharField(max_length=1000, unique=True)
    countries = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return f'{self.name}'


class BaseRegionServiceAdmin(admin.ModelAdmin):

    list_display = ['name', 'countries', 'permissions']


class BaseRegionServiceM2M(models.Model):

    class Meta:
        abstract = True

    # Custom short language code to map with `Region.code` when
    # service does use the same code
    countries = models.CharField(max_length=1000, null=True, blank=True)
    permissions = models.CharField(max_length=100, null=True, blank=True)
    region = models.ForeignKey('Region', on_delete=models.CASCADE)
