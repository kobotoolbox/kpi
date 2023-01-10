from allauth.account.models import EmailAddress
from django.core import mail
from django.urls import reverse
from model_bakery import baker
from rest_framework.test import APITestCase


class AccountsEmailTestCase(APITestCase):
    def setUp(self):
        self.user = baker.make('auth.User')
        self.client.force_login(self.user)
        self.url_list = reverse('socialaccount-list')

    def test_list(self):
        account1 = baker.make('socialaccount.SocialAccount', user=self.user)
        account2 = baker.make('socialaccount.SocialAccount')
        # Auth, Count, Queryset
        with self.assertNumQueries(3):
            res = self.client.get(self.url_list)
        self.assertContains(res, account1.uid)
        self.assertNotContains(res, account2.uid)

    def test_delete(self):
        account = baker.make('socialaccount.SocialAccount', user=self.user)
        url = reverse(
            'socialaccount-detail',
            kwargs={'pk': f'{account.provider}/{account.uid}'},
        )
        res = self.client.delete(url)
        self.assertEqual(res.status_code, 204)
        self.assertFalse(self.user.socialaccount_set.exists())
