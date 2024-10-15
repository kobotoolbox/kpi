from unittest import TestCase
from django.urls import include, path, reverse
from django.test import override_settings

from kobo.apps.accounts.serializers import EmailAddressSerializer
from kobo.apps.audit_log.base_views import AuditLoggedModelViewSet
from kobo.apps.kobo_auth.shortcuts import User


from kobo.apps.audit_log.views import AuditLogViewSet
from kobo.settings.base import ROOT_URLCONF
from kpi.models import Asset
from kpi.serializers.v2.asset import AssetSerializer
from kpi.serializers.v2.user import UserSerializer
from kpi.tests.kpi_test_case import KpiTestCase
from rest_framework.routers import DefaultRouter
from rest_framework import permissions
from allauth.account.models import EmailAddress



class DummyViewSet(AuditLoggedModelViewSet):
    permission_classes = (permissions.AllowAny,)
    queryset = EmailAddress.objects.all()
    serializer_class = EmailAddressSerializer
    logged_fields = ['email']

class TestUrls:
    router = DefaultRouter()
    router.register(f'test', DummyViewSet, basename='test-vs')
    urlpatterns = router.urls

@override_settings(ROOT_URLCONF=TestUrls)
class TestAuditLoggedViewSet(KpiTestCase):
    fixtures = ['test_data']

    def test_something(self):
        user = User.objects.get(pk=1)
        email_address, _ = EmailAddress.objects.get_or_create(user=user)
        email_address.primary = True
        email_address.verified = True
        email_address.save()
        response = self.client.patch(reverse('test-vs-detail', args=[email_address.pk]), data={'email': 'thing@gmail.com'})
        breakpoint()

        self.assertEqual(True, False)  # add assertion here

