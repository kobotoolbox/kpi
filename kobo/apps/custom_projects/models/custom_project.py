# coding: utf-8
from django import forms
from django.contrib import admin
from django.db import models

from kpi.constants import (
    PERM_CHANGE_METADATA,
    PERM_VIEW_ASSET,
    PERM_VIEW_PERMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.fields import KpiUidField
from .assignment import AssignmentCustomProjectM2MInline
from ..fields import ChoiceArrayField


def _get_permission_choices():
    """
    'choices' must be an iterable (e.g., a list or tuple)
    """
    allowed_perms = [
        PERM_CHANGE_METADATA,
        PERM_VIEW_ASSET,
        PERM_VIEW_PERMISSIONS,
        PERM_VIEW_SUBMISSIONS,
    ]
    return [(p, p) for p in allowed_perms]


class CustomProject(models.Model):

    uid = KpiUidField(uid_prefix='cp')
    name = models.CharField(max_length=200)
    countries = models.CharField(max_length=1000)
    permissions = ChoiceArrayField(
        base_field=models.CharField(
            max_length=20, choices=_get_permission_choices()
        ),
        default=list,
    )
    users = models.ManyToManyField(
        'auth.User',
        related_name='custom_projects',
        through='AssignmentCustomProjectM2M',
    )

    class Meta:
        verbose_name = 'custom project view'
        ordering = ['name']

    def __str__(self):
        return self.name

    def get_countries(self):
        return [c.strip().upper() for c in self.countries.split(',')]

    def save(self, *args, **kwargs):
        self.countries = ', '.join(self.get_countries())
        super().save(*args, **kwargs)


class CustomProjectForm(forms.ModelForm):
    class Meta:
        model = CustomProject
        exclude = ('uid',)


class CustomProjectAdmin(admin.ModelAdmin):

    form = CustomProjectForm

    list_display = ('name', 'countries', 'permissions')
    exclude = ('uid',)
    inlines = (AssignmentCustomProjectM2MInline,)
