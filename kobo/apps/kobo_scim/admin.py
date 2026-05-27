from django.contrib import admin

from .models import IdentityProvider, ScimGroup


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
        'slug',
        'social_app',
        'scim_api_key',
        'is_active',
        'date_created',
        'date_modified',
    )


@admin.register(ScimGroup)
class ScimGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'idp', 'scim_external_id', 'date_created')
    list_filter = ('idp',)
    search_fields = ('name', 'scim_external_id')
    readonly_fields = (
        'id',
        'idp',
        'name',
        'scim_external_id',
        'members',
        'date_created',
        'date_modified',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
