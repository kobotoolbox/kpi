# coding: utf-8
import constance
import requests
from django.conf import settings
from django.core.mail import send_mail
from django.core.management import call_command

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.markdownx_uploader.tasks import remove_unused_markdown_files
from kobo.celery import celery_app
from kpi.constants import LIMIT_HOURS_23
from kpi.maintenance_tasks import remove_old_asset_snapshots, remove_old_import_tasks
from kpi.models.asset import Asset
from kpi.models.import_export_task import (
    ExportTask,
    ImportTask,
    ProjectViewExportTask,
)


@celery_app.task
def import_in_background(import_task_uid):
    import_task = ImportTask.objects.get(uid=import_task_uid)
    import_task.run()


@celery_app.task
def export_in_background(export_task_uid):
    export_task = ExportTask.objects.get(uid=export_task_uid)
    export_task.run()


@celery_app.task
def project_view_export_in_background(
    export_task_uid: str, username: str
) -> None:
    user = User.objects.get(username=username)

    export_task = ProjectViewExportTask.objects.get(uid=export_task_uid)
    export = export_task.run()
    if export.status == 'complete' and export.result:
        file_url = f'{settings.KOBOFORM_URL}{export.result.url}'
        msg = (
            f'Hello {user.username},\n\n'
            f'Your report is complete: {file_url}\n\n'
            'Regards,\n'
            'KoboToolbox'
        )
        send_mail(
            subject='Project View Report Complete',
            message=msg,
            from_email=constance.config.SUPPORT_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )


@celery_app.task
def sync_kobocat_xforms(
    username=None,
    quiet=True,
    populate_xform_kpi_asset_uid=False,
    sync_kobocat_form_media=False,
):
    call_command(
        'sync_kobocat_xforms',
        username=username,
        quiet=quiet,
        populate_xform_kpi_asset_uid=populate_xform_kpi_asset_uid,
        sync_kobocat_form_media=sync_kobocat_form_media,
    )


@celery_app.task
def sync_media_files(asset_uid):
    asset = Asset.objects.get(uid=asset_uid)
    asset.deployment.sync_media_files()


@celery_app.task
def enketo_flush_cached_preview(server_url, form_id):
    """
    Flush a cached preview from Enketo's Redis database to avoid memory
    exhaustion. Uses the endpoint described in
    https://apidocs.enketo.org/v2#/delete-survey-cache.
    Intended to be run with Celery's `apply_async(countdown=…)` shortly after
    preview generation.
    """
    response = requests.delete(
        f'{settings.ENKETO_URL}/{settings.ENKETO_FLUSH_CACHE_ENDPOINT}',
        # bare tuple implies basic auth
        auth=(settings.ENKETO_API_KEY, ''),
        data=dict(server_url=server_url, form_id=form_id),
    )
    response.raise_for_status()



@celery_app.task(time_limit=LIMIT_HOURS_23, soft_time_limit=LIMIT_HOURS_23)
def perform_maintenance():
    """
    Run daily maintenance tasks
    """
    remove_unused_markdown_files()
    remove_old_import_tasks()
    remove_old_asset_snapshots()
