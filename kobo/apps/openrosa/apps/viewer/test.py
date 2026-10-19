# Generated on 2025-01-16 11:58
from datetime import datetime

from django.conf import settings
from django.core.cache import cache
from django.db.migrations.recorder import MigrationRecorder
from django.db.models.query import QuerySet
from pymongo.errors import PyMongoError

from kobo.apps.mass_emails.user_queries import get_active_users
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kpi.utils.database import use_db
from kpi.utils.log import logging

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE
FAILED_TAG = 'submission-time-utc-failure'
LAST_XFORM_ID_CACHE_KEY = 'lrm_0033_last_xform_id'
LAST_USER_ID_CACHE_KEY = 'lrm_0033_last_user_id'



def run():
    """
    Backfills the `root_uuid` field on all `Instance` records that are missing
    it, processing xforms in batches.
    """
    format_updated_date = MigrationRecorder.Migration.objects.get(
        app='viewer', name='0008_update_submission_time_format'
    ).applied
    last_user_id = cache.get(LAST_USER_ID_CACHE_KEY, 0)
    logging.info(f'{last_user_id=}')
    while active_user_pks := get_active_users_batch(last_user_id, format_updated_date):
        logging.info(f'{active_user_pks=}')
        last_xform_id = cache.get(LAST_XFORM_ID_CACHE_KEY, 0)
        with use_db(settings.OPENROSA_DB_ALIAS):
            # content type id for instance might be different between the databases,
            # make sure we get the kobocat one
            while xforms := get_xforms_queryset(last_xform_id, active_user_pks):
                for xform in xforms:
                    logging.info(
                        f'[LRM 0033] - XForm #{xform.pk} ({xform.id_string}) - In Progress'
                    )
                    error = False
                    last_instance_id_for_form = cache.get(
                        f'{LAST_XFORM_ID_CACHE_KEY}:{xform.id}', 0
                    )
                    while instance_pks := get_instances_queryset(
                        xform.pk, format_updated_date, last_instance_id_for_form
                    ):
                        logging.info(f'{instance_pks=}')
                        try:
                            settings.MONGO_DB.instances.update_many(
                                {
                                    '_id': {'$in': instance_pks},
                                    '_submission_time': {
                                        '$not': {'$regex': r'\+00:00$'}
                                    },
                                },
                                [
                                    {
                                        '$set': {
                                            '_submission_time': {
                                                '$concat': [
                                                    '$_submission_time',
                                                    '+00:00',
                                                ]
                                            }
                                        }
                                    }
                                ],
                            )
                        except PyMongoError:
                            error = True
                        last_instance_id_for_form = instance_pks[-1]
                        logging.info(f'{last_instance_id_for_form=}')
                        cache.set(
                            f'{LAST_XFORM_ID_CACHE_KEY}:{xform.id}',
                            last_instance_id_for_form,
                            timeout=None,
                        )
                    cache.delete(f'{LAST_XFORM_ID_CACHE_KEY}:{xform.id}')

                    if error:
                        xform.tags.add(FAILED_TAG)

                    logging.info(
                        f'[LRM 0033] - XForm #{xform.pk} ({xform.id_string}) - Done'
                    )
                    last_xform_id = xform.pk
                    logging.info(f'{last_xform_id=}')
                    cache.set(LAST_XFORM_ID_CACHE_KEY, last_xform_id, timeout=None)
        last_user_id = active_user_pks[-1]
        logging.info(f'{last_user_id=}')
        cache.set(LAST_USER_ID_CACHE_KEY, last_user_id, timeout=None)


def get_active_users_batch(last_user_id: int, format_updated_date: datetime) -> list:
    return list(
        get_active_users()
        .filter(id__gt=last_user_id, date_joined__lte=format_updated_date)
        .order_by('pk')
        .values_list('pk', flat=True)[:CHUNK_SIZE]
    )


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
        .values_list('pk', flat=True)[:CHUNK_SIZE]
    )
    as_list = list(qs)
    return as_list


def get_xforms_queryset(xform_id: int, active_users: list) -> QuerySet:
    # `order_by('pk')` is inexpensive here because `pk` is the primary key and
    # already indexed. Combined with the `CHUNK_SIZE` limit, each batch is
    # fetched quickly without scanning the full table.
    return (
        XForm.objects.filter(pk__gt=xform_id, user_id__in=active_users)
        .only('pk', 'id_string')
        .order_by('pk')[:CHUNK_SIZE]
    )
