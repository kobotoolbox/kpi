from django.db import transaction
from markdownx.admin import MarkdownxModelAdmin

from .models import MarkdownxUploaderFileReference


class MarkdownxModelAdminBase(MarkdownxModelAdmin):

    def delete_queryset(self, request, queryset):
        with transaction.atomic():
            object_ids = list(queryset.values_list('pk', flat=True))
            super().delete_queryset(request, queryset)
            MarkdownxUploaderFileReference.objects.filter(
                app_label=self.model._meta.app_label,  # noqa
                model_name=self.model._meta.model_name,  # noqa
                object_id__in=object_ids,
            ).delete()
