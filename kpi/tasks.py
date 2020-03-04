# coding: utf-8
from celery import shared_task
from django.core.management import call_command

from kpi.models import ImportTask, ExportTask
from kpi.utils.lock import lock


@shared_task
def import_in_background(import_task_uid):
    import_task = ImportTask.objects.get(uid=import_task_uid)
    import_task.run()


@shared_task
def export_in_background(export_task_uid):
    export_task = ExportTask.objects.get(uid=export_task_uid)
    export_task.run()


@shared_task
@lock(key='sync_kobocat_xforms', timeout=3600 * 24)
def sync_kobocat_xforms(username=None, quiet=True):
    call_command('sync_kobocat_xforms', username=username, quiet=quiet)


@shared_task
@lock(key='remove_s3_orphans', timeout=3600)
def remove_s3_orphans():
    call_command('remove_s3_orphans')


@shared_task
@lock(key='remove_asset_snapshots', timeout=3600)
def remove_asset_snapshots():
    call_command('remove_asset_snapshots')


@shared_task
@lock(key='remove_import_tasks', timeout=3600)
def remove_import_tasks():
    call_command('remove_import_tasks')
