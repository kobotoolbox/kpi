# coding: utf-8
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.apps.logger.models.daily_xform_submission_counter import DailyXFormSubmissionCounter
from kobo.apps.openrosa.apps.logger.models.monthly_xform_submission_counter import MonthlyXFormSubmissionCounter
from kobo.apps.openrosa.apps.logger.tasks import delete_daily_counters
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase


class TestXFormSubmissionCounters(TestBase):

    def setup(self):
        super.setup()

    def test_xform_counter_increments(self):
        """
        Test xform counters increase when an instance is saved
        """
        daily_counters_count = DailyXFormSubmissionCounter.objects.filter(
            xform__user__username='bob'
        ).count()
        self.assertEqual(daily_counters_count, 0)
        monthly_counters_count = MonthlyXFormSubmissionCounter.objects.filter(
            user__username='bob'
        ).count()
        self.assertEqual(monthly_counters_count, 0)

        self._publish_transportation_form_and_submit_instance()
        daily_counters = DailyXFormSubmissionCounter.objects.get(
            xform__user__username='bob'
        )
        self.assertEqual(daily_counters.counter, 1)
        monthly_counters = MonthlyXFormSubmissionCounter.objects.get(
            user__username='bob'
        )
        self.assertEqual(monthly_counters.counter, 1)

    def test_data_retrieval(self):
        """
        Test that the data stored is the same as the data expected
        """
        self._publish_transportation_form_and_submit_instance()

        daily_counter = DailyXFormSubmissionCounter.objects.filter(
            user__username='bob'
        ).order_by('date').last()
        today = timezone.now().date()
        self.assertEqual(daily_counter.date, today)

        monthly_counter = MonthlyXFormSubmissionCounter.objects.filter(
            user__username='bob'
        ).order_by('year', 'month').last()
        self.assertEqual(monthly_counter.month, today.month)
        self.assertEqual(monthly_counter.year, today.year)

    def test_delete_daily_counters(self):
        """
        Test that the delete_daily_counters task deleted counters that are
        more than 31 days old
        """
        self._publish_transportation_form_and_submit_instance()
        counter = DailyXFormSubmissionCounter.objects.filter(
            user__username='bob'
        ).order_by('date').last()
        counter.date = counter.date - timedelta(
            days=settings.DAILY_COUNTERS_MAX_DAYS + 1
        )
        counter.save()
        # There is only one counter because bob is the only one who has
        # submitted a submission
        daily_counters = DailyXFormSubmissionCounter.objects.count()
        self.assertEqual(daily_counters, 1)
        delete_daily_counters()
        daily_counters = DailyXFormSubmissionCounter.objects.count()
        self.assertEqual(daily_counters, 0)

    def test_deleted_monthly_xform_counters_are_merged(self):
        """
        Test that the monthly counter with `xform = NULL` contains the sum of
        counters for all xforms deleted within the current month
        """
        today = timezone.now().date()
        criteria = dict(
            year=today.year,
            month=today.month,
            user=User.objects.get(username='bob'),
            xform=None,
        )
        assert not MonthlyXFormSubmissionCounter.objects.filter(
            **criteria
        ).exists()
        self._publish_transportation_form_and_submit_instance()
        XForm.objects.filter(user__username='bob').first().delete()
        assert (
            MonthlyXFormSubmissionCounter.objects.get(**criteria).counter == 1
        )
        self._publish_transportation_form_and_submit_instance()
        XForm.objects.filter(user__username='bob').first().delete()
        assert (
            MonthlyXFormSubmissionCounter.objects.get(**criteria).counter == 2
        )

    def test_deleted_daily_xform_counters_are_merged(self):
        """
        Test that the daily counter with `xform = NULL` contains the sum of
        counters for all xforms deleted within the current day
        """
        today = timezone.now().date()
        criteria = dict(
            date=today,
            user=User.objects.get(username='bob'),
            xform=None,
        )
        assert not DailyXFormSubmissionCounter.objects.filter(
            **criteria
        ).exists()
        self._publish_transportation_form_and_submit_instance()
        XForm.objects.filter(user__username='bob').first().delete()
        assert (
            DailyXFormSubmissionCounter.objects.get(**criteria).counter == 1
        )
        self._publish_transportation_form_and_submit_instance()
        XForm.objects.filter(user__username='bob').first().delete()
        assert (
            DailyXFormSubmissionCounter.objects.get(**criteria).counter == 2
        )
