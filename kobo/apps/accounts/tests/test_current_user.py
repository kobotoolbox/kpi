from django.urls import reverse
from model_bakery import baker
from rest_framework.test import APITestCase


class CurrentUserAPITestCase(APITestCase):
    def setUp(self):
        self.user = baker.make('auth.User')
        self.client.force_login(self.user)
        self.url = reverse('currentuser-detail')

    def test_identities(self):
        social_accounts = baker.make(
            "socialaccount.SocialAccount", user=self.user, _quantity=2
        )
        other_social_account = baker.make("socialaccount.SocialAccount")
        # This modifies the user account
        self.client.get(self.url)
        with self.assertNumQueries(4):
            res = self.client.get(self.url)
        for social_account in social_accounts:
            self.assertContains(res, social_account.uid)
        self.assertNotContains(res, other_social_account.uid)
