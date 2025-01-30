from datetime import timedelta
from unittest.mock import patch

import responses
from ddt import data, ddt, unpack
from django.contrib.auth.models import Permission
from django.urls import reverse
from django.utils import timezone
from django.utils.http import parse_http_date
from model_bakery import baker
from rest_framework import status

from kobo.apps.hook.utils.tests.mixins import HookTestCaseMixin
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kpi.constants import PERM_ADD_SUBMISSIONS, PERM_MANAGE_ASSET, PERM_VIEW_ASSET
from kpi.models.asset import Asset
from kpi.tests.base_test_case import BaseAssetTestCase, BaseTestCase
from kpi.tests.utils.mixins import (
    AssetFileTestCaseMixin,
    SubmissionDeleteTestCaseMixin,
    SubmissionEditTestCaseMixin,
    SubmissionValidationStatusTestCaseMixin,
    SubmissionViewTestCaseMixin,
)
from kpi.urls.router_api_v2 import URL_NAMESPACE
from kpi.utils.fuzzy_int import FuzzyInt


class OrganizationApiTestCase(BaseTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE
    DEFAULT_SUBSCRIPTION_DETAILS = {
        'current_period_start': '2024-01-01',
        'current_period_end': '2024-12-31'
    }
    MMO_SUBSCRIPTION_DETAILS = {'product_metadata': {'mmo_enabled': 'true'}}

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.client.force_login(self.user)
        self.url_list = reverse(self._get_endpoint('organizations-list'))

    def _insert_data(self, mmo_override=False):
        self.organization = self.user.organization
        self.organization.mmo_override = mmo_override
        self.organization.save(update_fields=['mmo_override'])

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
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_delete(self):
        self._insert_data()
        res = self.client.delete(self.url_detail)
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_list(self):
        self._insert_data()
        with self.assertNumQueries(FuzzyInt(8, 16)):
            res = self.client.get(self.url_list)
        self.assertContains(res, self.organization.name)

    def test_api_returns_org_data(self):
        self._insert_data()
        response = self.client.get(self.url_detail)
        self.assertContains(response, self.organization.id)
        self.assertContains(response, self.organization.name)

    def test_update(self):
        self._insert_data(mmo_override=True)
        data = {'name': 'edit'}
        with self.assertNumQueries(FuzzyInt(10, 18)):
            res = self.client.patch(self.url_detail, data)
        self.assertContains(res, data['name'])

        user = baker.make(User)
        self.client.force_login(user)
        self.organization.add_user(user=user)
        res = self.client.patch(self.url_detail, data)
        self.assertEqual(res.status_code, 403)

    @patch('kpi.utils.usage_calculator.CachedClass._cache_last_updated')
    def test_service_usage_date_header(self, mock_cache_last_updated):
        self._insert_data()
        url_service_usage = reverse(
            self._get_endpoint('organizations-service-usage'),
            kwargs={'id': self.organization.id},
        )
        now = timezone.now()
        mock_cache_last_updated.return_value = now - timedelta(seconds=3)
        self.client.get(url_service_usage)
        response = self.client.get(url_service_usage)
        last_updated_timestamp = parse_http_date(response.headers['Date'])
        assert (now.timestamp() - last_updated_timestamp) > 3

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
        return_value=MMO_SUBSCRIPTION_DETAILS,
    )
    def test_api_response_includes_is_mmo_with_subscription(
        self, mock_active_subscription
    ):
        """
        Test that is_mmo is True when there is an active MMO subscription.
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
        return_value=MMO_SUBSCRIPTION_DETAILS,
    )
    def test_api_response_includes_is_mmo_with_override_and_subscription(
        self, mock_active_subscription
    ):
        """
        Test that is_mmo is True when both mmo_override and active
        MMO subscription is present.
        """
        self._insert_data(mmo_override=True)
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['is_mmo'], True)


@ddt
class OrganizationDetailAPITestCase(BaseTestCase):

    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.organization = self.someuser.organization
        self.organization.mmo_override = True
        # Only needed to make `test_update_fields()` pass with an empty string for
        # `website`.
        self.organization.website = 'http://example.com'
        self.organization.save(update_fields=['mmo_override'])

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

    @data(
        ('someuser', status.HTTP_200_OK),
        ('anotheruser', status.HTTP_200_OK),
        ('alice', status.HTTP_403_FORBIDDEN),
        ('bob', status.HTTP_404_NOT_FOUND),
    )
    @unpack
    def test_asset_usage(self, username, expected_status_code):
        user = User.objects.get(username=username)
        self.client.force_login(user)

        url = reverse(
            self._get_endpoint('organizations-asset-usage'),
            kwargs={'id': self.organization.id}
        )
        response = self.client.get(url)
        assert response.status_code == expected_status_code

    @data(
        ('someuser', status.HTTP_200_OK),
        ('anotheruser', status.HTTP_200_OK),
        ('alice', status.HTTP_200_OK),
        ('bob', status.HTTP_404_NOT_FOUND),
    )
    @unpack
    def test_service_usage(self, username, expected_status_code):
        user = User.objects.get(username=username)
        self.client.force_login(user)

        url = reverse(
            self._get_endpoint('organizations-service-usage'),
            kwargs={'id': self.organization.id}
        )
        response = self.client.get(url)
        assert response.status_code == expected_status_code

    @data(
        ('name', 'Someuser Company inc.', status.HTTP_200_OK),
        ('name', '', status.HTTP_400_BAD_REQUEST),
        ('website', 'https://foo.bar/', status.HTTP_200_OK),
        ('website', '', status.HTTP_200_OK),
    )
    @unpack
    def test_update_fields(self, field, value, expected_status_code):
        assert getattr(self.organization, field) != value
        self.client.force_login(self.someuser)
        data = {field: value}

        url = reverse(
            self._get_endpoint('organizations-detail'),
            kwargs={'id': self.organization.id},
        )
        response = self.client.post(url, data)

        if response.status_code == status.HTTP_200_OK:
            assert response.status_code == expected_status_code
            assert response.data[field] == value


class BaseOrganizationAssetApiTestCase(BaseAssetTestCase):
    """
    This test suite (e.g. classes which inherit from this one) does not cover
    scenarios where owners or admins are also the creators of the objects.

    The primary focus is to evaluate access for organization admins without explicit
    permission assignments, while ensuring that permissions for other users work
    as expected.

    - someuser is the owner
    - anotheruser is an admin
    - alice is a member
    - bob is external to the organization
    """

    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.organization = self.someuser.organization
        self.organization.mmo_override = True
        self.organization.save(update_fields=['mmo_override'])

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
            },
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


class BaseOrganizationAdminsDataApiTestCase(BaseOrganizationAssetApiTestCase):
    """
    Base test case for testing organization admin permissions.

    This test suite serves as the foundation for classes that verify the permissions
    of organization admins. It focuses on key access points and basic cases to ensure
    that admins have the same rights as organization owners over assets and associated
    data, even without explicitly assigned permissions.

    This suite is intentionally not exhaustive to avoid redundancy with tests covering
    regular user flows. Only the admin role is tested here, as owners and regular
    members follow the standard user scenario.
    """

    def setUp(self):
        super().setUp()
        response = self._create_asset_by_alice()
        self.asset = Asset.objects.get(uid=response.data['uid'])
        self.asset.deploy(backend='mock', active=True)
        self.submission = {
            'egg': 2,
            'bacon': 1,
        }
        self.asset.deployment.mock_submissions([self.submission])
        self.data_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'parent_lookup_asset': self.asset.uid},
        )
        self.submission_url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'parent_lookup_asset': self.asset.uid},
        )
        self.client.force_login(self.anotheruser)


@ddt
class OrganizationAssetListApiTestCase(BaseOrganizationAssetApiTestCase):
    """
    The organization asset endpoint returns a list of all assets owned by the
    organization, while the regular asset endpoint only returns assets for which
    the user has explicit permissions.

    Admins can view organization assets based on their role, not through assigned
    permissions.
    """

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
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

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
    Owners and Admins have complete control over organization projects, including
    the ability to delete them.
    Members who create projects can manage them entirely, except for deletion.
    Externals do not have any permissions on organization projects. However,
    Owners and Admins can only interact with externals' projects if these projects
    have been explicitly shared with them.
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
        data = {'name': 'Week-end breakfast'}

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
            kwargs={'uid': asset_uid, 'format': 'json'},
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
    def test_can_archive_or_unarchive_project(
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
    def test_can_assign_permissions(
        self,
        username: str,
        owned_by_org: bool,
        expected_status_code: int,
    ):
        if owned_by_org:
            response = self._create_asset_by_alice()
        else:
            response = self._create_asset_by_bob()

        asset_uid = response.data['uid']
        user = User.objects.get(username=username)

        payload = {
            'user': self.obj_to_url(self.alice),
            'permission': self.obj_to_url(
                Permission.objects.get(codename=PERM_VIEW_ASSET)
            ),
        }

        self.client.force_login(user)
        url = reverse(
            self._get_endpoint('asset-permission-assignment-bulk-assignments'),
            kwargs={'parent_lookup_asset': asset_uid},
        )
        response = self.client.post(url, data=payload)
        response.status_code == expected_status_code


class OrganizationAdminsDataApiTestCase(
    SubmissionEditTestCaseMixin,
    SubmissionDeleteTestCaseMixin,
    SubmissionViewTestCaseMixin,
    BaseOrganizationAdminsDataApiTestCase,
):
    """
    This test suite shares logic with `SubmissionEditApiTests`,
    `SubmissionViewApiTests` and uses the mixins to call the same code for consistency
    and reusability.
    """

    def test_can_access_data(self):
        response = self.client.get(self.data_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1

        response = self.client.get(self.submission_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['_id'] == self.submission['_id']

    def test_can_bulk_delete_data(self):
        self.submission_bulk_url = reverse(
            self._get_endpoint('submission-bulk'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
            },
        )
        self._delete_submissions()

    def test_can_delete_data(self):
        self._delete_submission(self.submission)

    @responses.activate
    def test_can_get_edit_link(self):
        self._get_edit_link()

    @responses.activate
    def test_can_get_view_link(self):
        self._get_view_link()

    def test_can_submit_data(self):
        """
        Test that anotheruser can submit data if they have the necessary permissions.

        This test verifies that anotheruser retains the "PERM_ADD_SUBMISSIONS"
        permission, ensuring that it is not temporarily added by `mock_submissions`.
        The `mock_submissions` function internally calls `create_instance`, which
        validates the user's permission (via `_submitted_by`) before saving the data
        to the database.

        If `create_instance` completes without raising an error, this confirms that the
        user has the required permissions to submit data.
        """

        submission = {
            'egg': 3,
            'bacon': 0,
            '_submitted_by': self.anotheruser,
        }

        self.asset.has_perm(self.anotheruser, PERM_ADD_SUBMISSIONS)
        self.asset.deployment.mock_submissions([submission])
        self.asset.has_perm(self.anotheruser, PERM_ADD_SUBMISSIONS)


class OrganizationAdminsAssetFileApiTestCase(
    AssetFileTestCaseMixin, BaseOrganizationAssetApiTestCase
):
    """
    This test suite shares logic with `AssetFileTest` and uses the
    mixin to call the same code for consistency and reusability.
    """

    def setUp(self):
        super().setUp()
        response = self._create_asset_by_alice()
        self.asset = Asset.objects.get(uid=response.data['uid'])
        self.current_username = 'anotheruser'
        self.list_url = reverse(
            self._get_endpoint('asset-file-list'), args=[self.asset.uid]
        )
        self.client.force_login(self.anotheruser)

    def test_can_get_asset_files(self):
        self.client.force_login(self.someuser)
        self.current_username = 'someuser'
        af_uid = self.verify_asset_file(self.create_asset_file())

        self.client.force_login(self.anotheruser)
        self.current_username = 'anotheruser'
        response = self.client.get(self.list_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['results'][0]['uid'] == af_uid

    def test_can_post_asset_files(self):
        response = self.create_asset_file()
        self.verify_asset_file(response)

    def test_can_delete_asset_files(self):
        self.delete_asset_file()


class OrganizationAdminsRestServiceApiTestCase(
    HookTestCaseMixin, BaseOrganizationAssetApiTestCase
):
    """
    This test suite shares logic with `HookTestCase` and uses the mixin to call the
    same code for consistency and reusability.
    """

    def setUp(self):
        super().setUp()
        response = self._create_asset_by_alice()
        self.asset = Asset.objects.get(uid=response.data['uid'])
        self.asset.deploy(backend='mock', active=True)
        self.client.force_login(self.anotheruser)

    def test_can_add_rest_services(self):
        self._create_hook()

    def test_can_list_rest_services(self):
        hook = self._create_hook()
        list_url = reverse(
            self._get_endpoint('hook-list'),
            kwargs={'parent_lookup_asset': self.asset.uid},
        )

        response = self.client.get(list_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['uid'] == hook.uid

        detail_url = reverse(
            'hook-detail',
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'uid': hook.uid,
            },
        )

        response = self.client.get(detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['uid'] == hook.uid

    def test_can_delete_rest_services(self):
        hook = self._create_hook()
        detail_url = reverse(
            self._get_endpoint('hook-detail'),
            kwargs={'parent_lookup_asset': self.asset.uid, 'uid': hook.uid},
        )
        response = self.client.delete(detail_url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_can_update_rest_services(self):
        hook = self._create_hook()
        detail_url = reverse(
            self._get_endpoint('hook-detail'),
            kwargs={'parent_lookup_asset': self.asset.uid, 'uid': hook.uid},
        )
        data = {'name': 'some disabled external service', 'active': False}
        response = self.client.patch(detail_url, data)
        assert response.status_code == status.HTTP_200_OK
        hook.refresh_from_db()
        assert not hook.active
        assert hook.name == 'some disabled external service'

    def _add_submissions(self):
        submission = {
            'egg': 2,
            'bacon': 1,
        }
        self.asset.deployment.mock_submissions([submission])


class OrganizationAdminsValidationStatusApiTestCase(
    SubmissionValidationStatusTestCaseMixin, BaseOrganizationAdminsDataApiTestCase
):
    """
    This test suite shares logic with `SubmissionValidationStatusApiTests` and uses
    the mixin to call the same code for consistency and reusability.
    """

    def setUp(self):
        super().setUp()
        self.validation_status_url = reverse(
            self._get_endpoint('submission-validation-status'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.submission['_id'],
            },
        )
        self.validation_statuses_url = reverse(
            self._get_endpoint('submission-validation-statuses'),
            kwargs={'parent_lookup_asset': self.asset.uid, 'format': 'json'},
        )

    def test_can_access_validation_status(self):
        response = self.client.get(self.submission_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['_validation_status'] == {}

        response = self.client.get(self.validation_status_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {}

    def test_can_update_validation_status(self):
        self._update_status('anotheruser')

    def test_can_delete_validation_status(self):
        self._update_status('anotheruser')
        self._delete_status()

    def test_can_bulk_validate_statuses(self):
        self._validate_statuses(empty=True)
        self._update_statuses(status_uid='validation_status_not_approved')
        self._validate_statuses(
            uid='validation_status_not_approved', username='anotheruser'
        )

    def test_can_bulk_delete_statuses(self):
        self._delete_statuses()
