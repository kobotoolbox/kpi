from django.contrib.auth.models import User
from django.core import mail
from django.urls import reverse
from model_bakery import baker

from kpi.tests.kpi_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE
from ..models import OrganizationUser


class OrganizationUserTestCase(BaseTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.organization = baker.make(
            "organizations.Organization", id='org_abcd1234'
        )
        self.client.force_login(self.user)
        self.organization.add_user(self.user)
        self.url_list = reverse(
            self._get_endpoint('organization-users-list'),
            kwargs={"organization_id": self.organization.pk},
        )

    def test_list(self):
        org_user = baker.make(
            "organizations.OrganizationUser",
            organization=self.organization,
            _fill_optional=["user"],
        )
        bad_org_user = baker.make("organizations.OrganizationUser")
        with self.assertNumQueries(3):
            res = self.client.get(self.url_list)
        self.assertContains(res, org_user.user_id)
        self.assertNotContains(res, bad_org_user.user_id)

    def test_create(self):
        data = {"is_admin": False, "email": "test@example.com"}
        res = self.client.post(self.url_list, data)
        self.assertContains(res, data["email"], status_code=201)
        self.assertTrue(
            OrganizationUser.objects.get(email=data["email"], user=None)
        )
        self.assertEqual(len(mail.outbox), 1)

    def test_invite_accept(self):
        data = {"is_admin": False, "email": "test@example.com"}
        res = self.client.post(self.url_list, data)
        body = mail.outbox[0].body
        token = body[body.find("invitations/") :].split("/")[1]
        