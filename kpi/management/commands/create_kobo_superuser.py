# -*- coding: utf-8 -*-
import sys
import os

from django.core.management.base import BaseCommand
from django.db.utils import ProgrammingError

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models import UserProfile


class Command(BaseCommand):

    help = 'Create `superuser` if user does not already exist'

    def handle(self, *args, **options):
        super_username = os.getenv('KOBO_SUPERUSER_USERNAME', 'kobo')
        if User.objects.filter(username=super_username).count() > 0:
            self.stdout.write('User already exists.')
            sys.exit()

        try:
            user = User.objects.create_superuser(
                os.getenv('KOBO_SUPERUSER_USERNAME', 'kobo'),
                os.getenv('KOBO_SUPERUSER_EMAIL', 'kobo@example.com'),
                os.getenv('KOBO_SUPERUSER_PASSWORD', 'kobo'))
            user.emailaddress_set.create(email=user.email, verified=True, primary=True)
        except ProgrammingError:  # Signals fail when `kc` database
            pass                  # doesn't exist yet.
        except Exception as e:
            self.stdout.write('Superuser could not be created.\n'
                              'Error: {}'.format(str(e)))
        else:
            UserProfile.objects.create(user=user)

        if User.objects.filter(username=super_username).count() > 0:
            self.stdout.write('Superuser successfully created.')
