import threading
from datetime import datetime

from django.conf import settings
from django.core.cache import cache
from django.core.management import CommandParser
from django.core.management.base import BaseCommand
from django.db.migrations.recorder import MigrationRecorder
from django.db.models import QuerySet

from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kpi.utils.mongo_helper import MongoHelper

lock = threading.Lock()
LAST_INSTANCE_CACHE_KEY_PREFIX = 'submission_time_update_last_instance'


def execute_mongo_query(instance_pks):
    MongoHelper.update_many(
        {
            '_id': {'$in': instance_pks},
            # only update instances that don't already have the tz info
            '_submission_time': {'$not': {'$regex': r'\+00:00$'}},
        },
        [
            {
                '_submission_time': {
                    '$concat': [
                        '$_submission_time',
                        '+00:00',
                    ]
                }
            }
        ],
    )


def process_xform(xform, format_updated_date):
    with lock:
        last_instance_id_for_form = cache.get(
            f'{LAST_INSTANCE_CACHE_KEY_PREFIX}:{xform.id}', 0
        )
        while instance_pks := get_instances_queryset(
            xform.pk, format_updated_date, last_instance_id_for_form
        ):
            execute_mongo_query(instance_pks)
            last_instance_id_for_form = instance_pks[-1]
            cache.set(
                f'{LAST_INSTANCE_CACHE_KEY_PREFIX}:{xform.id}',
                last_instance_id_for_form,
                timeout=None,
            )
        cache.delete(f'{LAST_INSTANCE_CACHE_KEY_PREFIX}:{xform.id}')


def get_instances_queryset(
    xform_id: int, format_updated_date: datetime, last_instance_id: int
) -> QuerySet:
    qs = (
        Instance.objects.filter(
            date_created__lt=format_updated_date,
            xform_id=xform_id,
            pk__gt=last_instance_id,
        )
        .order_by('pk')
        .values_list('pk', flat=True)[
            : settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE
        ]
    )
    as_list = list(qs)
    return as_list


class Command(BaseCommand):
    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            '--xform_id',
            required=True,
        )

    def handle(self, *args, **options):
        xform = XForm.objects.get(id_string=options['xform_id'])
        format_updated_date = MigrationRecorder.Migration.objects.get(
            app='viewer', name='0008_update_submission_time_format'
        ).applied
        process_xform(xform, format_updated_date)
