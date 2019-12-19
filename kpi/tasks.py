# coding: utf-8
from celery import shared_task
from django.core.management import call_command

from kpi.models import Asset, ImportTask, ExportTask


@shared_task
def update_search_index():
    call_command('update_index', using=['default',], remove=True)


@shared_task
def import_in_background(import_task_uid):
    import_task = ImportTask.objects.get(uid=import_task_uid)
    import_task.run()


@shared_task
def export_in_background(export_task_uid):
    export_task = ExportTask.objects.get(uid=export_task_uid)
    export_task.run()


@shared_task
def sync_kobocat_xforms(username=None, quiet=True):
    call_command('sync_kobocat_xforms', username=username, quiet=quiet)


@shared_task
def import_survey_drafts_from_dkobo(**kwargs):
    call_command('import_survey_drafts_from_dkobo', **kwargs)


@shared_task
def sync_media_files(asset_uid):
    asset = Asset.objects.get(uid=asset_uid)
    asset.deployment.set_status(asset.deployment.STATUS_NOT_SYNCED)
    asset.deployment.sync_media_files()
    # If no exceptions have been raised, let's tag the deployment has sync'ed
    asset.deployment.set_status(asset.deployment.STATUS_SYNCED)
