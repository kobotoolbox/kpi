# coding: utf-8
import time

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.utils import OperationalError


class Command(BaseCommand):
    help = (
        'Repeatedly attempt to connect to the default database, exiting '
        'silently once the connection succeeds, or with an error if a '
        'connection cannot be established'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--retries',
            default=5,
            type=int,
            help=(
                'Try this many times before giving up, waiting 2 seconds '
                'between each attempt'
            ),
        )

    def handle(self, *args, **options):
        for _ in range(options.get('retries')):
            try:
                with connection.cursor() as cursor:
                    return
            except OperationalError as e:
                if str(e).strip().endswith('does not exist'):
                    # OK for our purposes if the database doesn't exist;
                    # knowing that proves we were able to connect
                    return
            time.sleep(2)

        raise CommandError(
            'Retries exceeded; failed to connect to default database'
        )
