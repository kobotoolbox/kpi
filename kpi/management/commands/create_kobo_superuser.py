import sys
import os

from allauth.account.models import EmailAddress
from django.core.management.base import BaseCommand
from django.db.utils import ProgrammingError

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models import UserProfile


class Command(BaseCommand):

    help = 'Create `superuser` if user does not already exist'

    def handle(self, *args, **options):
        super_username = os.getenv('KOBO_SUPERUSER_USERNAME', 'kobo')
        if User.objects.filter(username=super_username).exists():
            self.stdout.write('User already exists.')
            sys.exit()

        kobocat_database_ready = True
        try:
            user = User.objects.create_superuser(
                super_username,
                os.getenv('KOBO_SUPERUSER_EMAIL', 'kobo@example.com'),
                os.getenv('KOBO_SUPERUSER_PASSWORD', 'kobo'))
        except ProgrammingError:
            # Signals fail when `kc` database doesn't exist yet.
            kobocat_database_ready = False
            user = User.objects.get(username=super_username)
        except Exception as e:
            self.stderr.write(
                'Superuser could not be created.\n' 'Error: {}'.format(str(e))
            )
            sys.exit(1)

        # Validate superuser email address
        EmailAddress.objects.get_or_create(
            user=user,
            email=user.email,
            defaults={'verified': True, 'primary': True},
        )

        if kobocat_database_ready:
            # Create superuser's profile
            UserProfile.objects.get_or_create(
                user_id=user.pk,
                defaults={'validated_password': True},
            )
            self.stdout.write(
                f'Superuser `{super_username}` successfully created.'
            )
        else:
            self.stdout.write(
                f'Superuser `{super_username}` created but not synced to KC database'
            )
