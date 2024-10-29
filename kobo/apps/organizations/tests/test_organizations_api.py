from unittest.mock import patch

from django.urls import reverse
from ddt import ddt, data, unpack
from model_bakery import baker
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kpi.constants import PERM_VIEW_ASSET, PERM_MANAGE_ASSET
from kpi.models.asset import Asset
from kpi.tests.base_test_case import BaseTestCase, BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE
from kpi.utils.fuzzy_int import FuzzyInt


class OrganizationApiTestCase(BaseTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE
    DEFAULT_SUBSCRIPTION_DETAILS = {
        'current_period_start': '2024-01-01',
        'current_period_end': '2024-12-31'
    }

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.client.force_login(self.user)
        self.url_list = reverse(self._get_endpoint('organizations-list'))

    def _insert_data(self, mmo_override=False):
        self.organization = baker.make(
            Organization,
            id='org_abcd1234',
            mmo_override=mmo_override
        )
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
        with self.assertNumQueries(FuzzyInt(8, 16)):
            res = self.client.get(self.url_list)
        self.assertContains(res, self.organization.name)

    def test_api_returns_org_data(self):
        self._insert_data()
        response = self.client.get(self.url_detail)
        self.assertContains(response, self.organization.slug)
        self.assertContains(response, self.organization.id)
        self.assertContains(response, self.organization.name)

    def test_update(self):
        self._insert_data()
        data = {'name': 'edit'}
        with self.assertNumQueries(FuzzyInt(10, 16)):
            res = self.client.patch(self.url_detail, data)
        self.assertContains(res, data['name'])

        user = baker.make(User)
        self.client.force_login(user)
        self.organization.add_user(user=user)
        res = self.client.patch(self.url_detail, data)
        self.assertEqual(res.status_code, 403)

    def test_api_response_includes_is_mmo_with_mmo_override(self):
        """
        Test that is_mmo is True when mmo_override is enabled and there is no
        active subscription.
        """
        self._insert_data(mmo_override=True)
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['is_mmo'], True)

    @patch.object(
        Organization,
        'active_subscription_billing_details',
        return_value=DEFAULT_SUBSCRIPTION_DETAILS
    )
    def test_api_response_includes_is_mmo_with_subscription(
        self, mock_active_subscription
    ):
        """
        Test that is_mmo is True when there is an active subscription.
        """
        self._insert_data(mmo_override=False)
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['is_mmo'], True)

    @patch.object(
        Organization,
        'active_subscription_billing_details',
        return_value=None
    )
    def test_api_response_includes_is_mmo_with_no_override_and_no_subscription(
        self, mock_active_subscription
    ):
        """
        Test that is_mmo is False when neither mmo_override nor active
        subscription is present.
        """
        self._insert_data(mmo_override=False)
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['is_mmo'], False)

    @patch.object(
        Organization,
        'active_subscription_billing_details',
        return_value=DEFAULT_SUBSCRIPTION_DETAILS
    )
    def test_api_response_includes_is_mmo_with_override_and_subscription(
        self, mock_active_subscription
    ):
        """
        Test that is_mmo is True when both mmo_override and active
        subscription are present.
        """
        self._insert_data(mmo_override=True)
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['is_mmo'], True)


class BaseOrganizationAssetApiTestCase(BaseAssetTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.organization = self.someuser.organization

        # anotheruser is an admin of someuser's organization
        self.anotheruser = User.objects.get(username='anotheruser')
        self.organization.add_user(self.anotheruser, is_admin=True)

        # alice is a regular member of someuser's organization
        self.alice = User.objects.create_user(
            username='alice', password='alice', email='alice@alice.com'
        )
        self.organization.add_user(self.alice, is_admin=False)

        # bob is external to someuser's organization
        self.bob = User.objects.create_user(
            username='bob', password='bob', email='bob@bob.com'
        )

        # Assign permissions to someuser's assets
        for asset in self.someuser.assets.all():
            asset.save()

        self.client.force_login(self.someuser)
        self.org_assets_list_url = reverse(
            self._get_endpoint('organizations-assets'),
            kwargs={'id': self.organization.id},
        )

    def _create_asset_by_alice(self):

        self.client.force_login(self.alice)
        response = self.create_asset(
            name='Breakfast',
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
                    },
                ],
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['owner__username'] == self.someuser.username
        assert_detail_url = reverse(
            self._get_endpoint('asset-detail'), kwargs={'uid': response.data['uid']}
        )
        response = self.client.get(assert_detail_url)

        asset = Asset.objects.get(uid=response.data['uid'])
        asset.deploy(backend='mock', active=True)
        # Ensure creator received "manage_asset" permission
        assert asset.has_perm(self.alice, PERM_MANAGE_ASSET)

        assert response.status_code == status.HTTP_200_OK
        return response

    def _create_asset_by_bob(self):

        self.client.force_login(self.bob)

        response = self.create_asset(
            name='Report',
            content={
                'survey': [
                    {
                        'name': 'number_of_pages',
                        'type': 'integer',
                        'label': 'How many pages?',
                    }
                ],
            }
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['owner__username'] == self.bob.username
        assert_detail_url = reverse(
            self._get_endpoint('asset-detail'), kwargs={'uid': response.data['uid']}
        )
        response = self.client.get(assert_detail_url)
        assert response.status_code == status.HTTP_200_OK

        asset = Asset.objects.get(uid=response.data['uid'])
        asset.deploy(backend='mock', active=True)
        asset.assign_perm(self.someuser, PERM_MANAGE_ASSET)

        return response


@ddt
class OrganizationAssetListApiTestCase(BaseOrganizationAssetApiTestCase):

    @data(
        ('someuser', status.HTTP_200_OK),
        ('anotheruser', status.HTTP_200_OK),
        ('alice', status.HTTP_403_FORBIDDEN),
        ('bob', status.HTTP_404_NOT_FOUND),
    )
    @unpack
    def test_can_list(self, username, expected_status_code):
        user = User.objects.get(username=username)

        self.client.force_login(user)
        response = self.client.get(self.org_assets_list_url)
        assert response.status_code == expected_status_code

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

        self.client.force_login(self.someuser)

        # Ensure someuser see already created assets (from fixture).
        asset_list_url = reverse(self._get_endpoint('asset-list'))
        response = self.client.get(self.org_assets_list_url)
        someuser_org_asset_uids = [a['uid'] for a in response.data['results']]
        assert response.data['count'] == 2

        response = self.client.get(asset_list_url)
        someuser_asset_uids = [a['uid'] for a in response.data['results']]
        assert response.data['count'] == 2
        assert someuser_org_asset_uids == someuser_asset_uids

        response = self._create_asset_by_bob()
        bob_asset = Asset.objects.get(uid=response.data['uid'])
        bob_asset.assign_perm(self.someuser, PERM_VIEW_ASSET)

        self.client.force_login(self.someuser)
        # someuser should see only their org projects on the org assets list
        response = self.client.get(self.org_assets_list_url)
        assert response.data['count'] == 2
        assert someuser_org_asset_uids == [a['uid'] for a in response.data['results']]

        # someuser should see only projects shared with them on the regular assets list
        response = self.client.get(asset_list_url)
        assert response.data['count'] == 3
        assert response.data['results'][0]['uid'] == bob_asset.uid

        self.client.force_login(self.anotheruser)
        # anotheruser, as an admin, should see only someuser org projects on the
        # org assets list
        response = self.client.get(self.org_assets_list_url)
        assert response.data['count'] == 2
        assert someuser_org_asset_uids == [a['uid'] for a in response.data['results']]

        # anotheruser should see no assets on the regular assets list because
        # no assets are shared with them
        response = self.client.get(asset_list_url)
        assert response.data['count'] == 0


@ddt
class OrganizationAssetDetailApiTestCase(BaseOrganizationAssetApiTestCase):
    """
    This test suite does not cover scenarios where owners or admins are also the
    creators of the objects.

    The primary focus is to evaluate access for organization admins without explicit
    permission assignments, while ensuring that permissions for other users work
    as expected.

    - Owners and Admins have full control over organization projects, including deletion.
    - Members who create projects can fully manage them, except for deletion.
    - Externals have no permissions on organization projects.
    - Owners and Admins can only interact with externals' projects if they have been
      explicitly shared with them.
    """

    def test_create_asset_is_owned_by_organization(self):
        self._create_asset_by_alice()

    @data(
        ('someuser', True, status.HTTP_200_OK),
        ('someuser', False, status.HTTP_200_OK),
        ('anotheruser', True, status.HTTP_200_OK),
        ('anotheruser', False, status.HTTP_404_NOT_FOUND),
        ('alice', True, status.HTTP_200_OK),
        ('alice', False, status.HTTP_404_NOT_FOUND),
        ('bob', True, status.HTTP_404_NOT_FOUND),
        ('bob', False, status.HTTP_200_OK),
    )
    @unpack
    def test_get_asset_detail(
        self, username: str, owned_by_org: bool, expected_status_code: int
    ):

        if owned_by_org:
            response = self._create_asset_by_alice()
        else:
            response = self._create_asset_by_bob()

        asset_uid = response.data['uid']
        user = User.objects.get(username=username)
        assert_detail_url = reverse(
            self._get_endpoint('asset-detail'), kwargs={'uid': asset_uid}
        )

        self.client.force_login(user)
        response = self.client.get(assert_detail_url)
        assert response.status_code == expected_status_code

        if expected_status_code == status.HTTP_200_OK:
            assert response.data['uid'] == response.data['uid']

    @data(
        ('someuser', True, status.HTTP_200_OK),
        ('someuser', False, status.HTTP_200_OK),
        ('anotheruser', True, status.HTTP_200_OK),
        ('anotheruser', False, status.HTTP_404_NOT_FOUND),
        ('alice', True, status.HTTP_200_OK),
        ('alice', False, status.HTTP_404_NOT_FOUND),
        ('bob', True, status.HTTP_404_NOT_FOUND),
        ('bob', False, status.HTTP_200_OK),
    )
    @unpack
    def test_can_update_asset(
        self, username: str, owned_by_org: bool, expected_status_code: int
    ):

        if owned_by_org:
            response = self._create_asset_by_alice()
        else:
            response = self._create_asset_by_bob()

        asset_uid = response.data['uid']
        user = User.objects.get(username=username)
        assert_detail_url = reverse(
            self._get_endpoint('asset-detail'), kwargs={'uid': asset_uid}
        )
        data = {
            'name': 'Week-end breakfast'
        }

        self.client.force_login(user)
        response = self.client.patch(assert_detail_url, data)
        assert response.status_code == expected_status_code

        if expected_status_code == status.HTTP_200_OK:
            assert response.data['name'] == response.data['name']

    @data(
        ('someuser', True, status.HTTP_204_NO_CONTENT),
        ('someuser', False, status.HTTP_403_FORBIDDEN),
        ('anotheruser', True, status.HTTP_204_NO_CONTENT),
        ('anotheruser', False, status.HTTP_404_NOT_FOUND),
        ('alice', True, status.HTTP_403_FORBIDDEN),
        ('alice', False, status.HTTP_404_NOT_FOUND),
        ('bob', True, status.HTTP_404_NOT_FOUND),
        ('bob', False, status.HTTP_204_NO_CONTENT),
    )
    @unpack
    def test_can_delete_asset(
        self, username: str, owned_by_org: bool, expected_status_code: int
    ):

        if owned_by_org:
            response = self._create_asset_by_alice()
        else:
            response = self._create_asset_by_bob()
        asset_uid = response.data['uid']
        user = User.objects.get(username=username)
        assert_detail_url = reverse(
            self._get_endpoint('asset-detail'),
            # Use JSON format to prevent HtmlRenderer from returning a 200 status
            # instead of 204.
            kwargs={'uid': asset_uid, 'format': 'json'}
        )

        self.client.force_login(user)
        response = self.client.delete(assert_detail_url)
        assert response.status_code == expected_status_code

    @data(
        ('someuser', True, True, status.HTTP_200_OK),
        ('someuser', True, False, status.HTTP_200_OK),
        ('someuser', False, True, status.HTTP_200_OK),
        ('someuser', False, False, status.HTTP_200_OK),
        ('anotheruser', True, True, status.HTTP_200_OK),
        ('anotheruser', True, False, status.HTTP_200_OK),
        ('anotheruser', False, True, status.HTTP_404_NOT_FOUND),
        ('anotheruser', False, False, status.HTTP_404_NOT_FOUND),
        ('alice', True, True, status.HTTP_200_OK),
        ('alice', True, False, status.HTTP_200_OK),
        ('alice', False, True, status.HTTP_404_NOT_FOUND),
        ('alice', False, False, status.HTTP_404_NOT_FOUND),
        ('bob', True, True, status.HTTP_404_NOT_FOUND),
        ('bob', True, False, status.HTTP_404_NOT_FOUND),
        ('bob', False, True, status.HTTP_200_OK),
        ('bob', False, False, status.HTTP_200_OK),
    )
    @unpack
    def test_can_archive_or_unarchive(
        self,
        username: str,
        owned_by_org: bool,
        is_active: bool,
        expected_status_code: int,
    ):

        if owned_by_org:
            response = self._create_asset_by_alice()
        else:
            response = self._create_asset_by_bob()
        asset_uid = response.data['uid']
        user = User.objects.get(username=username)
        assert_detail_url = reverse(
            self._get_endpoint('asset-deployment'), kwargs={'uid': asset_uid}
        )
        data = {'active': is_active}

        self.client.force_login(user)
        response = self.client.patch(assert_detail_url, data)
        assert response.status_code == expected_status_code

        if expected_status_code == status.HTTP_200_OK:
            assert response.data['asset']['deployment__active'] == is_active
