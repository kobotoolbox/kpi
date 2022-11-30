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
        'regional_views_csv',
    )
    search_fields = ('username',)

    @admin.display(description='Regional views')
    def regional_views_csv(self, obj):
        return ', '.join([r.name for r in obj.regional_views.all()])

    def get_queryset(self, request):
        return self.model.objects.exclude(regional_views__isnull=True)

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class AssignmentRegionM2M(models.Model):

    user = models.ForeignKey('auth.User', null=True, on_delete=models.CASCADE)
    region = models.ForeignKey(
        'Region',
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )


class AssignmentRegionM2MInline(admin.TabularInline):

    verbose_name = 'Assignment'
    verbose_name_plural = 'Assignments'
    fields = ('user', 'region')
    autocomplete_fields = ['user']

    model = AssignmentRegionM2M
    extra = 1
