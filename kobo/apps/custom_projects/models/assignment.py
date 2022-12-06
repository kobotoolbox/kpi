# coding: utf-8
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class Assignment(User):
    class Meta:
        proxy = True


class AssignmentAdmin(admin.ModelAdmin):

    list_display = (
        'username',
        'custom_projects_csv',
    )
    search_fields = ('username',)

    @admin.display(description='Custom projects')
    def custom_projects_csv(self, obj):
        return ', '.join([r.name for r in obj.custom_projects.all()])

    def get_queryset(self, request):
        return self.model.objects.exclude(custom_projects__isnull=True)

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class AssignmentCustomProjectM2M(models.Model):

    user = models.ForeignKey('auth.User', null=True, on_delete=models.CASCADE)
    custom_project = models.ForeignKey(
        'CustomProject',
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )


class AssignmentCustomProjectM2MInline(admin.TabularInline):

    verbose_name = 'Assignment'
    verbose_name_plural = 'Assignments'
    fields = ('user', 'custom_project')
    autocomplete_fields = ['user']

    model = AssignmentCustomProjectM2M
    extra = 1
