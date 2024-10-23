from django.urls import reverse
from model_bakery import baker
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.constants import (
    ADMIN_ORG_ROLE,
    EXTERNAL_ORG_ROLE,
    MEMBER_ORG_ROLE,
    OWNER_ORG_ROLE,
)
from kpi.constants import ASSET_TYPE_SURVEY, PERM_VIEW_ASSET, PERM_MANAGE_ASSET
from kpi.models.asset import Asset
from kpi.tests.base_test_case import BaseTestCase, BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE
from kpi.utils.fuzzy_int import FuzzyInt


class OrganizationApiTestCase(BaseTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.client.force_login(self.user)
        self.url_list = reverse(self._get_endpoint('organizations-list'))

    def _insert_data(self):
        self.organization = baker.make(Organization, id='org_abcd1234')
        self.organization.add_user(user=self.user, is_admin=True)
        self.url_detail = reverse(
            self._get_endpoint('organizations-detail'),
            kwargs={'id': self.organization.id},
        )

    def test_anonymous_user(self):
        self._insert_data()
        self.client.logout()
        response_list = self.client.get(self.url_list)
        assert response_list.status_code == status.HTTP_401_UNAUTHORIZED
        response_detail = self.client.get(self.url_detail)
        assert response_detail.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create(self):
        data = {'name': 'my org'}
        res = self.client.post(self.url_list, data)
        self.assertContains(res, data['name'], status_code=201)

    def test_list(self):
        self._insert_data()
        organization2 = baker.make(Organization, id='org_abcd123')
        organization2.add_user(user=self.user, is_admin=True)
        with self.assertNumQueries(FuzzyInt(8, 10)):
            res = self.client.get(self.url_list)
        self.assertContains(res, organization2.name)

    def test_list_creates_org(self):
        self.assertFalse(self.user.organizations_organization.all())
        self.client.get(self.url_list)
        self.assertTrue(self.user.organizations_organization.all())

    def test_api_returns_org_data(self):
        self._insert_data()
        response = self.client.get(self.url_detail)
        self.assertContains(response, self.organization.slug)
        self.assertContains(response, self.organization.id)
        self.assertContains(response, self.organization.name)

    def test_update(self):
        self._insert_data()
        data = {'name': 'edit'}
        with self.assertNumQueries(FuzzyInt(8, 10)):
            res = self.client.patch(self.url_detail, data)
        self.assertContains(res, data['name'])

        user = baker.make(User)
        self.client.force_login(user)
        org_user = self.organization.add_user(user=user)
        res = self.client.patch(self.url_detail, data)
        self.assertEqual(res.status_code, 403)


class BaseOrganizationAssetApiTestCase(BaseAssetTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        # Assign permissions
        for asset in self.someuser.assets.all():
            asset.save()

        self.client.force_login(self.someuser)
        self.organization = self.someuser.organization
        self.org_assets_list_url = reverse(
            self._get_endpoint('organizations-assets'),
            kwargs={'id': self.organization.id},
        )


class OrganizationAssetListApiTestCase(BaseOrganizationAssetApiTestCase):

    def test_can_list_as_owner(self):
        response = self.client.get(self.org_assets_list_url)
        assert self.organization.get_user_role(self.someuser) == OWNER_ORG_ROLE
        assert response.status_code == status.HTTP_200_OK

    def test_can_list_as_admin(self):
        anotheruser = User.objects.get(username='anotheruser')
        self.organization.add_user(user=anotheruser, is_admin=True)
        assert self.organization.get_user_role(anotheruser) == ADMIN_ORG_ROLE
        self.client.force_login(anotheruser)
        asset_list_url = reverse(self._get_endpoint('asset-list'))
        self.client.get(asset_list_url)
        response = self.client.get(self.org_assets_list_url)
        assert response.status_code == status.HTTP_200_OK

    def test_cannot_list_as_member(self):
        anotheruser = User.objects.get(username='anotheruser')
        self.organization.add_user(user=anotheruser, is_admin=False)
        assert self.organization.get_user_role(anotheruser) == MEMBER_ORG_ROLE
        self.client.force_login(anotheruser)
        response = self.client.get(self.org_assets_list_url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_not_found_as_external(self):
        anotheruser = User.objects.get(username='anotheruser')
        assert self.organization.get_user_role(anotheruser) == EXTERNAL_ORG_ROLE
        self.client.force_login(anotheruser)
        response = self.client.get(self.org_assets_list_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_list_not_found_as_anonymous(self):
        self.client.logout()
        response = self.client.get(self.org_assets_list_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_list_only_organization_assets(self):
        # The organization's assets endpoint only returns assets where the `owner`
        # matches the User object who owns the organization.
        # The user assets list endpoint returns all assets to which a permission
        # has been assigned.
        # As a result, for an owner, each of the assets they own will appear in
        # both lists until the code excludes organization assets from the user
        # list.

        # Ensure someuser see already created assets (from fixture).
        asset_list_url = reverse(self._get_endpoint('asset-list'))
        response = self.client.get(self.org_assets_list_url)
        someuser_org_asset_uids = [a['uid'] for a in response.data['results']]
        assert response.data['count'] == 2

        response = self.client.get(asset_list_url)
        someuser_asset_uids = [a['uid'] for a in response.data['results']]
        assert response.data['count'] == 2
        assert someuser_org_asset_uids == someuser_asset_uids

        # Create assets
        anotheruser = User.objects.get(username='anotheruser')
        self.organization.add_user(user=anotheruser, is_admin=True)

        alice = User.objects.create(username='alice', email='alice@alice.com')
        alice_survey = Asset.objects.create(
            owner=alice,
            name='Breakfast',
            asset_type=ASSET_TYPE_SURVEY,
            content={
                'survey': [
                    {
                        'name': 'egg',
                        'type': 'integer',
                        'label': 'how many eggs?',
                    },
                    {
                        'name': 'bacon',
                        'type': 'integer',
                        'label': 'how many slices of bacon',
                    }
                ],
            },
        )

        # alice does not belong to someuser's organization
        alice_survey.assign_perm(self.someuser, PERM_VIEW_ASSET)

        # someuser should see only their org projects on the org assets list
        response = self.client.get(self.org_assets_list_url)
        assert response.data['count'] == 2
        assert someuser_org_asset_uids == [a['uid'] for a in response.data['results']]

        # someuser should see only projects shared with them on the regular assets list
        response = self.client.get(asset_list_url)
        assert response.data['count'] == 3
        assert response.data['results'][0]['uid'] == alice_survey.uid

        self.client.force_login(anotheruser)
        # anotheruser, as an admin, should see only someuser org projects on the
        # org assets list
        response = self.client.get(self.org_assets_list_url)
        assert response.data['count'] == 2
        assert someuser_org_asset_uids == [a['uid'] for a in response.data['results']]

        # anotheruser should see no assets on the regular assets list because
        # no assets are shared with them
        response = self.client.get(asset_list_url)
        assert response.data['count'] == 0


class OrganizationAssetDetailApiTestCase(BaseOrganizationAssetApiTestCase):
    """
    This test suite does not verify scenarios where owners or admins are the
    creators of the objects.
    The purpose is to evaluate access without explicit permission assignment.
    """

    def test_create_asset_is_owned_by_organization(self):

        self._create_asset_is_owned_by_organization()

    def test_admin_can_get_asset_owned_by_organization(self):

        anotheruser = User.objects.get(username='anotheruser')
        self.organization.add_user(user=anotheruser, is_admin=True)
        response = self._create_asset_is_owned_by_organization()
        asset_uid = response.data['uid']
        self.client.force_login(anotheruser)
        assert_detail_url = reverse(
            self._get_endpoint('asset-detail'), kwargs={'uid': asset_uid}
        )
        response = self.client.get(assert_detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['uid'] == response.data['uid']

    def test_owner_can_get_asset_owned_by_organization(self):

        response = self._create_asset_is_owned_by_organization()
        asset_uid = response.data['uid']
        self.client.force_login(self.someuser)

        assert_detail_url = reverse(
            self._get_endpoint('asset-detail'), kwargs={'uid': asset_uid}
        )
        response = self.client.get(assert_detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['uid'] == response.data['uid']

    def test_admin_can_update_asset_owned_by_organization(self):

        anotheruser = User.objects.get(username='anotheruser')
        self.organization.add_user(user=anotheruser, is_admin=True)
        response = self._create_asset_is_owned_by_organization()
        asset_uid = response.data['uid']
        self.client.force_login(anotheruser)
        assert_detail_url = reverse(
            self._get_endpoint('asset-detail'), kwargs={'uid': asset_uid}
        )
        data = {
            'name': 'Week-end breakfast'
        }
        response = self.client.patch(assert_detail_url, data)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == data['name']

    def test_owner_can_update_asset_owned_by_organization(self):

        response = self._create_asset_is_owned_by_organization()
        asset_uid = response.data['uid']
        self.client.force_login(self.someuser)

        assert_detail_url = reverse(
            self._get_endpoint('asset-detail'), kwargs={'uid': asset_uid}
        )
        data = {
            'name': 'Week-end breakfast'
        }
        response = self.client.patch(assert_detail_url, data)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == data['name']

    def test_admin_can_delete_asset_owned_by_organization(self):

        anotheruser = User.objects.get(username='anotheruser')
        self.organization.add_user(user=anotheruser, is_admin=True)
        response = self._create_asset_is_owned_by_organization()
        asset_uid = response.data['uid']
        self.client.force_login(anotheruser)

        assert_detail_url = reverse(
            self._get_endpoint('asset-detail'),
            # Use JSON format to prevent HtmlRenderer from returning a 200 status
            # instead of 204.
            kwargs={'uid': asset_uid, 'format': 'json'}
        )
        response = self.client.delete(assert_detail_url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_owner_can_delete_asset_owned_by_organization(self):

        response = self._create_asset_is_owned_by_organization()
        asset_uid = response.data['uid']
        self.client.force_login(self.someuser)

        assert_detail_url = reverse(
            self._get_endpoint('asset-detail'),
            # Use JSON format to prevent HtmlRenderer from returning a 200 status
            # instead of 204.
            kwargs={'uid': asset_uid, 'format': 'json'}
        )
        response = self.client.delete(assert_detail_url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_admin_can_archive_asset_owned_by_organization(self):

        anotheruser = User.objects.get(username='anotheruser')
        self.organization.add_user(user=anotheruser, is_admin=True)
        response = self._create_asset_is_owned_by_organization()
        asset_uid = response.data['uid']
        self.client.force_login(anotheruser)
        assert_detail_url = reverse(
            self._get_endpoint('asset-deployment'), kwargs={'uid': asset_uid}
        )
        data = {'active': False}
        response = self.client.patch(assert_detail_url, data)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['asset']['deployment__active'] is False

    def test_owner_can_archive_asset_owned_by_organization(self):

        response = self._create_asset_is_owned_by_organization()
        asset_uid = response.data['uid']
        self.client.force_login(self.someuser)

        assert_detail_url = reverse(
            self._get_endpoint('asset-deployment'), kwargs={'uid': asset_uid}
        )
        data = {'active': False}
        response = self.client.patch(assert_detail_url, data)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['asset']['deployment__active'] is False

    def _create_asset_is_owned_by_organization(self):

        alice = User.objects.create(username='alice', email='alice@alice.com')
        self.organization.add_user(user=alice)
        self.client.force_login(alice)

        response = self.create_asset(content={
            'survey': [
                {
                    'name': 'egg',
                    'type': 'integer',
                    'label': 'how many eggs?',
                },
                {
                    'name': 'bacon',
                    'type': 'integer',
                    'label': 'how many slices of bacon',
                }
            ],
        })
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['owner__username'] == self.someuser.username
        assert_detail_url = reverse(
            self._get_endpoint('asset-detail'), kwargs={'uid': response.data['uid']}
        )
        response = self.client.get(assert_detail_url)

        asset = Asset.objects.get(uid=response.data['uid'])
        asset.deploy(backend='mock', active=True)

        # Ensure creator received "manage_asset" permission
        assert asset.has_perm(alice, PERM_MANAGE_ASSET)
        assert response.status_code == status.HTTP_200_OK
        return response
