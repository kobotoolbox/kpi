# coding: utf-8
import sys

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


from kpi.deployment_backends.kc_access.utils import grant_kc_model_level_perms
from kpi.utils.permissions import grant_default_model_level_perms


class Command(BaseCommand):
    def handle(self, *args, **options):
        existing_users = User.objects.all()
        existing_users_count = existing_users.count()
        counter = 0
        last_progress_message_length = 0
        for user in existing_users:
            grant_default_model_level_perms(user)
            grant_kc_model_level_perms(user)
            counter += 1
            sys.stdout.write('\b' * last_progress_message_length)
            progress_message = ' {}/{} users...'.format(
                counter, existing_users_count)
            last_progress_message_length = len(progress_message)
            sys.stdout.write(progress_message)
            sys.stdout.flush()
        print(" done!")
