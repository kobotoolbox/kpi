from django.contrib import admin
from django.utils.html import linebreaks
from django.utils.safestring import mark_safe

from .models import Invite
from .models.transfer import TransferStatusTypeChoices


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

    fieldsets = (
        (
            None,
            {
                'fields': (
                    'sender',
                    'recipient',
                    'status',
                    'invite_type',
                    'date_created',
                )
            },
        ),
        (
            'Transfers',
            {
                'fields': ('get_transfers',),
                'classes': ('kobo-pot-transfers',),
            },
        ),
    )

    class Media:
        css = {'all': ('admin/css/transfers_as_inline.css',)}

    def get_queryset(self, request):
        return Invite.all_objects.all()

    @admin.display(description='Projects')
    def get_projects(self, obj):
        transfers = []
        for transfer in obj.transfers.all():
            transfers.append(transfer.asset.name)
        return mark_safe(linebreaks('\n'.join(transfers)))

    def get_transfers(self, obj):
        html = '<ul>'
        for transfer in obj.transfers.all():
            html += f'<li>{transfer.asset.name} #{transfer.asset.uid}</li>'
            html += '<ol>'
            for status in transfer.statuses.exclude(
                status_type=TransferStatusTypeChoices.GLOBAL
            ):
                error = (
                    f'<br><span class="error">{status.error}</span></i>'
                    if status.error
                    else ''
                )
                html += f'<li>{status.status_type}: <i>{status.status}</i>{error}</li>'
            html += '</ol>'
        html += '</ul>'
        return mark_safe(html)

    get_transfers.short_description = 'Project'

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
