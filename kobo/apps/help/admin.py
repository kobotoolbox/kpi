# coding: utf-8
from django.contrib import admin
from markdownx.admin import MarkdownxModelAdmin

from .models import InAppMessage, InAppMessageFile


class InAppMessageAdmin(MarkdownxModelAdmin):
    warning_message = (
        '⚠ Warning: always create a new message, from scratch, to display new '
        'information. If someone has already dismissed a message, editing it '
        'here will not cause it to reappear.'
    )
    readonly_fields = ['uid', 'last_editor']

    def get_form(self, *args, **kwargs):
        """
        Allows us to add `warning_message` to the top of the form without
        manually maintaining a list of model fields in this class. An
        approximation of a model-level `help_text`
        """

        # Get the auto-generated form, which will contain the appropriate list
        # of fields, from the superclass
        form = super().get_form(*args, **kwargs)

        # Next, build `fieldsets` using our `warning_message` and that list of
        # fields. From the Django documentation:
        #     fieldsets is a list of two-tuples…in the format (name,
        #     field_options), where name is a string representing the title of
        #     the fieldset and field_options is a dictionary of information
        #     about the fieldset, including a list of fields to be displayed in
        #     it.
        # https://docs.djangoproject.com/en/2.2/ref/contrib/admin/#django.contrib.admin.ModelAdmin.fieldsets
        self.fieldsets = [
            (self.warning_message, {'fields': form._meta.fields}),
        ]
        return form

    def save_model(self, request, obj, form, change):
        obj.last_editor = request.user
        super().save_model(request, obj, form, change)


admin.site.register(InAppMessage, InAppMessageAdmin)
admin.site.register(InAppMessageFile, admin.ModelAdmin)
