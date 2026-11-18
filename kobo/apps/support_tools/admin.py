from functools import partial

from django import forms
from django.contrib import admin, messages
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from kobo.apps.support_tools.models import (
    AttachmentRestoreJob,
    FormVersionsRestoreJob,
    RestoreJobStatus,
)
from kobo.apps.support_tools.tasks import (
    run_attachment_restore_job,
    run_form_versions_restore_job,
)
from kobo.apps.support_tools.utils.helpers import get_project_xform


class RestoreJobForm(forms.ModelForm):
    """
    Refuse a run before it is queued rather than let it fail out of sight.

    The admin builds it for its own model, which says which lock to ask.
    """

    def clean_asset_uid(self):
        asset_uid = self.cleaned_data['asset_uid'].strip()

        try:
            get_project_xform(asset_uid)
        except ValueError as e:
            raise forms.ValidationError(str(e))

        restorer_class = self._meta.model.restorer_class
        if cache.has_key(restorer_class.get_lock_cache_key(asset_uid)):
            raise forms.ValidationError(
                'A run already has this project. Wait for it to report, then'
                ' launch another one to pick up where it stopped.'
            )

        return asset_uid


class RestoreJobAdmin(admin.ModelAdmin):
    """
    Launch a restore on one project, and keep what each run did.

    Adding a row is what queues a run, so a row is never edited afterwards: it
    holds what was asked, who asked for it, and the log the run wrote back. A
    row that stopped short is run again as it is, rather than typed in anew.

    Subclasses name the Celery `task` that serves a row, the `add_fields`
    support fills in, and what the run does to the project in `action_label`.
    """

    action_label = None
    add_fields = ('asset_uid', 'dry_run', 'resume')
    actions = ['run_again']
    form = RestoreJobForm
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
                self.model.objects.filter(pk=job.pk)
                .exclude(status=RestoreJobStatus.PENDING)
                .update(
                    status=RestoreJobStatus.PENDING,
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
            transaction.on_commit(partial(self.task.delay, job.pk))

            self.message_user(
                request,
                f'"{job}" was queued again, adding to its log. It picks up where'
                f' the project stopped, unless the row asked to start over and'
                f' never got to.',
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

        if obj.status == RestoreJobStatus.IN_PROGRESS:
            return 'in progress' if obj.is_running else 'interrupted'

        return obj.get_status_display()

    def get_fields(self, request, obj=None):
        if obj is None:
            return self.add_fields

        # `mode` stands for `dry_run`, read as words rather than as a checkbox
        options = [
            field for field in self.add_fields if field not in ('asset_uid', 'dry_run')
        ]

        return (
            'asset_uid',
            'mode',
            *options,
            'state',
            'scanned',
            *self.model.counter_fields,
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
        transaction.on_commit(lambda: self.task.delay(obj.pk))

        mode = 'report on' if obj.dry_run else self.action_label
        self.message_user(
            request,
            f'Queued. It will {mode} {obj.asset_uid} and write its log on this'
            f' row as it goes.',
            level=messages.INFO,
        )


@admin.register(AttachmentRestoreJob)
class AttachmentRestoreJobAdmin(RestoreJobAdmin):

    action_label = 'restore the attachments of'
    list_display = (
        'asset_uid',
        'mode',
        'state',
        'scanned',
        'restored',
        'created_by',
        'date_created',
    )
    task = run_attachment_restore_job


@admin.register(FormVersionsRestoreJob)
class FormVersionsRestoreJobAdmin(RestoreJobAdmin):

    action_label = 'record the form versions in the submissions of'
    add_fields = ('asset_uid', 'dry_run', 'resume', 'restore_attachments')
    list_display = (
        'asset_uid',
        'mode',
        'state',
        'scanned',
        'updated',
        'created_by',
        'date_created',
    )
    task = run_form_versions_restore_job
