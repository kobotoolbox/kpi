# coding: utf-8
from django.contrib import admin
from django.db import models


class BaseLanguageService(models.Model):

    class Meta:
        abstract = True
        ordering = ['name']

    # Name of service (e.g.: Google)
    name = models.CharField(max_length=100)
    # Unique identifier (e.g.: GOOG)
    code = models.CharField(max_length=10, unique=True)

    def __str__(self):
        return f'{self.name}'


class BaseLanguageServiceAdmin(admin.ModelAdmin):

    list_display = ['name', 'code']


class BaseLanguageServiceM2M(models.Model):

    class Meta:
        abstract = True

    # Custom short language code to map with `Language.code` when
    # service does use the same code
    code = models.CharField(max_length=20, null=True, blank=True)
    language = models.ForeignKey('Language', on_delete=models.CASCADE)
