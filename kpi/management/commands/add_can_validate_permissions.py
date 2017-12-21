# -*- coding: utf-8 -*-

import sys
from django.core.management.base import BaseCommand

from ...models import Asset


class Command(BaseCommand):
    """
    Assigns `validate_submissions` permission to every owner
    """
    def handle(self, *args, **options):
        assets = Asset.objects.all()
        assets_count = assets.count()
        counter = 0
        last_progress_message_length = 0
        for asset in assets:
            owner = asset.owner
            if not owner.has_perm('validate_submissions', asset):
                asset.assign_perm(owner, 'validate_submissions')

            counter += 1
            sys.stdout.write('\b' * last_progress_message_length)
            progress_message = ' {}/{} assets...'.format(
                counter, assets_count)
            last_progress_message_length = len(progress_message)
            sys.stdout.write(progress_message)
            sys.stdout.flush()
        print(" done!")
