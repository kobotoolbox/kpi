# coding: utf-8
from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count, DateField, F, Value
from django.db.models.functions import Cast, Concat
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import (
    DailyXFormSubmissionCounter,
    MonthlyXFormSubmissionCounter,
)
from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile
from kobo.apps.openrosa.libs.utils.jsonbfield_helper import ReplaceValues


class Command(BaseCommand):

    help = 'Updates monthly and daily submission counters'

    def add_arguments(self, parser):
        parser.add_argument(
            '--chunks',
            type=int,
            default=2000,
            help='Number of records to process per query',
        )

        days_default = settings.DAILY_COUNTERS_MAX_DAYS
        parser.add_argument(
            '--days',
            type=int,
            default=days_default,
            help=(
                f'Number of days taken into account to populate the counters. '
                f'Default is {days_default}'
            ),
        )

        parser.add_argument(
            '-f', '--force',
            action='store_true',
            default=False,
            help='Recalculate counters for every user. Default is False',
        )

        parser.add_argument(
            '--skip-monthly',
            action='store_true',
            default=False,
            help='Skip updating monthly counters. Default is False',
        )

    def handle(self, *args, **kwargs):
        days = kwargs['days']
        self._chunks = kwargs['chunks']
        self._force = kwargs['force']
        self._verbosity = kwargs['verbosity']
        self._skip_monthly = kwargs['skip_monthly']
        today = timezone.now().date()
        delta = timedelta(days=days)
        date_threshold = today - delta
        # We want to take the first day of the month to get accurate count for
        # monthly counters
        self._date_threshold = date_threshold.replace(day=1)
        if self._verbosity >= 1:
            self.stdout.write(
                f'Daily and monthly counters will be (re)calculated '
                f'since {self._date_threshold.strftime("%Y-%m-%d UTC")}'
            )

        self.release_old_locks()

        # Get profiles whose users' submission counters have not been updated yet.
        subquery = UserProfile.objects.values_list('user_id', flat=True).filter(
            metadata__counters_updates_status='complete'
        )

        for user in (
            User.objects.using(settings.OPENROSA_DB_ALIAS).only('username')
            .exclude(pk=settings.ANONYMOUS_USER_ID)
            .exclude(pk__in=subquery)
            .iterator(chunk_size=self._chunks)
        ):
            if self._verbosity >= 1:
                self.stdout.write(f'Processing user {user.username}...')

            self.suspend_submissions_for_user(user)

            with transaction.atomic():

                self.clean_old_data(user)

                for xf in user.xforms.only('pk', 'id_string').iterator(chunk_size=self._chunks):

                    if self._verbosity >= 2:
                        self.stdout.write(
                            f'\tProcessing XForm {xf.id_string} #{xf.id}'
                        )

                    daily_counters, total_submissions = self.build_counters(xf)
                    self.add_daily_counters(daily_counters)
                    if not self._skip_monthly:
                        self.add_monthly_counters(total_submissions, xf, user)

                self.update_user_profile(user)

        if self._verbosity >= 1:
            self.stdout.write(f'Done!')

    def add_daily_counters(self, daily_counters: list):
        if daily_counters:
            if self._verbosity >= 2:
                self.stdout.write(f'\tInserting daily counters data...')
            DailyXFormSubmissionCounter.objects.bulk_create(
                daily_counters, batch_size=self._chunks
            )
        elif self._verbosity >= 2:
            self.stdout.write(f'\tNo daily counters data...')

    def add_monthly_counters(
        self,
        total_submissions: dict,
        xform: 'logger.XForm',
        user: settings.AUTH_USER_MODEL
    ):
        monthly_counters = []

        for key, total in total_submissions.items():
            year, month = key.split('-')
            monthly_counters.append(MonthlyXFormSubmissionCounter(
                year=year,
                month=month,
                xform_id=xform.pk,
                user_id=user.pk,
                counter=total,
            ))

        if monthly_counters:
            if self._verbosity >= 2:
                self.stdout.write(f'\tInserting monthly counters data...')
            MonthlyXFormSubmissionCounter.objects.bulk_create(
                monthly_counters, batch_size=self._chunks
            )
        elif self._verbosity >= 2:
            self.stdout.write(f'\tNo monthly counters data!')

    def build_counters(self, xf: 'logger.XForm') -> tuple[list, dict]:
        daily_counters = []
        total_submissions = defaultdict(int)

        for values in (
            xf.instances.filter(
                date_created__date__gte=self._date_threshold
            )
            .values('date_created__date')
            .annotate(num_of_submissions=Count('pk'))
            .order_by('date_created__date')
        ):
            submission_date = values['date_created__date']
            daily_counters.append(DailyXFormSubmissionCounter(
                xform_id=xf.pk,
                user=xf.user,
                date=submission_date,
                counter=values['num_of_submissions'],
            ))
            key = (
                f'{submission_date.year}-{submission_date.month}'
            )
            total_submissions[key] += values['num_of_submissions']

        return daily_counters, total_submissions

    def clean_old_data(self, user: settings.AUTH_USER_MODEL):
        # First delete only records covered by desired max days.
        if self._verbosity >= 2:
            self.stdout.write(f'\tDeleting old data...')
        DailyXFormSubmissionCounter.objects.filter(
            xform__user_id=user.pk, date__gte=self._date_threshold
        ).delete()

        if self._skip_monthly:
            return

        # Because we don't have a real date field on `MonthlyXFormSubmissionCounter`
        # but we need to cast `year` and `month` as a date field to
        # compare it with `self._date_threshold`
        MonthlyXFormSubmissionCounter.objects.annotate(
            date=Cast(
                Concat(
                    F('year'), Value('-'), F('month'), Value('-'), 1
                ),
                DateField(),
            )
        ).filter(user_id=user.pk, date__gte=self._date_threshold).delete()

    def suspend_submissions_for_user(self, user: settings.AUTH_USER_MODEL):
        # Retrieve or create user's profile.
        (
            user_profile,
            created,
        ) = UserProfile.objects.get_or_create(user_id=user.pk)

        # Some old profiles don't have metadata
        if user_profile.metadata is None or not isinstance(user_profile.metadata, dict):
            user_profile.metadata = {}

        # Set the flag `submissions_suspended` to true if it is not already.
        if not user_profile.submissions_suspended:
            # We are using the flag `submissions_suspended` to prevent
            # new submissions from coming in while the
            # counters are being calculated.
            user_profile.submissions_suspended = True
            user_profile.save(update_fields=['submissions_suspended'])

    def release_old_locks(self):
        updates = {}

        if self._force:
            updates['counters_updates_status'] = 'not-complete'

        # Release any locks on the users' profile from getting submissions
        UserProfile.objects.all().update(
            metadata=ReplaceValues(
                'metadata',
                updates=updates,
            ),
            submissions_suspended=False,
        )

    def update_user_profile(self, user: settings.AUTH_USER_MODEL):
        # Update user's profile (and lock the related row)
        updates = {
            'counters_updates_status': 'complete',
        }
        UserProfile.objects.filter(
            user_id=user.pk
        ).update(
            metadata=ReplaceValues(
                'metadata',
                updates=updates,
            ),
            submissions_suspended=False,
        )
