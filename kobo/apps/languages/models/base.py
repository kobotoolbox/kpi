# coding: utf-8
from django.contrib import admin
from django.db import models


class BaseLanguageService(models.Model):

    class Meta:
        abstract = True

    # Name of service (e.g.: Google)
    name = models.CharField(max_length=100)
    # Unique identifier (e.g.: goog)
    code = models.CharField(max_length=10, unique=True)
    # Display order of services (e.g.: 1 comes before 100)
    priority = models.PositiveSmallIntegerField(
        default=100, help_text='Lower values come first'
    )

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

    list_display = ['name', 'code', 'priority']
    list_editable = ['priority']
    ordering = ['priority', 'name']

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ['code']
        return super().get_readonly_fields(request, obj)


class BaseLanguageServiceM2M(models.Model):

    class Meta:
        abstract = True

    language = models.ForeignKey('Language', on_delete=models.CASCADE)
    region = models.ForeignKey('LanguageRegion', on_delete=models.CASCADE)
    mapping_code = models.CharField(max_length=10, blank=True, null=True)
