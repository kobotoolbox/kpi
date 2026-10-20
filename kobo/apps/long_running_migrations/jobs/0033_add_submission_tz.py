# Generated on 2025-01-16 11:58

from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from django.db.migrations.recorder import MigrationRecorder
from django.db.models.query import QuerySet

from kobo.apps.mass_emails.user_queries import get_active_users
from kobo.apps.openrosa.apps.logger.models import XForm
from kpi.utils.database import use_db
from kpi.utils.log import logging

LAST_USER_ID_CACHE_KEY = 'lrm_0033_last_user_id'
LAST_XFORM_ID_CACHE_KEY = 'lrm_0033_last_xform_pk'
FAILED_TAG = 'bad'


def run():
    """
    Adds the UTC "00:00" suffix to the _submission_time of all
    active instance mongo documents. An instance is active if its xform belongs
    to an active user
    """

    # submissions created after this date will already have the timezone info
    # in mongo
    format_updated_date = MigrationRecorder.Migration.objects.get(
        app='viewer', name='0008_update_submission_time_format'
    ).applied

    last_user_id = cache.get(LAST_USER_ID_CACHE_KEY, 0)
    user_iterator = (
        get_active_users()
        .only('pk')
        .filter(id__gt=last_user_id, date_joined__lte=format_updated_date)
        .order_by('pk')
        .iterator()
    )
    for user in user_iterator:
        last_xform_pk_for_user = cache.get(f'{LAST_XFORM_ID_CACHE_KEY}_{user.pk}', 0)
        with use_db(settings.OPENROSA_DB_ALIAS):
            while xforms := get_xforms_queryset(last_xform_pk_for_user, user.pk):
                for xform in xforms:
                    logging.info(
                        f'[LRM 0033] - Processing XForm #{xform.pk}, {xform.id_string}'
                    )
                    call_command(
                        'add_tz_information_to_submission_times',
                        xform_id=xform.id_string,
                    )
                    logging.info(
                        f'[LRM 0033] - Finished XForm #{xform.pk}, {xform.id_string}'
                    )
                    last_xform_pk_for_user = xform.pk
                    cache.set(
                        f'{LAST_XFORM_ID_CACHE_KEY}_{user.pk}', last_xform_pk_for_user
                    )
        cache.set(LAST_USER_ID_CACHE_KEY, user.pk, timeout=None)


def get_xforms_queryset(previous_xform_id: int, user_pk) -> QuerySet:
    # `order_by('pk')` is inexpensive here because `pk` is the primary key and
    # already indexed. Combined with the `CHUNK_SIZE` limit, each batch is
    # fetched quickly without scanning the full table.
    return (
        XForm.objects.filter(pk__gt=previous_xform_id, user_id=user_pk)
        .only('pk', 'id_string')
        .order_by('pk')[: settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE]
    )
