# coding: utf-8
from django.contrib import admin
from markdownx.admin import MarkdownxModelAdmin

from .models import InAppMessage, InAppMessageFile


class InAppMessageAdmin(MarkdownxModelAdmin):
    new_message_warning = (
        '⚠ Warning: always create a new message, from scratch, to display new '
        'information. If someone has already dismissed a message, editing it '
        'here will not cause it to reappear.'
    )
    drag_drop_warning = (
        '⚠ Warning: Please drag and drop photos directly into the Snippet or '
        'Body boxes. Copying the URL from the in app message files will '
        'likely cause errors.'
    )
    readonly_fields = ['uid', 'last_editor']

    def get_form(self, *args, **kwargs):
        """
        Allows us to add warning messages to the top of the form without
        manually maintaining a list of model fields in this class. An
        approximation of a model-level `help_text`
        """

        # Get the auto-generated form, which will contain the appropriate list
        # of fields, from the superclass
        form = super().get_form(*args, **kwargs)

        # Next, build `fieldsets` using our warning messages and that list of
        # fields. From the Django documentation:
        #     fieldsets is a list of two-tuples…in the format (name,
        #     field_options), where name is a string representing the title of
        #     the fieldset and field_options is a dictionary of information
        #     about the fieldset, including a list of fields to be displayed in
        #     it.
        #     The name is effectively a heading. To use multiple headings as
        #     for warnings, a second field set must be set with with the list
        #     of fields set to an empty string.
        # https://docs.djangoproject.com/en/2.2/ref/contrib/admin/#django.contrib.admin.ModelAdmin.fieldsets
        self.fieldsets = [
            (self.new_message_warning, {'fields': ''}),
            (self.drag_drop_warning, {'fields': form._meta.fields}),
        ]
        return form

    def save_model(self, request, obj, form, change):
        obj.last_editor = request.user
        super().save_model(request, obj, form, change)


admin.site.register(InAppMessage, InAppMessageAdmin)
admin.site.register(InAppMessageFile, admin.ModelAdmin)
