from django.contrib import admin, messages
from django.contrib.admin import helpers
from django.template.response import TemplateResponse
from django.urls import reverse
from django_celery_beat.admin import PeriodicTaskAdmin as BasePeriodicTaskAdmin
from django_celery_beat.models import PeriodicTask
from kombu.utils.json import dumps, loads

from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.apps.logger.utils.attachment_restore import (
    get_project_xform,
)

# Tasks launched by hand from here against one project: they take an
# `asset_uid` and mail their log to whoever launched them. Listing them by name,
# rather than inspecting every task for those arguments, keeps this from quietly
# changing how an unrelated task behaves
TASKS_RUN_ON_A_PROJECT = {
    'kobo.apps.openrosa.apps.logger.tasks.restore_soft_deleted_attachments',
}


@admin.register(XForm)
class FormAdmin(admin.ModelAdmin):
    exclude = ('user',)
    list_display = ('id_string', 'downloadable', 'shared')

    # A user should only see forms that belong to him.
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(user=request.user)


class PeriodicTaskAdmin(BasePeriodicTaskAdmin):
    """
    Check the project a hand-launched task was pointed at, and let the task
    report back to the person who launched it.

    Support runs some jobs from here by filling their arguments in and hitting
    "Run selected tasks". Without this, a typo in `asset_uid` would queue a task
    that fails out of sight, and the only place that knows who asked for the run
    is this action, which holds the request.

    The change form grows a button of its own, so that filling the arguments in
    and launching are one gesture rather than a detour through the list. Django
    saves before `response_change()`, so that button runs what was just typed.
    """

    change_form_template = 'admin/logger/periodic_task_change_form.html'

    def render_change_form(self, request, context, *args, obj=None, **kwargs):
        # The extra button only belongs to the tasks it knows how to check
        context['run_on_a_project'] = bool(obj and obj.task in TASKS_RUN_ON_A_PROJECT)

        return super().render_change_form(request, context, *args, obj=obj, **kwargs)

    def response_change(self, request, obj):
        if '_run_task' not in request.POST:
            return super().response_change(request, obj)

        # Reuse the action wholesale, so that the project check, the address
        # and the confirmation page cannot drift between the two doors
        response = self.run_tasks(request, self.model.objects.filter(pk=obj.pk))

        return response or super().response_change(request, obj)

    def run_tasks(self, request, queryset):
        runnable = []
        confirmable = []
        changed_since_confirmed = []
        confirmed = request.POST.get('run_confirmed') == 'yes'

        for periodic_task in queryset:
            if periodic_task.task not in TASKS_RUN_ON_A_PROJECT:
                runnable.append(periodic_task)
                continue

            saved_kwargs = periodic_task.kwargs
            kwargs = loads(saved_kwargs)

            try:
                self._check_project(kwargs.get('asset_uid'))
            except ValueError as e:
                self.message_user(
                    request,
                    f'"{periodic_task.name}" was not run: {e}',
                    level=messages.ERROR,
                )
                continue

            # Compared before the address is added below, since the page sent
            # back what the row held, not what was about to be queued
            if (
                confirmed
                and self._get_confirmed_kwargs(request, periodic_task) != kwargs
            ):
                changed_since_confirmed.append(periodic_task)

            # Never override an address that was filled in on purpose, and do
            # not invent one for an account that has none
            if not kwargs.get('email_to') and request.user.email:
                kwargs['email_to'] = request.user.email

                # Only the copy handed to `super()` is changed. Saving the row
                # would store the address for every later run and would make
                # Beat reload its whole schedule
                periodic_task.kwargs = dumps(kwargs)

            runnable.append(periodic_task)
            confirmable.append((periodic_task, kwargs, saved_kwargs))

        if not runnable:
            return

        for periodic_task in changed_since_confirmed:
            self.message_user(
                request,
                f'"{periodic_task.name}" was changed after you confirmed it.'
                f' Check what it will run now before confirming again.',
                level=messages.WARNING,
            )

        # A single row is shared by everyone, so the arguments read here are
        # whoever saved last, not what this person had on screen. Show them
        # what is about to run before it does, and show them again if somebody
        # saved the row while they were reading.
        if confirmable and (not confirmed or changed_since_confirmed):
            opts = self.model._meta

            return TemplateResponse(
                request,
                'admin/run_tasks_confirmation.html',
                {
                    **self.admin_site.each_context(request),
                    'title': 'Run selected tasks',
                    'confirmable': confirmable,
                    'queryset': queryset,
                    'action_checkbox_name': helpers.ACTION_CHECKBOX_NAME,
                    # Named rather than left to the current URL, which is the
                    # change form when the button on it is what got us here,
                    # and only the changelist dispatches an action
                    'action_url': reverse(
                        f'{self.admin_site.name}:'
                        f'{opts.app_label}_{opts.model_name}_changelist'
                    ),
                },
            )

        # `super()` iterates and indexes what it is given, so a list does, and
        # handing the queryset back would have it read the unedited rows from
        # the database again
        super().run_tasks(request, runnable)

    def _check_project(self, asset_uid: str):
        """
        Fail loudly on a project that cannot be worked on, rather than let the
        task discover it once it is out of sight.
        """

        if not asset_uid:
            raise ValueError('no `asset_uid` is set in its keyword arguments')

        get_project_xform(asset_uid)

    def _get_confirmed_kwargs(
        self, request, periodic_task: PeriodicTask
    ) -> dict | None:
        """
        Return the keyword arguments the confirmation page showed for a row, as
        it sent them back.

        They are only ever compared with the row, never run: what gets queued
        is still read from the database, so a tampered form can at worst ask
        for one more confirmation.
        """

        try:
            return loads(request.POST[f'confirmed_kwargs_{periodic_task.pk}'])
        except (KeyError, ValueError):
            return None


# `django_celery_beat` is listed before this app in `INSTALLED_APPS`, so its own
# admin is already registered by the time this module is imported
admin.site.unregister(PeriodicTask)
admin.site.register(PeriodicTask, PeriodicTaskAdmin)
