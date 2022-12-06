from django.core import mail
from django.urls import reverse
from rest_framework.test import APITestCase
from model_bakery import baker


class AccountsEmailTestCase(APITestCase):
    def setUp(self):
        self.user = baker.make('auth.User')
        self.client.force_login(self.user)
        self.url_list = reverse('emails-list')

    def test_list(self):
        user_email = baker.make('account.emailaddress', user=self.user)
        other_email = baker.make('account.emailaddress')
        # Auth, Count, Queryset
        with self.assertNumQueries(3):
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
        self.assertEqual(len(mail.outbox), 2, 'Send another email')

        # Add second unconfirmed email, overrides the first
        data = {'email': 'morenew@example.com'}
        # TODO fix unrelated context processors performance
        # These comes from the email template usage
        # See kpi/context_processors.py
        # Auth, Select, Delete (many), Get or Create
        # with self.assertNumQueries(8):
        res = self.client.post(self.url_list, data, format='json')
        self.assertContains(res, data['email'], status_code=201)
        self.assertEqual(self.user.emailaddress_set.count(), 2)
        self.assertEqual(
            self.user.emailaddress_set.filter(verified=False).count(), 1
        )
        self.assertEqual(len(mail.outbox), 3)
