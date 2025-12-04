from datetime import timedelta

from constance import config
from django.db import DatabaseError, transaction
from django.db.models import DateTimeField, ExpressionWrapper, F, FloatField
from django.db.models.functions import Coalesce, Cast
from django.utils import timezone

from kpi.models.import_export_task import ImportExportStatusChoices
from kpi.utils.log import logging


def delete_expired_exports(export_model, extra_params=None):
    """
    Helper to clean up old export tasks of a given model type
    """
    BATCH_SIZE = 200

    if not extra_params:
        extra_params = {}

    cut_off = timezone.now() - timedelta(minutes=config.EXPORT_CLEANUP_GRACE_PERIOD)
    old_export_ids = (
        export_model.objects.annotate(
            processing_seconds=Coalesce(
                Cast(F('data__processing_time_seconds'), FloatField()), 0.0
            ),
            date_modified=ExpressionWrapper(
                F('date_created') +
                (F('processing_seconds') * 1000) * timedelta(milliseconds=1),
                output_field=DateTimeField(),
            )
        )
        .filter(date_modified__lt=cut_off, **extra_params)
        .exclude(status=ImportExportStatusChoices.PROCESSING)
        .order_by('pk')
        .values_list('pk', flat=True)[:BATCH_SIZE]
    )

    if not old_export_ids:
        logging.info('No old exports to clean up.')
        return

    deleted_count = 0
    for export_id in old_export_ids:
        try:
            with transaction.atomic():
                # Acquire a row-level lock without waiting
                export = (
                    export_model.objects.only('pk', 'uid', 'result')
                    .select_for_update(nowait=True)
                    .get(pk=export_id)
                )

                if export.result:
                    try:
                        export.result.delete(save=False)
                    except Exception as e:
                        logging.error(
                            f'Error deleting file for export {export.uid}: {e}'
                        )
                export.delete()
                deleted_count += 1
        except DatabaseError:
            logging.info(f'Export {export_id} is currently being processed. Skipping.')
    logging.info(f'Cleaned up {deleted_count} old exports.')
