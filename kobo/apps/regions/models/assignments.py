# coding: utf-8
from django.contrib import admin
from django.db import models


class Assignment(models.Model):

    user = models.ForeignKey('auth.User', null=True, on_delete=models.CASCADE)
    region = models.ForeignKey(
        'Region',
        related_name='assignment_region',
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )

    class Meta:
        verbose_name = 'assignment'
        ordering = ['user', 'region']

    def __str__(self):
        return self.user.username


class AssignmentAdmin(admin.ModelAdmin):

    list_display = ['user', 'region']


class AssignmentRegionM2M(models.Model):

    user = models.ForeignKey('auth.User', null=True, on_delete=models.CASCADE)
    assignment = models.ForeignKey(
        Assignment, on_delete=models.CASCADE, null=True
    )
    region_assignment = models.ForeignKey(
        'Region',
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )


class AssignmentRegionM2MInline(admin.TabularInline):

    verbose_name = 'Assignment'
    verbose_name_plural = 'Assignments'
    fields = ('user', 'assignment', 'region_assignment')

    model = AssignmentRegionM2M
    extra = 1
