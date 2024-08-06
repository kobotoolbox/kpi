from kpi.tests.base_test_case import BaseTestCase
from django.contrib.auth import get_user_model
from unittest.mock import patch

class AuditLogTestCase(BaseTestCase):
    @patch('kobo.apps.audit_log.signals.AuditLog.create_auth_log_from_request')
    def test_audit_log_created_on_login(self, patched_create):
        user = get_user_model().objects.create_user(
            'user', 'user@example.com', 'pass'
        )
        self.client.login(username='user', password='pass')
        request = patched_create.call_args.args[0]
        self.assertEquals(request.user, user)
        print(f'{vars(request)}')
        assert False
