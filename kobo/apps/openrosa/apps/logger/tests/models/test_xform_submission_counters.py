# coding: utf-8
import os
import threading
from datetime import date, timedelta
from unittest.mock import patch

from django.conf import settings
from django.db import connection, transaction
from django.test import TransactionTestCase
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.apps.logger.models.daily_xform_submission_counter import (
    DailyXFormSubmissionCounter,
)
from kobo.apps.openrosa.apps.logger.models.monthly_xform_submission_counter import (
    MonthlyXFormSubmissionCounter,
)
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


class TestCatchAllCounterLockOrder(TransactionTestCase):
    """
    Deleting several projects of the same owner at once must not deadlock on
    the owner's catch-all counters (`xform = NULL`).

    Real transactions are needed (hence `TransactionTestCase`): each thread
    holds its row locks until it commits, like two concurrent deletions.
    """

    def setUp(self):
        self.user = User.objects.create_user(username='bob', password='bob')
        xml_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'Water_Translated_2011_03_10.xml',
        )
        with open(xml_path) as f:
            xml = f.read()
        self.xform_a = XForm.objects.create(xml=xml, user=self.user)
        self.xform_b = XForm.objects.create(
            xml=xml.replace(
                'id="Water_Translated_2011_03_10"', 'id="Water_Translated_copy"'
            ),
            user=self.user,
        )
        # The owner already has catch-all rows, like in production: deletions
        # then race on updating them
        for month in (1, 2):
            MonthlyXFormSubmissionCounter.objects.create(
                year=2026, month=month, user=self.user, xform=None
            )
        # Without `ORDER BY`, a sequential scan returns rows in insertion
        # order: project A sees January first, project B sees February first
        for xform, months in ((self.xform_a, (1, 2)), (self.xform_b, (2, 1))):
            for month in months:
                MonthlyXFormSubmissionCounter.objects.create(
                    year=2026, month=month, user=self.user, xform=xform, counter=1
                )
                DailyXFormSubmissionCounter.objects.create(
                    date=date(2026, 1, month),
                    user=self.user,
                    xform=xform,
                    counter=1,
                )

    def test_concurrent_deletions_do_not_deadlock(self):
        barrier = threading.Barrier(2, timeout=2)
        calls = threading.local()
        errors = []
        get_or_create = MonthlyXFormSubmissionCounter.objects.get_or_create

        def get_or_create_after_both_hold_a_row(**kwargs):
            # Pause each thread once it holds its first catch-all row, so both
            # transactions are in flight before either moves on
            calls.count = getattr(calls, 'count', 0) + 1
            if calls.count == 2:
                try:
                    barrier.wait()
                except threading.BrokenBarrierError:
                    # The other thread is already queued behind our row lock
                    pass
            return get_or_create(**kwargs)

        def delete_catch_all(xform):
            try:
                with transaction.atomic():
                    self._force_sequential_scan()
                    MonthlyXFormSubmissionCounter.update_catch_all_counter_on_delete(
                        sender=XForm, instance=xform
                    )
            except Exception as e:
                errors.append(e)
            finally:
                connection.close()

        with patch.object(
            MonthlyXFormSubmissionCounter.objects,
            'get_or_create',
            side_effect=get_or_create_after_both_hold_a_row,
        ):
            threads = [
                threading.Thread(target=delete_catch_all, args=(xform,))
                for xform in (self.xform_a, self.xform_b)
            ]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=10)

        assert errors == []
        catch_all = MonthlyXFormSubmissionCounter.objects.filter(
            user=self.user, xform=None
        )
        assert dict(catch_all.values_list('month', 'counter')) == {1: 2, 2: 2}

    def test_monthly_catch_all_counters_are_locked_in_date_order(self):
        with transaction.atomic(), patch.object(
            MonthlyXFormSubmissionCounter.objects,
            'get_or_create',
            wraps=MonthlyXFormSubmissionCounter.objects.get_or_create,
        ) as get_or_create:
            self._force_sequential_scan()
            MonthlyXFormSubmissionCounter.update_catch_all_counter_on_delete(
                sender=XForm, instance=self.xform_b
            )

        assert [c.kwargs['month'] for c in get_or_create.call_args_list] == [1, 2]

    def test_daily_catch_all_counters_are_locked_in_date_order(self):
        with transaction.atomic(), patch.object(
            DailyXFormSubmissionCounter.objects,
            'get_or_create',
            wraps=DailyXFormSubmissionCounter.objects.get_or_create,
        ) as get_or_create:
            self._force_sequential_scan()
            DailyXFormSubmissionCounter.update_catch_all_counter_on_delete(
                sender=XForm, instance=self.xform_b
            )

        assert [c.kwargs['date'].day for c in get_or_create.call_args_list] == [
            1,
            2,
        ]

    @staticmethod
    def _force_sequential_scan():
        # Index scans would return rows in key order and hide the problem.
        # `SET LOCAL` only lasts until the end of the current transaction
        with connection.cursor() as cursor:
            cursor.execute('SET LOCAL enable_indexscan = off')
            cursor.execute('SET LOCAL enable_bitmapscan = off')
