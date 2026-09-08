from datetime import timedelta

from django.contrib import admin
from django.db.models import Count, Max, Q
from django.utils import timezone
from import_export_celery.admin_actions import create_export_job_action

from .models import (
    EmailStatus,
    EmailType,
    MassEmailConfig,
    MassEmailJob,
    MassEmailQueryParam,
    MassEmailRecord,
)


class MassEmailQueryParamAdminInline(admin.TabularInline):
    model = MassEmailQueryParam


@admin.register(MassEmailConfig)
class MassEmailConfigAdmin(admin.ModelAdmin):

    inlines = (MassEmailQueryParamAdminInline,)
    list_display = ('name', 'date_modified', 'frequency', 'live')
    fields = ('name', 'subject', 'template', 'query', 'frequency', 'live')
    actions = ['export_recipient_lists']

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.type == EmailType.ONE_TIME:
            if MassEmailRecord.objects.filter(
                email_job__email_config__id=obj.id, status=EmailStatus.ENQUEUED
            ).exists():
                return ('live',)
        return ()

    # wrap the original method so we can give it a clearer name
    @admin.action(description='Export recipient list')
    def export_recipient_lists(self, request, queryset):
        return create_export_job_action(self, request, queryset)


class JobPeriodFilter(admin.SimpleListFilter):

    title = 'period'
    parameter_name = 'period'
    default_lookup = '1m'
    period_days = {
        '1m': 30,
        '3m': 90,
        '6m': 180,
        '1y': 365,
    }

    def lookups(self, request, model_admin):
        return (
            ('1m', 'Last month'),
            ('3m', 'Last 3 months'),
            ('6m', 'Last 6 months'),
            ('1y', 'Last year'),
            ('all', 'All time'),
        )

    def value(self):
        return super().value() or self.default_lookup

    def choices(self, changelist):
        for lookup, title in self.lookup_choices:
            yield {
                'selected': self.value() == lookup,
                'query_string': changelist.get_query_string(
                    {self.parameter_name: lookup}
                ),
                'display': title,
            }

    def queryset(self, request, queryset):
        if self.value() == 'all':
            return queryset
        days = self.period_days.get(self.value(), self.period_days[self.default_lookup])
        cutoff = timezone.now() - timedelta(days=days)
        return queryset.filter(date_created__gte=cutoff)


@admin.register(MassEmailJob)
class MassEmailJobAdmin(admin.ModelAdmin):

    list_display = (
        'email_config',
        'date_created',
        'planned',
        'sent',
        'enqueued',
        'failed',
        'stale',
        'last_sent',
    )
    list_filter = (JobPeriodFilter, 'email_config')
    list_select_related = ('email_config',)
    ordering = ('-date_created',)
    show_facets = admin.ShowFacets.NEVER

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.annotate(
            planned=Count('records'),
            sent=Count('records', filter=Q(records__status=EmailStatus.SENT)),
            enqueued=Count('records', filter=Q(records__status=EmailStatus.ENQUEUED)),
            failed=Count('records', filter=Q(records__status=EmailStatus.FAILED)),
            stale=Count('records', filter=Q(records__status=EmailStatus.STALE)),
            last_sent=Max(
                'records__date_modified', filter=Q(records__status=EmailStatus.SENT)
            ),
        )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description='Planned', ordering='planned')
    def planned(self, obj):
        return obj.planned

    @admin.display(description='Sent', ordering='sent')
    def sent(self, obj):
        return obj.sent

    @admin.display(description='Enqueued', ordering='enqueued')
    def enqueued(self, obj):
        return obj.enqueued

    @admin.display(description='Failed', ordering='failed')
    def failed(self, obj):
        return obj.failed

    @admin.display(description='Stale', ordering='stale')
    def stale(self, obj):
        return obj.stale

    @admin.display(description='Last sent', ordering='last_sent')
    def last_sent(self, obj):
        return obj.last_sent
