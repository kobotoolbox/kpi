# coding: utf-8
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from kpi.maintenance_tasks import remove_old_import_tasks
from kpi.models import ImportTask
from kpi.tests.base_test_case import BaseTestCase


class AssetImportTaskHousekeepingTest(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.get(username='someuser')

    def test_remove_old_import_tasks(self):
        old_task = ImportTask.objects.create(
            user=self.user,
            data='{}',
        )
        # Because of `auto_date_now`, we cannot specify created_date on creation
        old_task.date_created = timezone.now() - timedelta(days=95)
        old_task.save(update_fields=['date_created'])

        new_task = ImportTask.objects.create(user=self.user, data='{}')

        remove_old_import_tasks()

        assert ImportTask.objects.filter(id=new_task.id).exists()
        assert not ImportTask.objects.filter(id=old_task.id).exists()
