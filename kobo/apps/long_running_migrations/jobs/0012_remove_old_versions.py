import time

from django.conf import settings
from django.db.models import Min
from reversion.models import Version

from kpi.utils.log import logging


def run():
    while min_id := Version.objects.aggregate(Min('pk'))['pk__min']:
        queryset = Version.objects.filter(
            pk__lt=min_id + settings.VERSION_DELETION_BATCH_SIZE
        ).only('pk')
        deleted = queryset.delete()
        # log at debug level so we don't flood the logs
        logging.debug(f'Deleted {deleted[0]} version objects with pk < {min_id}')
        time.sleep(2)
