from collections import Counter, defaultdict

from django.contrib import admin
from django.db.models import Prefetch
from django.urls import reverse
from django.utils.html import escape, format_html, linebreaks
from django.utils.safestring import mark_safe

from .models import Invite, Transfer
from .models.invite import InviteType
from .models.transfer import (
    TransferStatus,
    TransferStatusError,
    TransferStatusTypeChoices,
)


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
            },
        ),
    )

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

    @admin.display(description='Transfers')
    def get_transfers(self, obj):
        # Summary only — the full per-transfer status/error detail lives on the
        # read-only TransferAdmin, linked below. This keeps the invite page
        # readable (org invites can have 100+ transfers) and stops false-positive
        # error noise from reaching support by default.
        status_counts = Counter(
            TransferStatus.objects.filter(
                transfer__invite_id=obj.id,
                status_type=TransferStatusTypeChoices.GLOBAL,
            ).values_list('status', flat=True)
        )
        transfer_total = sum(status_counts.values())
        error_total = TransferStatusError.objects.filter(
            transfer_status__transfer__invite_id=obj.id
        ).count()

        summary = ' · '.join(
            f'{count} {status}' for status, count in sorted(status_counts.items())
        )
        changelist_url = reverse('admin:project_ownership_transfer_changelist')
        link = f'{changelist_url}?invite__id__exact={obj.id}'

        return format_html(
            '{} transfer(s): {} — {} error record(s). '
            '<a href="{}">View transfers</a>',
            transfer_total,
            summary or '—',
            error_total,
            link,
        )

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


@admin.register(Transfer)
class TransferAdmin(admin.ModelAdmin):

    list_display = (
        'uid',
        'get_asset',
        'invite',
        'get_status',
        'date_created',
    )
    list_select_related = ('asset', 'invite')
    search_fields = ('uid', 'asset__uid', 'asset__name', 'invite__uid')
    readonly_fields = ('uid', 'asset', 'invite', 'invite_type', 'get_statuses')
    fields = ('uid', 'asset', 'invite', 'invite_type', 'get_statuses')

    def lookup_allowed(self, lookup, value, request=None):
        # Allow the deep-link from InviteAdmin.get_transfers.
        return lookup == 'invite__id__exact' or super().lookup_allowed(
            lookup, value, request
        )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .prefetch_related(
                Prefetch(
                    'statuses',
                    queryset=TransferStatus.objects.filter(
                        status_type=TransferStatusTypeChoices.GLOBAL
                    ),
                    to_attr='_global_statuses',
                )
            )
        )

    @admin.display(description='Asset')
    def get_asset(self, obj):
        return f'{obj.asset.name} #{obj.asset.uid}'

    @admin.display(description='Status')
    def get_status(self, obj):
        global_statuses = getattr(obj, '_global_statuses', None)
        if global_statuses:
            return global_statuses[0].status
        return obj.status

    @admin.display(description='Statuses')
    def get_statuses(self, obj):
        date_format = '%Y-%m-%d %H:%M:%S'
        html = '<ol>'
        for status in obj.statuses.exclude(
            status_type=TransferStatusTypeChoices.GLOBAL
        ):
            errors = [
                f'[{error.date_created.strftime(date_format)}] - '
                f'{escape(error.error)}'
                for error in status.errors.filter(error__isnull=False)
            ]
            if status.error:
                # legacy deprecated `error` field on TransferStatus
                errors = [escape(status.error)] + errors
            if len(errors) > 100:
                # don't overwhelm the display
                errors = errors[0:100]
                errors.append('...')

            error = '<br/>'.join(errors)
            error = f'<br><span class="error">{error}</span>' if error else ''
            html += f'<li>{status.status_type}: <i>{status.status}</i>{error}</li>'
        html += '</ol>'

        global_errors = []
        for status in obj.statuses.filter(status_type=TransferStatusTypeChoices.GLOBAL):
            global_errors += [
                f'[{error.date_created.strftime(date_format)}] - '
                f'{escape(error.error)}'
                for error in status.errors.filter(error__isnull=False)
            ]
            if status.error:
                # legacy deprecated `error` field on TransferStatus
                global_errors = [escape(status.error)] + global_errors
        if len(global_errors) > 100:
            # don't overwhelm the display
            global_errors = global_errors[0:100]
            global_errors.append('...')

        if global_errors:
            html += (
                '<p><strong>Global errors:</strong><br>'
                f'<span class="error">{"<br/>".join(global_errors)}</span></p>'
            )

        return mark_safe(html)

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
