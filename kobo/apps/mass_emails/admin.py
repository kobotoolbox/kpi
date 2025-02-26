from django.contrib import admin

from .models import MassEmailConfig


@admin.register(MassEmailConfig)
class MassEmailConfig(admin.ModelAdmin):

    list_display = ('name', 'date_modified')
    fields = ('name', 'subject', 'template', 'query')
