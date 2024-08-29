from kpi.tests.base_test_case import BaseTestCase
from unittest.mock import patch
from django.test import override_settings

class AuditLogTasksTestCase(BaseTestCase):
    @override_settings(ACCESS_LOG_DELETION_BATCH_SIZE=2)
    def test_spawn_new_tasks(self):
        pass
