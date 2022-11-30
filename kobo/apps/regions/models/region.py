# coding: utf-8
from django import forms
from django.contrib import admin
from django.db import models

from kobo.static_lists import COUNTRIES
from kpi.constants import (
    PERM_CHANGE_METADATA,
    PERM_VIEW_ASSET,
    PERM_VIEW_PERMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.fields import KpiUidField
from .assignment import AssignmentRegionM2MInline
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


def _get_country_choices():
    return (('*', '*'),) + COUNTRIES


class Region(models.Model):

    uid = KpiUidField(uid_prefix='r')
    name = models.CharField(max_length=200)
    countries = ChoiceArrayField(
        base_field=models.CharField(
            max_length=5, choices=_get_country_choices()
        ),
        default=list,
    )
    permissions = ChoiceArrayField(
        base_field=models.CharField(
            max_length=20, choices=_get_permission_choices()
        ),
        default=list,
    )
    users = models.ManyToManyField(
        'auth.User',
        related_name='regional_views',
        through='AssignmentRegionM2M',
    )

    class Meta:
        verbose_name = 'region'
        ordering = ['name']

    def __str__(self):
        return self.name


class RegionForm(forms.ModelForm):
    class Meta:
        model = Region
        exclude = ('uid',)


class RegionAdmin(admin.ModelAdmin):

    form = RegionForm

    list_display = ('name', 'countries', 'permissions')
    exclude = ('uid',)
    inlines = (AssignmentRegionM2MInline,)
