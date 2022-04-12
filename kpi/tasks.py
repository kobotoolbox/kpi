# coding: utf-8
import requests
from django.conf import settings
from django.core.management import call_command
from rest_framework import status
from rest_framework.reverse import reverse

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
