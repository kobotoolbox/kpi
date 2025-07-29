from collections import defaultdict

from django.contrib import admin
from django.utils.html import linebreaks
from django.utils.safestring import mark_safe

from .models import Invite, Transfer
from .models.invite import InviteType
from .models.transfer import TransferStatusTypeChoices


class InviteTypeFilter(admin.SimpleListFilter):
    # Human-readable title which will be displayed in the
    # right admin sidebar just above the filter options.
    title = 'Invite type'

    # Parameter for the filter that will be used in the URL query.
    parameter_name = 'invite_type'

    def lookups(self, request, model_admin):
        return InviteType.choices

    def queryset(self, request, queryset):
        """
        Returns the filtered queryset based on the value
        provided in the query string and retrievable via
        `self.value()`.
        """
        if self.value():
            return queryset.filter(invite_type=self.value())

        return None


@admin.register(Invite)
class InviteAdmin(admin.ModelAdmin):

    list_filter = [InviteTypeFilter]
    search_fields = [
        'transfers__asset__name',
        'transfers__asset__uid',
    ]

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

    def changelist_view(self, request, extra_context=None):
        response = super().changelist_view(request, extra_context)

        try:
            cl = response.context_data['cl']  # ChangeList instance
            self._get_cached_asset_names_by_invite(list(cl.result_list))
        except (AttributeError, KeyError):
            self._asset_names_by_invite = {}

        return response

    def get_queryset(self, request):
        return Invite.all_objects.all()

    @admin.display(description='Projects')
    def get_projects(self, obj):

        return mark_safe(
           linebreaks('\n'.join(self._asset_names_by_invite.get(obj.id, [])))
        )

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

    def _get_cached_asset_names_by_invite(
        self, paginated_invites: list[Invite]
    ) -> dict[int, list[str]]:
        invite_ids = [invite.pk for invite in paginated_invites]

        rows = (
            Transfer.objects.filter(invite_id__in=invite_ids)
            .select_related('asset')
            .values_list('invite_id', 'asset__name')
        )

        asset_map = defaultdict(list)
        for invite_id, asset_name in rows:
            asset_map[invite_id].append(asset_name or '-')

        self._asset_names_by_invite = dict(asset_map)
