from datetime import datetime, timedelta
from unittest.mock import patch

import pytz
from constance import config

from kobo.apps.openrosa.apps.logger.models.instance import Instance, InstanceHistory
from kobo.apps.openrosa.apps.logger.tasks import delete_expired_instance_history_records
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase


class TestLoggerTasks(TestBase):
    def setUp(self):
        TestBase.setUp(self)
        self._publish_transportation_form()
        for i in range(0, 4):
            self._submit_transport_instance(i)

    def test_delete_expired_instance_history_records(self):
        d0 = datetime(2024, 1, 1, 0, 0, 0, 0, pytz.UTC)
        for i in range(0, 60):
            # TODO: set creation time to values separated by 5 days, since 300 days ago
            record_date = d0 + timedelta(days=i * 5)
            InstanceHistory.objects.create(
                xform_instance=None,
                date_created=record_date,
                date_modified=record_date,
            )
        for instance in Instance.objects.filter(xform=self.xform):
            InstanceHistory.objects.create(
                xform_instance=instance,
                date_created=d0,
                date_modified=d0,
            )

        chunk_size = 5
        max_records = 20
        days_threshold = config.SUBMISSION_HISTORY_GRACE_PERIOD
        with patch(
            'django.utils.timezone.now',
            return_value=d0 + timedelta(days=days_threshold - 1),
        ):
            delete_expired_instance_history_records(chunk_size, max_records)
        assert InstanceHistory.objects.all().count() == 64

        with patch(
            'django.utils.timezone.now',
            return_value=d0 + timedelta(days=days_threshold + 5 * 40),
        ):
            delete_expired_instance_history_records(chunk_size, max_records)
        assert InstanceHistory.objects.all().count() == 44

        max_records = 60
        with patch(
            'django.utils.timezone.now',
            return_value=d0 + timedelta(days=days_threshold + 5 * 61),
        ):
            delete_expired_instance_history_records(chunk_size, max_records)
        assert InstanceHistory.objects.all().count() == 4
        assert InstanceHistory.objects.filter(xform_instance__isnull=False).count() == 4
