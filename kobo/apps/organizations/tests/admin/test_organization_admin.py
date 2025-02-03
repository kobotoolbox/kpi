from django.test import TestCase
from django.urls import reverse

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kpi.constants import PERM_MANAGE_ASSET
from kpi.models.asset import Asset


class TestOrganizationAdminTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        # Create an Organization instance
        self.organization = Organization.objects.create(
            id='org1234', name='Test Organization', mmo_override=True
        )

        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.admin = User.objects.get(username='adminuser')

        self.organization.add_user(self.someuser)  # someuser becomes the owner

        self.asset = Asset.objects.create(owner=self.anotheruser, name='Test Asset')
        self.client.force_login(self.admin)

    def test_adding_member_does_transfer_their_assets(self):
        assert self.organization.organization_users.count() == 1
        assert self.anotheruser.organization != self.organization

        self._manage_user_in_org(remove=False)

        assert self.organization.organization_users.count() == 2
        assert self.anotheruser.organization == self.organization

        self.asset.refresh_from_db()
        assert self.asset.owner == self.organization.owner_user_object
        assert self.asset.owner == self.someuser
        assert self.asset.has_perm(self.anotheruser, PERM_MANAGE_ASSET)

    def test_removing_member_does_revoke_their_perms(self):
        self._manage_user_in_org(remove=False)
        assert self.organization.organization_users.count() == 2
        assert self.anotheruser.organization == self.organization
        assert self.asset.has_perm(self.anotheruser, PERM_MANAGE_ASSET)

        self._manage_user_in_org(remove=True)

        assert self.organization.organization_users.count() == 1
        self.asset.refresh_from_db()
        assert not self.asset.get_perms(self.anotheruser)
        assert self.anotheruser.organization != self.organization

    def _manage_user_in_org(self, remove: bool = False):

        payload = {
            'name': self.organization.name,
            'slug': self.organization.slug,
            'is_active': 'on',
            'mmo_override': 'on',
            'owner-0-id': self.organization.owner.id,
            'owner-0-organization': self.organization.id,
            'owner-TOTAL_FORMS': 1,
            'owner-INITIAL_FORMS': 1,
            'owner-MIN_NUM_FORMS': 0,
            'owner-MAX_NUM_FORMS': 1,
            'organization_users-TOTAL_FORMS': 1,
            'organization_users-INITIAL_FORMS': 0,
            'organization_users-MIN_NUM_FORMS': 0,
            'organization_users-0-user': self.anotheruser.pk,
            'organization_users-0-id': '',
            'organization_users-0-organization': self.organization.id,
            'organization_users-__prefix__-id': '',
            'organization_users-__prefix__-organization': self.organization.id,
        }

        if remove:
            organization_user_id = self.organization.organization_users.get(
                user=self.anotheruser
            ).pk
            payload['organization_users-0-DELETE'] = 'on'
            payload['organization_users-0-id'] = organization_user_id
            payload['organization_users-INITIAL_FORMS'] = 1

        url = reverse(
            'admin:organizations_organization_change',
            kwargs={'object_id': self.organization.id},
        )
        response = self.client.post(url, data=payload, follow=True)
        assert 'was changed successfully' in str(response.content)
        return response
