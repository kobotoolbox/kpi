from allauth.account.models import EmailAddress
from django.test import override_settings
from django.urls import reverse
from rest_framework import permissions, serializers
from rest_framework.routers import DefaultRouter

from kobo.apps.audit_log.base_views import AuditLoggedModelViewSet
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import KpiTestCase


class DummyEmailSerializer(serializers.ModelSerializer):
    """
    Basic model serializer for EmailAddresses
    """

    class Meta:
        model = EmailAddress
        fields = '__all__'


class DummyViewSet(AuditLoggedModelViewSet):
    """
    DummyViewSet for testing the functionality of the AuditLoggedModelViewSet

    Uses the email address model because it's simple
    """

    log_type = 'dummy'

    permission_classes = (permissions.AllowAny,)
    queryset = EmailAddress.objects.all()
    serializer_class = DummyEmailSerializer
    logged_fields = ['email', 'verified']


class TestUrls:
    """
    Register our DummyViewSet at a test-only url
    """

    router = DefaultRouter()
    router.register(r'test', DummyViewSet, basename='test-vs')
    urlpatterns = router.urls


@override_settings(ROOT_URLCONF=TestUrls)
class TestAuditLoggedViewSet(KpiTestCase):
    fixtures = ['test_data']

    def test_creating_model_records_fields(self):
        response = self.client.post(
            reverse('test-vs-list'), data={'user': 1, 'email': 'new_email@example.com'}
        )
        request = response.wsgi_request
        self.assertDictEqual(
            request.updated_data, {'email': 'new_email@example.com', 'verified': False}
        )

    def test_updating_model_records_fields(self):
        user = User.objects.get(pk=1)
        email_address, _ = EmailAddress.objects.get_or_create(
            user=user, email='initial_email@example.com'
        )
        email_address.save()
        response = self.client.patch(
            reverse('test-vs-detail', args=[email_address.pk]),
            data={'email': 'newer_email@example.com'},
        )
        request = response.wsgi_request
        self.assertEqual(
            request.initial_data,
            {'email': 'initial_email@example.com', 'verified': False},
        )
        self.assertEqual(
            request.updated_data,
            {'email': 'newer_email@example.com', 'verified': False},
        )

    def test_destroying_model_records_fields(self):
        user = User.objects.get(pk=1)
        email_address, _ = EmailAddress.objects.get_or_create(
            user=user, email='initial_email@example.com'
        )
        email_address.save()
        response = self.client.delete(
            reverse('test-vs-detail', args=[email_address.pk])
        )
        request = response.wsgi_request
        self.assertEqual(
            request.initial_data,
            {'email': 'initial_email@example.com', 'verified': False},
        )
