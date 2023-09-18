from django.conf import settings
from django.contrib import admin


class ExtraUserDetailAdmin(admin.ModelAdmin):
    list_display = ('user',)
    ordering = ('user__username',)
    search_fields = ('user__username',)
    autocomplete_fields = ['user']

    def get_queryset(self, request):
        return (
            super().get_queryset(request).exclude(user_id=settings.ANONYMOUS_USER_ID)
        )
