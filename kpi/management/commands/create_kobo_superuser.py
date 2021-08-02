# -*- coding: utf-8 -*-
import sys
import os

from django.db.utils import ProgrammingError
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand


class Command(BaseCommand):

    help = 'Create `superuser` if user does not already exist'

    def handle(self, *args, **options):
        super_username = os.getenv('KOBO_SUPERUSER_USERNAME', 'kobo')
        if User.objects.filter(username=super_username).count() > 0:
            self.stdout.write('User already exists.')
            sys.exit()

        try:
            User.objects.create_superuser(
                os.getenv('KOBO_SUPERUSER_USERNAME', 'kobo'),
                os.getenv('KOBO_SUPERUSER_EMAIL', 'kobo@example.com'),
                os.getenv('KOBO_SUPERUSER_PASSWORD', 'kobo'))
        except ProgrammingError:  # Signals fail when `kc` database
            pass                  # doesn't exist yet.
        except Exception as e:
            self.stdout.write('Superuser could not be created.\n'
                              'Error: {}'.format(str(e)))

        if User.objects.filter(username=super_username).count() > 0:
            self.stdout.write('Superuser successfully created.')

