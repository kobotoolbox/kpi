from __future__ import absolute_import
from celery import shared_task
from django.core.management import call_command
from django.conf import settings
from .models import ImportTask, ExportTask

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
