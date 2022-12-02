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
        res = self.client.get(self.url_list)
        self.assertContains(res, user_email.email)
        self.assertNotContains(res, other_email.email)

    def test_new_email(self):
        email = baker.make(
            'account.emailaddress', user=self.user, primary=True, verified=True
        )
        data = {'email': 'new@example.com'}
        res = self.client.post(self.url_list, data, format='json')
        self.assertContains(res, data['email'], status_code=201)
        self.assertEqual(self.user.emailaddress_set.count(), 2)
        self.assertEqual(
            self.user.emailaddress_set.filter(verified=False).count(), 1
        )

        res = self.client.post(self.url_list, data, format='json')
        self.assertEqual(res.status_code, 400, "Don't allow duplicate emails")

        data = {'email': 'morenew@example.com'}
        res = self.client.post(self.url_list, data, format='json')
        self.assertContains(res, data['email'], status_code=201)
        self.assertEqual(self.user.emailaddress_set.count(), 2)
        self.assertEqual(
            self.user.emailaddress_set.filter(verified=False).count(), 1
        )
