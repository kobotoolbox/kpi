# coding: utf-8
import sys

from django.core.management.base import BaseCommand

from kpi.constants import PERM_VALIDATE_SUBMISSIONS
from ...models import Asset


class Command(BaseCommand):
    """
    Assigns `validate_submissions` permission to every owner
    """
    CHUNK_SIZE = 300

    def __init__(self, stdout=None, stderr=None, no_color=False):

        self.last_progress_message_length = 0
        self.counter = 0
        self.chunk_number = 0
        self.assets_count = 0
        super().__init__(stdout=stdout, stderr=stderr, no_color=no_color)

    def handle(self, *args, **options):
        self.assets_count = Asset.objects.all().count()
        self._get_next_chunk()
        print(" done!")

    def _get_next_chunk(self, last_id=None):

        self.chunk_number += 1
        assets = Asset.objects.all().order_by('pk')
        if last_id:
            assets = assets.filter(pk__gt=last_id)

        assets = assets[:self.CHUNK_SIZE]

        if assets.exists():
            last_id = None
            for asset in assets:
                owner = asset.owner
                if not owner.has_perm(PERM_VALIDATE_SUBMISSIONS, asset):
                    asset.assign_perm(owner, PERM_VALIDATE_SUBMISSIONS)
                self._write_to_stdout()
                last_id = asset.id
            # important to empty assets list to make the GC free some memory
            assets = []
            self._get_next_chunk(last_id)

    def _write_to_stdout(self):
        self.counter += 1
        sys.stdout.write('\b' * self.last_progress_message_length)
        progress_message = ' {}/{} assets (chunk #{})...'.format(
            self.counter, self.assets_count, self.chunk_number)
        self.last_progress_message_length = len(progress_message)
        sys.stdout.write(progress_message)
        sys.stdout.flush()
