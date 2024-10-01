# coding: utf-8
from django.contrib import admin

from kobo.apps.markdownx_uploader.admin import MarkdownxModelAdminBase
from .models import InAppMessage
from .forms import InAppMessageForm


class InAppMessageAdmin(MarkdownxModelAdminBase):

    form = InAppMessageForm
    model = InAppMessage

    new_message_warning = (
        '⚠ Warning: always create a new message, from scratch, to display new '
        'information. If someone has already dismissed a message, editing it '
        'here will not cause it to reappear.'
    )
    readonly_fields = ['uid', 'last_editor']

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.filter(generic_related_objects={})

    def get_fieldsets(self, request, obj=None):
        """
        Allows us to add warning messages to the top of the form without
        manually maintaining a list of model fields in this class. An
        approximation of a model-level `help_text`
        """
        # Next, build `fieldsets` using our warning messages and that list of
        # fields. From the Django documentation:
        #     fieldsets is a list of two-tuples…in the format (name,
        #     field_options), where name is a string representing the title of
        #     the fieldset and field_options is a dictionary of information
        #     about the fieldset, including a list of fields to be displayed in
        #     it.
        #     The name is effectively a heading. To use multiple headings as
        #     for warnings, a second field set must be set with the list
        #     of fields set to an empty string.
        # https://docs.djangoproject.com/en/3.2/ref/contrib/admin/#django.contrib.admin.ModelAdmin.fieldsets

        fieldsets = super().get_fieldsets(request, obj)
        # Only display messages on edit.
        if obj:
            fieldsets.insert(0, (self.new_message_warning, {'fields': ''}))
        return fieldsets

    def save_model(self, request, obj, form, change):
        obj.last_editor = request.user
        super().save_model(request, obj, form, change)


admin.site.register(InAppMessage, InAppMessageAdmin)
