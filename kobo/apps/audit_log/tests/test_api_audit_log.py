from django.contrib.auth import get_user_model
from django.utils.timezone import now
from rest_framework import status
from rest_framework.reverse import reverse

from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from ..models import AuditLog


class ApiAuditLogTestCase(BaseTestCase):

    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        super().setUp()
        self.audit_log_list_url = reverse('audit-log-list')

    def test_list_as_anonymous(self):
        self.client.logout()
        response = self.client.get(self.audit_log_list_url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_as_regular_user(self):
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
            method='delete'
        )
        self.client.login(username='admin', password='pass')
        expected = [{
            'app_label': 'foo',
            'model_name': 'bar',
            'object_id': 1,
            'user': 'http://testserver/users/someuser/',
            'method': 'DELETE',
            'metadata': {},
            'date_created': date_created,
        }]
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
            method='update',
        )
        AuditLog.objects.create(
            user=anotheruser,
            app_label='foo',
            model_name='bar',
            object_id=1,
            date_created=date_created,
            method='delete',
        )
        self.client.login(username='admin', password='pass')
        expected = [{
            'app_label': 'foo',
            'model_name': 'bar',
            'object_id': 1,
            'user': 'http://testserver/users/anotheruser/',
            'method': 'DELETE',
            'metadata': {},
            'date_created': date_created,
        }]
        response = self.client.get(f'{self.audit_log_list_url}?q=method:delete')
        audit_logs_count = AuditLog.objects.count()
        assert response.status_code == status.HTTP_200_OK
        assert audit_logs_count == 2
        assert response.data['count'] == 1
        assert response.data['results'] == expected
