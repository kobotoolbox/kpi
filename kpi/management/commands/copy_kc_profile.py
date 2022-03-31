# coding: utf-8
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from hub.models import ExtraUserDetail
from kpi.deployment_backends.kc_access.utils import get_kc_profile_data


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument(
            '--all-users',
            action='store_true',
            dest='all_users',
            default=False,
            help="Copy all users' profiles"
        )
        parser.add_argument(
            '--username',
            action='store',
            dest='username',
            default=False,
            help="Copy only a specific user's profiles"
        )
        parser.add_argument(
            '--again',
            action='store_true',
            dest='again',
            default=False,
            help='Usually, a KC profile is copied only once per user, '
                 'making it possible for the user to blank out a '
                 'field without having the old value from KC '
                 'reappear. To copy previously copied profiles again, '
                 'use this option'
        )

    def handle(self, *args, **options):
        if options.get('all_users'):
            users = User.objects.all()
        elif options.get('username'):
            users = User.objects.filter(username=options.get('username'))
        else:
            raise CommandError('No users selected!')
        initial_count = users.count()
        if not options.get('again'):
            users = users.exclude(
                extra_details__data__copied_kc_profile=True)
        copied_count = 0
        for user in users:
            extra_details, created = ExtraUserDetail.objects.get_or_create(
                user=user)
            if not extra_details.data.get('copied_kc_profile', False) or \
                    options.get('again'):
                kc_detail = get_kc_profile_data(user.pk)
                for k, v in kc_detail.items():
                    if extra_details.data.get(k, None) is None:
                        extra_details.data[k] = v
                        extra_details.data['copied_kc_profile'] = True
                copied_count += 1
                extra_details.save()
        self.stdout.write('Copied {} profile{}.'.format(
            copied_count, '' if copied_count == 1 else 's'))
        skipped_count = initial_count - copied_count
        if skipped_count:
            self.stdout.write('Skipped {} profile{}.'.format(
                skipped_count, '' if skipped_count == 1 else 's'))
