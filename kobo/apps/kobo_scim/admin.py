from django.contrib import admin

from .models import IdentityProvider


@admin.register(IdentityProvider)
class IdentityProviderAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'date_created')
    list_filter = ('is_active',)
    search_fields = ('name', 'slug')
    readonly_fields = ('id', 'date_created', 'date_modified')
    prepopulated_fields = {'slug': ('name',)}
    fields = (
        'id',
        'name',
        'social_app',
        'slug',
        'social_app',
        'scim_api_key',
        'is_active',
        'date_created',
        'date_modified',
    )
