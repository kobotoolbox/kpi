# coding: utf-8
from django.contrib import admin
from django.db import models


class BaseLanguageService(models.Model):

    class Meta:
        abstract = True
        ordering = ['name']

    # Name of service (e.g.: Google)
    name = models.CharField(max_length=100)
    # Unique identifier (e.g.: goog)
    code = models.CharField(max_length=10, unique=True)

    def __str__(self):
        return f'{self.name}'

    def save(
        self,
        force_insert=False,
        force_update=False,
        using=None,
        update_fields=None,
    ):
        if self.code:
            self.code = self.code.lower()

        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )


class BaseLanguageServiceAdmin(admin.ModelAdmin):

    list_display = ['name', 'code']


class BaseLanguageServiceM2M(models.Model):

    class Meta:
        abstract = True

    language = models.ForeignKey('Language', on_delete=models.CASCADE)
    region = models.ForeignKey('LanguageRegion', on_delete=models.CASCADE)
    mapping_code = models.CharField(max_length=10, blank=True, null=True)
