from collections import Counter

from django.conf import settings
from django.contrib import admin
from django.db.models import Count, Prefetch
from django.urls import reverse
from django.utils.html import escape, format_html
from django.utils.safestring import mark_safe

from kobo.apps.organizations.models import Organization
from .models import Invite, Transfer
from .models.choices import TransferStatusErrorLevelChoices
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
        'uid',
        'get_project_count',
        'sender',
        'get_recipient',
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
            self._get_cached_organization_names(list(cl.result_list))
        except (AttributeError, KeyError):
            self._organization_names_by_user = {}

        return response

    def get_queryset(self, request):
        return Invite.all_objects.select_related('sender', 'recipient').annotate(
            project_count=Count('transfers')
        )

    @admin.display(description='Projects', ordering='project_count')
    def get_project_count(self, obj):
        return obj.project_count

    @admin.display(description='Recipient')
    def get_recipient(self, obj):
        # Org-membership invites transfer to the organization, not the account.
        if obj.invite_type == InviteType.ORG_MEMBERSHIP:
            return self._organization_names_by_user.get(obj.recipient_id, obj.recipient)
        return obj.recipient

    @admin.display(description='Transfers')
    def get_transfers(self, obj):
        # Summary only; per-transfer detail lives on TransferAdmin, linked below.
        status_counts = Counter(
            TransferStatus.objects.filter(
                transfer__invite_id=obj.id,
                status_type=TransferStatusTypeChoices.GLOBAL,
            ).values_list('status', flat=True)
        )
        transfer_total = sum(status_counts.values())
        # Skipped files (`info`) are not failures and are not counted.
        error_total = TransferStatusError.objects.filter(
            transfer_status__transfer__invite_id=obj.id,
            level=TransferStatusErrorLevelChoices.ERROR,
        ).count()

        summary = ' · '.join(
            f'{count} {status}' for status, count in sorted(status_counts.items())
        )
        changelist_url = reverse('admin:project_ownership_transfer_changelist')
        link = f'{changelist_url}?invite_id={obj.id}'
        log_url = reverse('admin:project_ownership_transferstatuserror_changelist')
        log_link = f'{log_url}?transfer_status__transfer__invite_id={obj.id}'

        return format_html(
            '{} transfer(s): {} — {} error record(s). '
            '<a href="{}">View transfers</a> · <a href="{}">View logs</a>',
            transfer_total,
            summary or '—',
            error_total,
            link,
            log_link,
        )

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def _get_cached_organization_names(self, paginated_invites: list[Invite]):
        # `User.organization` queries per user; resolve the whole page at once.
        recipient_ids = [
            invite.recipient_id
            for invite in paginated_invites
            if invite.invite_type == InviteType.ORG_MEMBERSHIP
        ]

        rows = (
            Organization.objects.filter(organization_users__user_id__in=recipient_ids)
            .order_by('-organization_users__created')
            .values_list('organization_users__user_id', 'name')
        )

        # Same "most recent membership wins" rule as `User.organization`.
        organization_names = {}
        for user_id, name in rows:
            organization_names.setdefault(user_id, name)

        self._organization_names_by_user = organization_names


@admin.register(Transfer)
class TransferAdmin(admin.ModelAdmin):

    list_display = (
        'uid',
        'get_asset',
        'invite',
        'get_status',
        'date_created',
    )
    search_fields = ('uid', 'asset__uid', 'asset__name', 'invite__uid')
    readonly_fields = ('uid', 'asset', 'invite', 'invite_type', 'get_statuses')
    fields = ('uid', 'asset', 'invite', 'invite_type', 'get_statuses')

    def lookup_allowed(self, lookup, value, request=None):
        # Allow the deep-link from InviteAdmin.get_transfers.
        return lookup == 'invite_id' or super().lookup_allowed(lookup, value, request)

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            # `asset.content` can be huge and is never displayed here.
            .select_related('asset', 'invite')
            .defer('asset__content')
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
        html = '<ol>'
        for status in obj.statuses.exclude(
            status_type=TransferStatusTypeChoices.GLOBAL
        ):
            html += (
                f'<li>{status.status_type}: <i>{status.status}</i>'
                f'{self._render_records(status)}</li>'
            )
        html += '</ol>'

        # Global-status errors belong to no sub-task, e.g. an unhandled failure
        # in `transfer_project`.
        global_status = obj.statuses.filter(
            status_type=TransferStatusTypeChoices.GLOBAL
        ).first()
        if global_status and (records := self._render_records(global_status)):
            html += f'<p><strong>Global:</strong>{records}</p>'

        return mark_safe(html)

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def _render_records(self, status) -> str:
        """
        Render a status' errors. Skipped files are not failures and are not
        shown here; they are listed in the log admin.
        """
        date_format = '%Y-%m-%d %H:%M:%S'
        html = ''

        errors = [
            f'[{record.date_created.strftime(date_format)}] - '
            f'{escape(record.error)}'
            for record in status.errors.filter(
                error__isnull=False,
                level=TransferStatusErrorLevelChoices.ERROR,
            )
        ]
        if status.error:
            # legacy deprecated `error` field on TransferStatus
            errors = [escape(status.error)] + errors
        max_logs = settings.PROJECT_OWNERSHIP_MAX_DISPLAYED_LOGS
        if len(errors) > max_logs:
            errors = errors[0:max_logs]
            errors.append('...')
        if errors:
            html += f'<br><span class="error">{"<br/>".join(errors)}</span>'

        return html


@admin.register(TransferStatusError)
class TransferStatusErrorAdmin(admin.ModelAdmin):
    """
    Read-only log of transfer records, filterable per project.
    """

    list_display = (
        'date_created',
        'get_project',
        'get_invite',
        'get_status_type',
        'level',
        'error',
    )
    list_filter = ('level', 'transfer_status__status_type', 'transfer_status__status')
    search_fields = (
        'error',
        'transfer_status__transfer__asset__uid',
        'transfer_status__transfer__asset__name',
        'transfer_status__transfer__invite__uid',
    )
    date_hierarchy = 'date_created'

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            # `asset.content` can be huge and is not displayed here.
            .select_related(
                'transfer_status',
                'transfer_status__transfer',
                'transfer_status__transfer__asset',
                'transfer_status__transfer__invite',
            )
            .defer('transfer_status__transfer__asset__content')
        )

    def lookup_allowed(self, lookup, value, request=None):
        # Allow the deep-links from InviteAdmin and TransferAdmin.
        return lookup in (
            'transfer_status__transfer__invite_id',
            'transfer_status__transfer_id',
        ) or super().lookup_allowed(lookup, value, request)

    @admin.display(description='Invite')
    def get_invite(self, obj):
        return obj.transfer_status.transfer.invite

    @admin.display(description='Project')
    def get_project(self, obj):
        asset = obj.transfer_status.transfer.asset
        return f'{asset.name} #{asset.uid}'

    @admin.display(description='Type')
    def get_status_type(self, obj):
        return obj.transfer_status.status_type

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
