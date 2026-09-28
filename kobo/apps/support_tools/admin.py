from functools import partial

from django import forms
from django.contrib import admin, messages
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.utils.attachment_restore import (
    get_lock_cache_key,
    get_project_xform,
)
from kobo.apps.support_tools.models import (
    AttachmentRestoreJob,
    AttachmentRestoreJobStatus,
)
from kobo.apps.support_tools.tasks import run_attachment_restore_job


class AttachmentRestoreJobForm(forms.ModelForm):
    """
    Refuse a run before it is queued rather than let it fail out of sight.
    """

    class Meta:
        model = AttachmentRestoreJob
        fields = ('asset_uid', 'dry_run', 'resume')

    def clean_asset_uid(self):
        asset_uid = self.cleaned_data['asset_uid'].strip()

        try:
            get_project_xform(asset_uid)
        except ValueError as e:
            raise forms.ValidationError(str(e))

        if cache.has_key(get_lock_cache_key(asset_uid)):
            raise forms.ValidationError(
                'A run already has this project. Wait for it to report, then'
                ' launch another one to pick up where it stopped.'
            )

        return asset_uid


@admin.register(AttachmentRestoreJob)
class AttachmentRestoreJobAdmin(admin.ModelAdmin):
    """
    Launch the attachment restore on one project, and keep what each run did.

    Adding a row is what queues a run, so a row is never edited afterwards: it
    holds what was asked, who asked for it, and the log the run wrote back. A
    row that stopped short is run again as it is, rather than typed in anew.
    """

    actions = ['run_again']
    form = AttachmentRestoreJobForm
    list_display = (
        'asset_uid',
        'mode',
        'state',
        'scanned',
        'restored',
        'created_by',
        'date_created',
    )
    list_filter = ('status', 'dry_run')
    search_fields = ('asset_uid',)
    ordering = ('-date_created',)

    @admin.action(description='Run again')
    def run_again(self, request, queryset):
        """
        Send an unfinished row back to the queue, on the row it already has.

        A run cut short leaves nothing behind but its row: an OOM or a pod
        eviction kills it outright, and one that found the project taken did no
        work at all. Both pick up where the project stopped, so what they need
        is to be launched again, not to be filled in again.
        """

        for job in queryset:
            if job.is_running:
                self.message_user(
                    request,
                    f'"{job}" was not queued: a run still has {job.asset_uid}.',
                    level=messages.ERROR,
                )
                continue

            # Claimed in the database rather than in memory, so that two people
            # hitting the action at once queue one task and not two. A row is
            # served by a single task at a time, which is what lets that task
            # write the row back without rereading it
            claimed = (
                AttachmentRestoreJob.objects.filter(pk=job.pk)
                .exclude(status=AttachmentRestoreJobStatus.PENDING)
                .update(
                    status=AttachmentRestoreJobStatus.PENDING,
                    date_modified=timezone.now(),
                )
            )

            if not claimed:
                self.message_user(
                    request,
                    f'"{job}" was not queued: it is already waiting for a worker.',
                    level=messages.ERROR,
                )
                continue

            # The changelist is wrapped in a transaction too, and `partial`
            # rather than a closure, which would hand every callback the last
            # row of the loop
            transaction.on_commit(partial(run_attachment_restore_job.delay, job.pk))

            self.message_user(
                request,
                f'"{job}" was queued again. It picks up where the project'
                f' stopped, adding to its log.',
                level=messages.INFO,
            )

    @admin.display(description='mode')
    def mode(self, obj) -> str:
        return 'Dry run' if obj.dry_run else 'Write'

    @admin.display(description='state')
    def state(self, obj) -> str:
        """
        Report a run that died without closing its row.

        Only the lock expires on its own, so a row left in progress by an OOM
        or a pod eviction is told apart by the lock being gone, never by the
        column alone.
        """

        if obj.status == AttachmentRestoreJobStatus.IN_PROGRESS:
            return 'in progress' if obj.is_running else 'interrupted'

        return obj.get_status_display()

    def get_fields(self, request, obj=None):
        if obj is None:
            return ('asset_uid', 'dry_run', 'resume')

        return (
            'asset_uid',
            'mode',
            'resume',
            'state',
            'scanned',
            'restored',
            'log',
            'created_by',
            'date_created',
            'date_modified',
        )

    def get_readonly_fields(self, request, obj=None):
        if obj is None:
            return ()

        return self.get_fields(request, obj)

    def has_change_permission(self, request, obj=None):
        # A row is the record of a launch, so it is read back, never edited
        return False

    def save_model(self, request, obj, form, change):
        obj.created_by = request.user
        super().save_model(request, obj, form, change)

        # The admin wraps this in a transaction, so queueing here would race
        # the worker to the row it is about to read
        transaction.on_commit(lambda: run_attachment_restore_job.delay(obj.pk))

        mode = 'report on' if obj.dry_run else 'restore the attachments of'
        self.message_user(
            request,
            f'Queued. It will {mode} {obj.asset_uid} and write its log on this'
            f' row as it goes.',
            level=messages.INFO,
        )
