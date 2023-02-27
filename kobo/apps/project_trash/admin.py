from django.contrib import admin

from .models.project_trash import ProjectTrash


class ProjectTrashAdmin(admin.ModelAdmin):

    list_display = ['get_project_name', 'user', 'status']
    ordering = ['-date_created', 'asset__name']
    actions = ['put_back']

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.filter(user__is_active=True)

    @admin.display(description='Project')
    def get_project_name(self, obj):
        asset_uid = obj.metadata.get('uid')
        asset_name = obj.metadata.get('name')
        if not asset_uid or not asset_name:
            # The information should be stored in metadata - which avoids loading
            # Asset object - but in case something is wrong, let's fall back on
            # it.
            return str(obj.asset)
        return f'{asset_name} ({asset_uid})'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.action(description='Put back')
    def put_back(self, request, queryset, **kwargs):
        print('KWARGS', kwargs, flush=True)
        print('queryset', queryset, flush=True)
        print('request', vars(request), flush=True)
        # queryset.update(status='p')


admin.site.register(ProjectTrash, ProjectTrashAdmin)
