from django.contrib.auth import get_user_model
from django.utils.timezone import now
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.audit_log.models import AuditAction, AuditLog, AuditType
from kobo.apps.audit_log.tests.test_signals import skip_login_access_log
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class ApiAuditLogTestCase(BaseTestCase):

    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        super().setUp()
        self.audit_log_list_url = reverse(self._get_endpoint('audit-log-list'))

    def test_list_as_anonymous(self):
        self.client.logout()
        response = self.client.get(self.audit_log_list_url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_as_regular_user(self):
        self.client.login(username='someuser', password='someuser')
        response = self.client.get(self.audit_log_list_url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_as_staff_user(self):
        someuser = get_user_model().objects.get(username='someuser')
        # Promote someuser as a staff user.
        someuser.is_staff = True
        someuser.save()

        self.client.login(username='someuser', password='someuser')
        response = self.client.get(self.audit_log_list_url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_as_superuser(self):
        someuser = get_user_model().objects.get(username='someuser')
        date_created = now().strftime('%Y-%m-%dT%H:%M:%SZ')
        AuditLog.objects.create(
            user=someuser,
            app_label='foo',
            model_name='bar',
            object_id=1,
            date_created=date_created,
            action=AuditAction.DELETE,
            log_type=AuditType.DATA_EDITING,
        )
        with skip_login_access_log():
            self.client.login(username='admin', password='pass')
        expected = [
            {
                'app_label': 'foo',
                'model_name': 'bar',
                'object_id': 1,
                'user': 'http://testserver/api/v2/users/someuser/',
                'user_uid': someuser.extra_details.uid,
                'action': 'DELETE',
                'metadata': {},
                'date_created': date_created,
                'log_type': 'data-editing',
            },
        ]
        response = self.client.get(self.audit_log_list_url)
        audit_logs_count = AuditLog.objects.count()
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == audit_logs_count
        assert response.data['results'] == expected

    def test_filter_list(self):
        someuser = get_user_model().objects.get(username='someuser')
        anotheruser = get_user_model().objects.get(username='anotheruser')
        date_created = now().strftime('%Y-%m-%dT%H:%M:%SZ')
        AuditLog.objects.create(
            user=someuser,
            app_label='foo',
            model_name='bar',
            object_id=1,
            date_created=date_created,
            action=AuditAction.UPDATE,
            log_type=AuditType.DATA_EDITING,
        )
        AuditLog.objects.create(
            user=anotheruser,
            app_label='foo',
            model_name='bar',
            object_id=1,
            date_created=date_created,
            action=AuditAction.DELETE,
            log_type=AuditType.DATA_EDITING,
        )
        with skip_login_access_log():
            self.client.login(username='admin', password='pass')
        expected = [
            {
                'app_label': 'foo',
                'model_name': 'bar',
                'object_id': 1,
                'user': 'http://testserver/api/v2/users/anotheruser/',
                'user_uid': anotheruser.extra_details.uid,
                'action': 'DELETE',
                'metadata': {},
                'date_created': date_created,
                'log_type': 'data-editing',
            }
        ]
        response = self.client.get(f'{self.audit_log_list_url}?q=action:delete')
        audit_logs_count = AuditLog.objects.count()
        assert response.status_code == status.HTTP_200_OK
        assert audit_logs_count == 2
        assert response.data['count'] == 1
        assert response.data['results'] == expected
