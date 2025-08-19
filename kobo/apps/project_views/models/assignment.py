# coding: utf-8
from __future__ import annotations

from django.conf import settings
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models.query import QuerySet

from rest_framework.request import Request

User = get_user_model()


class Assignment(User):
    class Meta:
        proxy = True


class AssignmentAdmin(admin.ModelAdmin):

    list_display = (
        'username',
        'project_views_csv',
    )
    search_fields = ('username',)

    @admin.display(description='Project views')
    def project_views_csv(self, obj: Assignment) -> str:
        return ', '.join([r.name for r in obj.project_views.all()])

    def get_queryset(self, request: Request) -> QuerySet:
        return self.model.objects.exclude(project_views__isnull=True)

    def has_add_permission(self, request: Request) -> bool:
        return False

    def has_change_permission(
        self, request: Request, obj: Assignment = None
    ) -> bool:
        return False

    def has_delete_permission(
        self, request: Request, obj: Assignment = None
    ) -> bool:
        return False


class AssignmentProjectViewM2M(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.CASCADE)
    project_view = models.ForeignKey(
        'ProjectView',
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )


class AssignmentProjectViewM2MInline(admin.TabularInline):

    verbose_name = 'Assignment'
    verbose_name_plural = 'Assignments'
    fields = ('user', 'project_view')
    autocomplete_fields = ('user',)

    model = AssignmentProjectViewM2M
    extra = 1
