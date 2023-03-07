import json
import constance
from django.urls import reverse
from model_bakery import baker
from rest_framework import status
from rest_framework.test import APITestCase


class CurrentUserAPITestCase(APITestCase):
    def setUp(self):
        self.user = baker.make('auth.User')
        self.client.force_login(self.user)
        self.url = reverse('currentuser-detail')

    def test_social_accounts(self):
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

    def test_update_extra_detail(self):
        extra_details = self.user.extra_details
        extra_details.data['name'] = 'SpongeBob'
        extra_details.save()
        patch_data = {
            'extra_details': {'organization': 'Trap Remix 10 Hours, Inc.'}
        }
        response = self.client.patch(self.url, data=patch_data, format='json')
        assert response.status_code == status.HTTP_200_OK
        response_extra_details = response.json()['extra_details']
        # What we just set should obviously be there
        assert (
            response_extra_details['organization']
            == 'Trap Remix 10 Hours, Inc.'
        )
        # …and what we didn't touch should still be there as well
        assert response_extra_details['name'] == 'SpongeBob'

    def test_validate_extra_detail(self):
        constance.config.USER_METADATA_FIELDS = json.dumps([
            {'name': 'organization', 'required': True}
        ])

        # Setting an unrelated field should not be subject to validation
        patch_data = {'extra_details': {'name': 'SpongeBob'}}
        response = self.client.patch(self.url, data=patch_data, format='json')
        assert response.status_code == status.HTTP_200_OK
        response_extra_details = response.json()['extra_details']
        assert response_extra_details['name'] == 'SpongeBob'

        # Make sure the validator accepts reasonable values
        patch_data = {
            'extra_details': {'organization': 'Trap Remix 10 Hours, Inc.'}
        }
        response = self.client.patch(self.url, data=patch_data, format='json')
        assert response.status_code == status.HTTP_200_OK
        response_extra_details = response.json()['extra_details']
        assert (
            response_extra_details['organization']
            == 'Trap Remix 10 Hours, Inc.'
        )

        # Make sure the validator, you know, validates and rejects empty
        # strings for required fields
        patch_data = {'extra_details': {'organization': ''}}
        response = self.client.patch(self.url, data=patch_data, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.json() == {
            'extra_details': {'organization': 'This field may not be blank.'}
        }
