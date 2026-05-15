import csv
import io
from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch

from django.test import TestCase
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.utils import baker_generators  # noqa: registers KpiUidField generator
from kobo.apps.openrosa.apps.logger.models import MonthlyXFormSubmissionCounter
from kobo.apps.superuser_stats.tasks import (
    generate_continued_usage_report,
    generate_domain_report,
    generate_user_report,
    generate_user_statistics_report,
)
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.models.asset import Asset, AssetDeploymentStatus

START_DATE = '2025-01-01'
END_DATE = '2025-12-31'


class GenerateReportsTestCase(TestCase):

    # ------------------------------------------------------------------ #
    # generate_domain_report                                               #
    # ------------------------------------------------------------------ #

    def test_generate_domain_report_headers(self):
        rows = self._run_task_and_get_rows(
            generate_domain_report, START_DATE, END_DATE
        )
        assert rows[0] == ['Email Domain', 'Users', 'Projects', 'Submissions']

    def test_generate_domain_report_aggregates(self):
        user = baker.make(
            User,
            email='alice@example.com',
            date_joined=datetime(2025, 6, 1, tzinfo=timezone.utc),
        )
        baker.make(
            MonthlyXFormSubmissionCounter,
            year=2025,
            month=6,
            user=user,
            counter=42,
            xform=None,
        )
        baker.make(
            Asset,
            owner=user,
            asset_type=ASSET_TYPE_SURVEY,
            date_created=datetime(2025, 6, 1, tzinfo=timezone.utc),
        )

        rows = self._run_task_and_get_rows(
            generate_domain_report, START_DATE, END_DATE
        )

        domain_row = next(r for r in rows[1:] if r[0] == 'example.com')
        assert domain_row[1] == '1'    # 1 user
        assert domain_row[2] == '1'    # 1 asset
        assert domain_row[3] == '42'   # 42 submissions

    def test_generate_domain_report_excludes_out_of_range_users(self):
        baker.make(
            User,
            email='old@example.com',
            date_joined=datetime(2020, 1, 1, tzinfo=timezone.utc),
        )

        rows = self._run_task_and_get_rows(
            generate_domain_report, START_DATE, END_DATE
        )

        domains = [r[0] for r in rows[1:]]
        assert 'example.com' not in domains

    # ------------------------------------------------------------------ #
    # generate_continued_usage_report                                      #
    # ------------------------------------------------------------------ #

    def test_generate_continued_usage_report_headers(self):
        rows = self._run_task_and_get_rows(
            generate_continued_usage_report, END_DATE
        )
        assert rows[0] == [
            'Username', 'Date Joined', 'Last Login',
            'Assets 3m', 'Assets 6m', 'Assets 12m',
            'Submissions 3m', 'Submissions 6m', 'Submissions 12M',
        ]

    def test_generate_continued_usage_report_aggregates(self):
        user = baker.make(
            User,
            last_login=datetime(2025, 6, 1, tzinfo=timezone.utc),
        )
        baker.make(
            MonthlyXFormSubmissionCounter,
            year=2025,
            month=6,
            user=user,
            counter=15,
            xform=None,
        )

        rows = self._run_task_and_get_rows(
            generate_continued_usage_report, END_DATE
        )

        data_row = next(r for r in rows[1:] if r[0] == user.username)
        # 2025-06 falls within the 12-month window ending 2025-12-31
        assert data_row[8] == '15'

    # ------------------------------------------------------------------ #
    # generate_user_statistics_report                                      #
    # ------------------------------------------------------------------ #

    def test_generate_user_statistics_report_headers(self):
        rows = self._run_task_and_get_rows(
            generate_user_statistics_report, START_DATE, END_DATE
        )
        assert rows[0] == [
            'Username', 'Name', 'Date Joined', 'Email',
            'Organization Type', 'Organization', 'Organization Website',
            'Country', 'Submissions Count', 'Forms Count',
            'Deployments Count', 'Google ASR Seconds', 'Google MT Seconds',
        ]

    def test_generate_user_statistics_report_aggregates(self):
        user = baker.make(User, email='bob@test.com')
        baker.make(
            MonthlyXFormSubmissionCounter,
            year=2025,
            month=6,
            user=user,
            counter=20,
            xform=None,
        )
        baker.make(
            NLPUsageCounter,
            date=date(2025, 6, 15),
            user=user,
            asset=None,
            counters={
                'google_asr_seconds': 300,
                'google_mt_characters': 1500,
            },
        )
        asset = baker.make(
            Asset,
            owner=user,
            asset_type=ASSET_TYPE_SURVEY,
            date_created=datetime(2025, 6, 1, tzinfo=timezone.utc),
        )
        # bypass set_deployment_status() which runs on save()
        Asset.objects.filter(pk=asset.pk).update(
            _deployment_status=AssetDeploymentStatus.DEPLOYED
        )

        rows = self._run_task_and_get_rows(
            generate_user_statistics_report, START_DATE, END_DATE
        )

        data_row = next(r for r in rows[1:] if r[0] == user.username)
        assert data_row[8] == '20'    # submissions count
        assert data_row[9] == '1'     # forms count
        assert data_row[10] == '1'    # deployments count
        assert data_row[11] == '300'  # google ASR seconds
        assert data_row[12] == '1500' # google MT characters

    def test_generate_user_statistics_report_no_nlp_counters(self):
        user = baker.make(User, email='charlie@test.com')
        baker.make(
            MonthlyXFormSubmissionCounter,
            year=2025,
            month=3,
            user=user,
            counter=5,
            xform=None,
        )

        rows = self._run_task_and_get_rows(
            generate_user_statistics_report, START_DATE, END_DATE
        )

        data_row = next(r for r in rows[1:] if r[0] == user.username)
        assert data_row[11] == '0'  # google ASR fallback
        assert data_row[12] == '0'  # google MT fallback

    # ------------------------------------------------------------------ #
    # generate_user_report                                                 #
    # ------------------------------------------------------------------ #

    def test_generate_user_report_headers(self):
        rows = self._run_task_and_get_rows(generate_user_report)
        assert rows[0] == [
            'username', 'email', 'pk', 'first_name', 'last_name',
            'name', 'organization', 'XForm count',
            'num_of_submissions', 'date_joined', 'last_login',
        ]

    def test_generate_user_report_includes_user(self):
        _ = baker.make(User, username='diana', email='diana@test.com')

        rows = self._run_task_and_get_rows(generate_user_report)

        usernames = [r[0] for r in rows[1:]]
        assert 'diana' in usernames

    def _run_task_and_get_rows(self, task_func, *args):
        buf = io.StringIO()
        cm = MagicMock()
        cm.__enter__.return_value = buf
        cm.__exit__.return_value = False
        with patch('kobo.apps.superuser_stats.tasks.default_storage') as mock_storage:
            mock_storage.open.return_value = cm
            task_func('output.csv', *args)
        buf.seek(0)
        return list(csv.reader(buf))
