import re

import dateutil
from constance.test import override_config
from django.conf import settings
from django.core import mail
from django.urls import reverse
from django.utils import timezone
from model_bakery import baker
from rest_framework import status
from rest_framework.test import APITestCase

from kpi.utils.fuzzy_int import FuzzyInt
from kpi.utils.json import LazyJSONSerializable


class CurrentUserAPITestCase(APITestCase):
    def setUp(self):
        self.user = baker.make(settings.AUTH_USER_MODEL, username='spongebob', email='me@sponge.bob')
        self.client.force_login(self.user)
        self.url = reverse('currentuser-detail')

    def test_social_accounts(self):
        social_accounts = baker.make(
            'socialaccount.SocialAccount', user=self.user, _quantity=2
        )
        other_social_account = baker.make('socialaccount.SocialAccount')
        # This modifies the user account
        self.client.get(self.url)
        with self.assertNumQueries(FuzzyInt(3, 5)):
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

    @override_config(
        USER_METADATA_FIELDS=LazyJSONSerializable(
            [{'name': 'organization', 'required': True}]
        )
    )
    def test_validate_extra_detail(self):
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

    # use `override_config` decorator to deactivate all password validators
    # to let this test use a simple password.
    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_validated_password_becomes_true_on_password_change(self):
        self.user.extra_details.validated_password = False
        self.user.extra_details.save(update_fields=['validated_password'])
        assert self.user.extra_details.password_date_changed is None
        data = {
            'email': self.user.email,
        }
        self.client.post(reverse('account_reset_password'), data)
        assert len(mail.outbox) == 1
        assert mail.outbox[0].subject == 'KoboToolbox Password Reset'
        reset_link = re.search(
            r'(?P<url>http://testserver\S+)', mail.outbox[0].body
        ).group('url')
        response = self.client.get(reset_link, follow=True)
        redirection, status_code = response.redirect_chain[0]
        assert status_code == status.HTTP_302_FOUND

        # Reset password
        data = {
            'password1': 'mypassword',
            'password2': 'mypassword',
        }
        now = timezone.now()
        response = self.client.post(redirection, data, follow=True)
        redirection, status_code = response.redirect_chain[0]
        assert status_code == status.HTTP_302_FOUND
        self.user.refresh_from_db()

        # Validate flag is back to True and password change has been tracked
        assert self.user.extra_details.validated_password
        assert self.user.extra_details.password_date_changed is not None
        assert self.user.extra_details.password_date_changed >= now

    def test_accepted_tos(self):
        # Ensure accepted_tos is initially False
        response = self.client.get(self.url)
        assert response.data['accepted_tos'] == False
        assert (
            'last_tos_accept_time' not in self.user.extra_details.private_data
        )

        def now_without_microseconds():
            return timezone.now().replace(microsecond=0)

        # Submit a ToS acceptance request and save the current time
        time_before_signup = now_without_microseconds()
        response = self.client.post(reverse('tos'))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        self.user.refresh_from_db()
        accept_time_str = (
            self.user.extra_details.private_data['last_tos_accept_time']
        )
        accept_time = dateutil.parser.isoparse(accept_time_str)
        assert time_before_signup <= accept_time <= now_without_microseconds()

        # Ensure accepted_tos is now True after accepting ToS
        response = self.client.get(self.url)
        assert response.data['accepted_tos'] == True

    @override_config(
        USER_METADATA_FIELDS=LazyJSONSerializable(
            [
                {'name': 'organization', 'required': True},
                {'name': 'organization_type', 'required': True},
                {'name': 'organization_website', 'required': True},
            ]
        )
    )
    def test_validate_extra_detail_organization_type(self):
        # Validate that a user can submit empty strings for `organization`
        # and `organization_website` if `organization_type` is none
        patch_data = {
            'extra_details': {
                'organization': '',
                'organization_type': 'none',
                'organization_website': '',
            }
        }
        response = self.client.patch(self.url, data=patch_data, format='json')
        assert response.status_code == status.HTTP_200_OK
        response_extra_details = response.json()['extra_details']
        assert response_extra_details['organization'] == ''
        assert response_extra_details['organization_type'] == 'none'
        assert response_extra_details['organization_website'] == ''

        # Validate that a user cannot submit empty strings for `organization`
        # and `organization_website` if `organization_type` is not none
        patch_data = {
            'extra_details': {
                'organization': '',
                'organization_type': 'government',
                'organization_website': '',
            }
        }
        response = self.client.patch(self.url, data=patch_data, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.json() == {
            'extra_details': {
                'organization': 'This field may not be blank.',
                'organization_website': 'This field may not be blank.',
            }
        }

    @override_config(
        USER_METADATA_FIELDS=LazyJSONSerializable(
            [
                {'name': 'organization', 'required': True},
                {'name': 'organization_website', 'required': True},
            ]
        )
    )
    def test_validate_extra_detail_no_organization_type(self):
        # Ensure `organization` and `organization_website` fields behave normally
        # if `organization_type` is not enabled
        patch_data = {
            'extra_details': {
                'organization': 'sample',
                'organization_website': 'sample.org',
            }
        }
        response = self.client.patch(self.url, data=patch_data, format='json')
        assert response.status_code == status.HTTP_200_OK
        response_extra_details = response.json()['extra_details']
        assert response_extra_details['organization'] == 'sample'
        assert response_extra_details['organization_website'] == 'sample.org'
