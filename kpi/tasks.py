# coding: utf-8
from datetime import timedelta
import constance
import requests

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command
from django.utils.timezone import now
from django.core.mail import send_mail
from rest_framework import serializers

from kobo.celery import celery_app


@celery_app.task
def import_in_background(import_task_uid):
    from kpi.models.import_export_task import ImportTask  # avoid circular imports

    import_task = ImportTask.objects.get(uid=import_task_uid)
    import_task.run()


@celery_app.task
def export_in_background(export_task_uid):
    from kpi.models.import_export_task import ExportTask  # avoid circular imports

    export_task = ExportTask.objects.get(uid=export_task_uid)
    export_task.run()


@celery_app.task
def regional_export_in_background(regional_export_task_uid, username):
    from kpi.models.import_export_task import (
        CustomProjectExportTask,
    )  # avoid circular imports

    user = User.objects.get(username=username)

    regional_export_task = CustomProjectExportTask.objects.get(
        uid=regional_export_task_uid
    )
    export = regional_export_task.run()
    file_location = serializers.FileField().to_representation(export.result)
    file_url = f'{settings.KOBOFORM_URL}{file_location}'
    msg = (
        f'Hello {user.username},\n\n'
        f'Your report is complete: {file_url}\n\n'
        'Regards,\n'
        'KoboToolbox'
    )
    send_mail(
        subject='Custom Project Report Complete',
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
    from kpi.models.asset import Asset  # avoid circular imports

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
        auth=(settings.ENKETO_API_TOKEN, ''),
        data=dict(server_url=server_url, form_id=form_id),
    )
    response.raise_for_status()


@celery_app.task
def remove_asset_snapshots(asset_id: int):
    """
    Temporary task to delete old snapshots.
    TODO remove when kpi#2434 is merged
    """
    call_command(
        'delete_assets_snapshots',
        days=constance.config.ASSET_SNAPSHOT_DAYS_RETENTION,
        asset_id=asset_id,
    )
