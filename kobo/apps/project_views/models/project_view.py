# coding: utf-8
from __future__ import annotations

from django import forms
from django.conf import settings
from django.contrib import admin
from django.db import models

from kpi.constants import (
    PERM_CHANGE_METADATA_ASSET,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.fields import KpiUidField
from .assignment import AssignmentProjectViewM2MInline
from ..fields import ChoiceArrayField


class ProjectView(models.Model):

    ALLOWED_PERMISSIONS = [
        PERM_CHANGE_METADATA_ASSET,
        PERM_VIEW_ASSET,
        PERM_VIEW_SUBMISSIONS,
    ]

    uid = KpiUidField(uid_prefix='pv')
    name = models.CharField(max_length=200)
    countries = models.CharField(max_length=1000)
    permissions = ChoiceArrayField(
        base_field=models.CharField(
            max_length=25,
            choices=((p, p) for p in ALLOWED_PERMISSIONS),
        ),
        default=list,
    )
    users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='project_views',
        through='AssignmentProjectViewM2M',
    )

    class Meta:
        verbose_name = 'project view'
        ordering = ('name',)

    def __str__(self) -> str:
        return self.name

    def get_countries(self) -> list[str]:
        return [c.strip().upper() for c in self.countries.split(',')]

    def save(self, *args, **kwargs) -> None:
        self.countries = ', '.join(self.get_countries())
        super().save(*args, **kwargs)


class ProjectViewForm(forms.ModelForm):
    class Meta:
        model = ProjectView
        exclude = ('uid',)


class ProjectViewAdmin(admin.ModelAdmin):

    form = ProjectViewForm

    list_display = ('name', 'countries', 'permissions')
    exclude = ('uid',)
    inlines = (AssignmentProjectViewM2MInline,)
