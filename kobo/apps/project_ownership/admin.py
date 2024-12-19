from django.contrib import admin
from django.utils.html import linebreaks
from django.utils.safestring import mark_safe

from .models import Invite


@admin.register(Invite)
class InviteAdmin(admin.ModelAdmin):

    list_display = (
        'get_projects',
        'sender',
        'recipient',
        'status',
        'invite_type',
        'date_created',
    )

    def get_queryset(self, request):
        return Invite.all_objects.all()

    @admin.display(description='Projects')
    def get_projects(self, obj):
        transfers = []
        for transfer in obj.transfers.all():
            transfers.append(transfer.asset.name)
        return mark_safe(linebreaks('\n'.join(transfers)))

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
