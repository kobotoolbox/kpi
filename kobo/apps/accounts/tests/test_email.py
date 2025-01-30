from django.conf import settings
from django.core import mail
from django.urls import reverse
from model_bakery import baker
from rest_framework import status
from rest_framework.test import APITestCase

from kpi.utils.fuzzy_int import FuzzyInt


class AccountsEmailTestCase(APITestCase):
    def setUp(self):
        self.user = baker.make(settings.AUTH_USER_MODEL)
        self.client.force_login(self.user)
        self.url_list = reverse('emailaddress-list')

    def test_list(self):
        user_email = baker.make('account.emailaddress', user=self.user)
        other_email = baker.make('account.emailaddress')
        # Auth, Count, Queryset
        queries = FuzzyInt(3, 5)
        with self.assertNumQueries(queries):
            res = self.client.get(self.url_list)
        self.assertContains(res, user_email.email)
        self.assertNotContains(res, other_email.email)

    def test_new_email(self):
        email = baker.make(
            'account.emailaddress', user=self.user, primary=True, verified=True
        )

        # Add first new unconfirmed email
        data = {'email': 'new@example.com'}
        res = self.client.post(self.url_list, data, format='json')
        self.assertContains(res, data['email'], status_code=201)
        self.assertEqual(self.user.emailaddress_set.count(), 2)
        self.assertEqual(
            self.user.emailaddress_set.filter(verified=False).count(), 1
        )
        self.assertEqual(len(mail.outbox), 1)

        res = self.client.post(self.url_list, data, format='json')
        self.assertEqual(
            self.user.emailaddress_set.filter(verified=False).count(),
            1,
            'Ignore duplicate emails',
        )

        # Add second unconfirmed email, overrides the first
        data = {'email': 'morenew@example.com'}
        # Auth, Select, Delete (many), Get or Create
        queries = FuzzyInt(11, 20)
        with self.assertNumQueries(queries):
            res = self.client.post(self.url_list, data, format='json')
        self.assertContains(res, data['email'], status_code=201)
        self.assertEqual(self.user.emailaddress_set.count(), 2)
        self.assertEqual(
            self.user.emailaddress_set.filter(verified=False).count(), 1
        )
        self.assertEqual(len(mail.outbox), 2)

    def test_delete_email(self):
        baker.make('account.emailaddress', user=self.user)
        primary_email = baker.make(
            'account.emailaddress', user=self.user, verified=True, primary=True
        )

        res = self.client.delete(self.url_list)
        self.assertEqual(res.status_code, 204)
        self.assertEqual(self.user.emailaddress_set.count(), 1)
        self.assertTrue(
            self.user.emailaddress_set.filter(pk=primary_email.pk).exists()
        )

    def test_new_confirm_email(self):
        baker.make(
            'account.emailaddress', user=self.user, primary=True, verified=True
        )
        data = {'email': 'new@example.com'}
        res = self.client.post(self.url_list, data, format='json')
        # Locate confirm URL in email with HMAC value
        for line in mail.outbox[0].body.splitlines():
            if 'confirm-email' in line:
                confirm_url = line.split('testserver')[1].rsplit('/', 1)[0]
        queries = FuzzyInt(15, 20)
        with self.assertNumQueries(queries):
            res = self.client.post(confirm_url + "/")
        self.assertEqual(res.status_code, 302)
        self.assertTrue(
            self.user.emailaddress_set.filter(
                email=data['email'], verified=True
            ).exists(),
            'New email should be confirmed',
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, data['email'])
        self.assertEqual(
            self.user.emailaddress_set.count(),
            1,
            'Expect only 1 email after confirm',
        )


class EmailUpdateRestrictionTestCase(APITestCase):
    """
    Test that only organization owners and admins can update their email.
    """
    def setUp(self):
        self.owner = baker.make(settings.AUTH_USER_MODEL)
        self.admin = baker.make(settings.AUTH_USER_MODEL)
        self.member = baker.make(settings.AUTH_USER_MODEL)
        self.non_mmo_user = baker.make(settings.AUTH_USER_MODEL)

        self.organization = self.owner.organization
        self.organization.mmo_override = True
        self.organization.save(update_fields=['mmo_override'])

        self.organization.add_user(self.admin, is_admin=True)
        self.organization.add_user(self.member)

        self.url_list = reverse('emailaddress-list')

    def test_that_mmo_owner_can_update_email(self):
        """
        Test that the owner of the organization can update their email
        """
        data = {'email': 'owner@example.com'}
        self.client.force_login(self.owner)
        res = self.client.post(self.url_list, data, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            self.owner.emailaddress_set.filter(email=data['email']).count(), 1
        )

    def test_that_mmo_admin_can_update_email(self):
        """
        Test that the admin of the organization can update their email
        """
        data = {'email': 'admin@example.com'}
        self.client.force_login(self.admin)
        res = self.client.post(self.url_list, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            self.admin.emailaddress_set.filter(email=data['email']).count(), 1
        )

    def test_that_mmo_member_cannot_update_email(self):
        """
        Test that the member of the organization cannot update their email
        """
        data = {'email': 'member@example.com'}
        self.client.force_login(self.member)
        res = self.client.post(self.url_list, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self.member.emailaddress_set.filter(email=data['email']).count(), 0
        )

    def test_that_non_mmo_user_can_update_email(self):
        """
        Test that a user who is not part of MMO can update their email
        """
        data = {'email': 'nonmmo@example.com'}
        self.client.force_login(self.non_mmo_user)
        res = self.client.post(self.url_list, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            self.non_mmo_user.emailaddress_set.filter(
                email=data['email']
            ).count(),
            1
        )
