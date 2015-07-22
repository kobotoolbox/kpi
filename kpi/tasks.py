from __future__ import absolute_import
from celery import shared_task
from django.core.management import call_command

@shared_task
def update_search_index():
    call_command('update_index', using=['default',], remove=True)
