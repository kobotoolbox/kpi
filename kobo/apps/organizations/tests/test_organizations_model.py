from django.test import override_settings
from djstripe.enums import BillingScheme
from djstripe.models import Customer
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.tests.utils import generate_plan_subscription
from kpi.tests.kpi_test_case import BaseTestCase

class OrganizationTestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.organization = baker.make(Organization, id='org_abcd1234')
        self.organization.add_user(user=self.user, is_admin=True)
        customer = baker.make(Customer, subscriber=self.organization)
        generate_plan_subscription(self.organization, interval='year')

    @override_settings(STRIPE_ENABLED=True)
    def test_organization_cached_usage(self):
        usage = self.organization.get_cached_usage('asr_seconds')
        assert usage == 0
