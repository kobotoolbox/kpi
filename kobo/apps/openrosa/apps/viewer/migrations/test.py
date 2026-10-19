# Generated on 2025-01-16 11:58
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.core.management import call_command
from django.db import IntegrityError, connections
from django.db.migrations.recorder import MigrationRecorder
from django.db.models import Q
from django.db.models.query import QuerySet
from taggit.models import Tag, TaggedItem

from kobo.apps.mass_emails.user_queries import get_active_users
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kpi.utils.database import use_db
from kpi.utils.log import logging

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE
TAG = 'submission-time-utc'
FAILED_TAG = 'submission-time-utc-failure'
LAST_XFORM_ID_CACHE_KEY = 'lrm_0033_last_xform_id'



def run():
    """
    Backfills the `root_uuid` field on all `Instance` records that are missing
    it, processing xforms in batches.
    """
    active_users = get_active_users().values('pk')
    format_updated_date = MigrationRecorder.Migration.objects.get(
        app='viewer', name='0008_update_submission_time_format'
    ).applied

    last_xform_id = cache.get(LAST_XFORM_ID_CACHE_KEY, 0)
    print(f'{last_xform_id=}')
    with use_db(settings.OPENROSA_DB_ALIAS):
        # content type id for instance might be different between the databases,
        # make sure we get the kobocat one
        instance_content_type = ContentType.objects.get_for_model(Instance)
        tag = Tag.objects.get_or_create(name=TAG)[0]
        while xforms := get_xforms_queryset(last_xform_id, active_users):
            for xform in xforms:
                logging.info(
                    f'[LRM 0033] - XForm #{xform.pk} ({xform.id_string}) - In Progress'
                )
                error = False
                while instance_pks := get_instances_queryset(
                    xform.pk, format_updated_date
                ):
                    settings.MONGO_DB.instances.update_many(
                        {
                            '_id': {'$in': list(instance_pks)},
                            '_submission_time': {'$not': {'$regex': r'\+00:00$'}},
                        },
                        [
                            {
                                '$set': {
                                    '_submission_time': {
                                        '$concat': ['$_submission_time', '+00:00']
                                    }
                                }
                            }
                        ],
                    )
                    TaggedItem.objects.bulk_create(
                        [
                            TaggedItem(
                                tag=tag,
                                object_id=instance_pk,
                                content_type=instance_content_type,
                            )
                            for instance_pk in instance_pks
                        ],
                        ignore_conflicts=True,
                    )

                if not error:
                    xform.tags.add(TAG)
                else:
                    xform.tags.add(FAILED_TAG)

                logging.info(
                    f'[LRM 0033] - XForm #{xform.pk} ({xform.id_string}) - Done'
                )
                last_xform_id = xform.pk
                cache.set(LAST_XFORM_ID_CACHE_KEY, last_xform_id, timeout=None)

        # Clean up tags while retaining failed entries for future manual review
        TaggedItem.objects.filter(tag__name=TAG).delete()


def get_instances_queryset(xform_id: int, format_updated_date) -> QuerySet:
    return (
        Instance.objects.filter(date_created__lt=format_updated_date, xform_id=xform_id)
        .exclude(Q(tags__name=TAG) | Q(tags__name=FAILED_TAG))
        .values_list('pk', flat=True)[:CHUNK_SIZE]
    )


def get_xforms_queryset(xform_id: int, active_users: list) -> QuerySet:
    # `order_by('pk')` is inexpensive here because `pk` is the primary key and
    # already indexed. Combined with the `CHUNK_SIZE` limit, each batch is
    # fetched quickly without scanning the full table.
    return (
        XForm.objects.filter(pk__gt=xform_id, user_id__in=active_users)
        .exclude(tags__name__contains=TAG)
        .only('pk')
        .order_by('pk')[:CHUNK_SIZE]
    )
