# coding: utf-8

from django.contrib import admin
from markdownx.admin import MarkdownxModelAdmin

from .models import InAppMessage, InAppMessageFile


class InAppMessageAdmin(MarkdownxModelAdmin):
    readonly_fields = ['uid', 'last_editor']
    def save_model(self, request, obj, form, change):
        obj.last_editor = request.user
        super(InAppMessageAdmin, self).save_model(request, obj, form, change)


admin.site.register(InAppMessage, InAppMessageAdmin)
admin.site.register(InAppMessageFile, admin.ModelAdmin)
