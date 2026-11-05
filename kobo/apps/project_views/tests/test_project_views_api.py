from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.project_views.models import ProjectView
from kpi.constants import (
    ASSET_TYPE_SURVEY,
    LIMITED_COUNT_MANY,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models.asset import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.utils.fuzzy_int import FuzzyInt
from kpi.urls.router_api_v2 import URL_NAMESPACE
from kpi.utils.data_exports import CONFIG
from kpi.utils.project_views import get_project_view_user_permissions_for_asset


class ProjectViewsApiTestCase(BaseTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE

    def setUp(self):
        # Users
        self.admin_user = User.objects.get(username='someuser')
        self.regular_user = User.objects.get(username='anotheruser')
        self.external_user = User.objects.create_user(
            username='external', password='password', email='ext@example.com'
        )

        # Organization
        self.org = self.admin_user.organization

        # Create ProjectViews
        self.pv_country = ProjectView.objects.create(
            name='Spain Projects',
            countries='ESP',
            permissions=[PERM_VIEW_ASSET]
        )
        self.pv_country.users.add(self.regular_user)

        self.pv_org = ProjectView.objects.create(
            name='Org Projects',
            countries='*',
            permissions=[PERM_VIEW_ASSET]
        )
        self.pv_org.organizations.add(self.org)
        self.pv_org.users.add(self.regular_user)

        self.pv_both = ProjectView.objects.create(
            name='Spain Org Projects',
            countries='ESP',
            permissions=[PERM_VIEW_ASSET]
        )
        self.pv_both.organizations.add(self.org)
        self.pv_both.users.add(self.regular_user)

        # Create Assets
        # 1. Asset belonging to org, country ESP
        self.asset_org_esp = Asset.objects.create(
            owner=self.admin_user,
            name='Org ESP',
            asset_type=ASSET_TYPE_SURVEY,
            settings={'country': [{'value': 'ESP', 'label': 'España'}]},
        )

        # 2. Asset belonging to org, country FRA
        self.asset_org_fra = Asset.objects.create(
            owner=self.admin_user,
            name='Org FRA',
            asset_type=ASSET_TYPE_SURVEY,
            settings={'country': [{'value': 'FRA', 'label': 'Francia'}]},
        )

        # 3. Asset NOT belonging to org, country ESP
        self.asset_ext_esp = Asset.objects.create(
            owner=self.external_user,
            name='Ext ESP',
            asset_type=ASSET_TYPE_SURVEY,
            settings={'country': [{'value': 'ESP', 'label': 'España'}]},
        )

    def test_project_view_country_filter(self):
        self.client.force_login(self.regular_user)
        url = reverse(
            self._get_endpoint('projectview-assets'),
            kwargs={'uid_project_view': self.pv_country.uid},
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should see both ESP assets (one from org, one from external)
        uids = [a['uid'] for a in response.data['results']]
        self.assertIn(self.asset_org_esp.uid, uids)
        self.assertIn(self.asset_ext_esp.uid, uids)
        self.assertNotIn(self.asset_org_fra.uid, uids)

    def test_project_view_organization_filter(self):
        self.client.force_login(self.regular_user)
        url = reverse(
            self._get_endpoint('projectview-assets'),
            kwargs={'uid_project_view': self.pv_org.uid},
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should see both Org assets (ESP and FRA)
        uids = [a['uid'] for a in response.data['results']]
        self.assertIn(self.asset_org_esp.uid, uids)
        self.assertIn(self.asset_org_fra.uid, uids)
        self.assertNotIn(self.asset_ext_esp.uid, uids)

    def test_project_view_combined_filter(self):
        self.client.force_login(self.regular_user)
        url = reverse(
            self._get_endpoint('projectview-assets'),
            kwargs={'uid_project_view': self.pv_both.uid},
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should ONLY see the asset that is both Org AND ESP
        uids = [a['uid'] for a in response.data['results']]
        self.assertIn(self.asset_org_esp.uid, uids)
        self.assertNotIn(self.asset_org_fra.uid, uids)
        self.assertNotIn(self.asset_ext_esp.uid, uids)

    def test_project_view_users_list(self):
        self.client.force_login(self.regular_user)
        url = reverse(
            self._get_endpoint('projectview-users'),
            kwargs={'uid_project_view': self.pv_org.uid},
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # `asset_count` is serialized without the precomputed attribute the
        # `/api/v2/users/` list injects (regression from #6447)
        self.assertTrue(all('asset_count' in user for user in response.data['results']))

    def test_inactive_owner_assets_are_hidden(self):
        self._deactivate_external_user()

        self.client.force_login(self.regular_user)
        url = reverse(
            self._get_endpoint('projectview-assets'),
            kwargs={'uid_project_view': self.pv_country.uid},
        )
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK

        uids = [a['uid'] for a in response.data['results']]
        assert self.asset_ext_esp.uid not in uids
        assert self.asset_org_esp.uid in uids

    def test_inactive_users_are_hidden(self):
        self._deactivate_external_user()

        self.client.force_login(self.regular_user)
        url = reverse(
            self._get_endpoint('projectview-users'),
            kwargs={'uid_project_view': self.pv_country.uid},
        )
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK

        usernames = [u['username'] for u in response.data['results']]
        assert self.external_user.username not in usernames

    def test_inactive_accounts_are_excluded_from_exports(self):
        self._deactivate_external_user()

        asset_ids = CONFIG['assets']['queryset']().values_list('pk', flat=True)
        assert self.asset_org_esp.pk in asset_ids
        assert self.asset_ext_esp.pk not in asset_ids

        user_ids = CONFIG['users']['queryset']().values_list('pk', flat=True)
        assert self.regular_user.pk in user_ids
        assert self.external_user.pk not in user_ids

    def test_permission_check_on_asset_owned_by_organization_less_user(self):
        """
        Owners without an organization must not break permission checks
        """

        self._deactivate_external_user()

        # Refetch to get an owner instance whose `organization` is not already
        # cached for this request
        asset = Asset.objects.get(pk=self.asset_ext_esp.pk)
        assert not asset.owner.organization

        assert asset.has_perm(self.regular_user, PERM_VIEW_SUBMISSIONS) is False
        assert PERM_VIEW_SUBMISSIONS not in asset.get_perms(self.regular_user)

    def test_asset_permissions(self):
        # We test that get_project_view_user_permissions_for_asset correctly returns
        # permissions. Regular user should have PERM_VIEW_ASSET for asset_org_esp
        # because of pv_both, pv_country, and pv_org
        perms = get_project_view_user_permissions_for_asset(
            self.asset_org_esp, self.regular_user
        )
        self.assertIn(PERM_VIEW_ASSET, perms)

        # External user shouldn't have permissions through project views
        perms_ext = get_project_view_user_permissions_for_asset(
            self.asset_org_esp, self.external_user
        )
        self.assertNotIn(PERM_VIEW_ASSET, perms_ext)

    @override_settings(API_LIMITED_COUNT_MAX=0)
    def test_list_count_is_capped(self):
        self.client.force_login(self.regular_user)
        response = self.client.get(reverse(self._get_endpoint('projectview-list')))
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == LIMITED_COUNT_MANY
        assert len(response.data['results']) > 0

    @override_settings(API_LIMITED_COUNT_MAX=0)
    def test_users_count_is_capped(self):
        self.client.force_login(self.regular_user)
        url = reverse(
            self._get_endpoint('projectview-users'),
            kwargs={'uid_project_view': self.pv_org.uid},
        )
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == LIMITED_COUNT_MANY
        assert len(response.data['results']) > 0

    def test_asset_list_does_not_run_queries_per_owner(self):
        """
        Checking the submission count permission of each deployed project must not
        run queries per owner when no project view is filtered by organization
        """

        viewer = self._create_viewer()
        owners = [self.admin_user, self.external_user, *self._create_owners(8)]
        for owner in owners:
            self._create_deployed_asset(owner)

        self.client.force_login(viewer)
        url = reverse(
            self._get_endpoint('projectview-assets'),
            kwargs={'uid_project_view': self.pv_country.uid},
        )
        with self.assertNumQueries(FuzzyInt(10, 30)):
            response = self.client.get(url)

        deployed = [a for a in response.data['results'] if a['has_deployment']]
        assert len(deployed) == len(owners)

    def test_asset_list_with_organization_view_does_not_run_queries_per_owner(self):
        """
        A project view filtered by organization must read the organizations of the
        owners of the page in one query, even when it is not the view displayed
        """

        viewer = self._create_viewer()
        self._create_organization_view(viewer, PERM_VIEW_ASSET)
        owners = self._create_owners(15)
        for owner in owners:
            self._create_deployed_asset(owner)

        self.client.force_login(viewer)
        url = reverse(
            self._get_endpoint('projectview-assets'),
            kwargs={'uid_project_view': self.pv_country.uid},
        )
        with self.assertNumQueries(FuzzyInt(10, 30)):
            response = self.client.get(url)

        deployed = [a for a in response.data['results'] if a['has_deployment']]
        assert len(deployed) == len(owners)

    def test_organization_view_grants_submission_counts_on_its_organizations(self):
        viewer = self._create_viewer()
        self._create_organization_view(viewer, PERM_VIEW_SUBMISSIONS)
        org_asset = self._create_deployed_asset(self.admin_user)
        external_asset = self._create_deployed_asset(self.external_user)

        counts = self._get_submission_counts(viewer)

        assert counts[org_asset.uid] is not None
        assert counts[external_asset.uid] is None

    def test_org_admin_sees_submission_counts_of_all_org_members(self):
        viewer = self._create_viewer()
        member = User.objects.create_user(
            username='member', password='password', email='member@example.com'
        )
        self._add_to_organization(viewer, is_admin=True)
        self._add_to_organization(member)
        owner_asset = self._create_deployed_asset(self.admin_user)
        member_asset = self._create_deployed_asset(member)
        external_asset = self._create_deployed_asset(self.external_user)

        counts = self._get_submission_counts(viewer)

        assert counts[owner_asset.uid] is not None
        assert counts[member_asset.uid] is not None
        assert counts[external_asset.uid] is None

    def test_org_member_does_not_see_submission_counts_of_org_members(self):
        viewer = self._create_viewer()
        member = User.objects.create_user(
            username='member', password='password', email='member@example.com'
        )
        self._add_to_organization(viewer)
        self._add_to_organization(member)
        owner_asset = self._create_deployed_asset(self.admin_user)
        member_asset = self._create_deployed_asset(member)

        counts = self._get_submission_counts(viewer)

        assert counts[owner_asset.uid] is None
        assert counts[member_asset.uid] is None

    def test_org_member_sees_submission_count_of_asset_shared_with_them(self):
        viewer = self._create_viewer()
        self._add_to_organization(viewer)
        shared_asset = self._create_deployed_asset(self.admin_user)
        other_asset = self._create_deployed_asset(self.admin_user)
        shared_asset.assign_perm(viewer, PERM_VIEW_SUBMISSIONS)

        counts = self._get_submission_counts(viewer)

        assert counts[shared_asset.uid] is not None
        assert counts[other_asset.uid] is None

    def test_project_view_permissions_follow_organization_filter(self):
        """
        A project view filtered by organization only grants its permissions on the
        projects of those organizations
        """

        viewer = self._create_viewer()
        self._create_organization_view(viewer, PERM_VIEW_SUBMISSIONS)

        org_perms = get_project_view_user_permissions_for_asset(
            self.asset_org_esp, viewer
        )
        external_perms = get_project_view_user_permissions_for_asset(
            self.asset_ext_esp, viewer
        )
        assert PERM_VIEW_SUBMISSIONS in org_perms
        assert PERM_VIEW_SUBMISSIONS not in external_perms

        self._deactivate_external_user()
        assert not self.external_user.organization
        organization_less_perms = get_project_view_user_permissions_for_asset(
            self.asset_ext_esp, viewer
        )
        assert PERM_VIEW_SUBMISSIONS not in organization_less_perms

    def test_extra_fields_for_superuser(self):
        """
        `?extra_fields=on` adds the sharing status, the summary and the versions
        of each project for superusers
        """

        url = self._login_superuser_on_org_view()
        self.asset_org_esp.create_version()
        self.asset_org_esp.create_version()
        self.asset_org_fra.assign_perm(self.regular_user, PERM_VIEW_ASSET)

        response = self.client.get(url, {'extra_fields': 'on'})
        assert response.status_code == status.HTTP_200_OK
        results = {asset['uid']: asset for asset in response.data['results']}

        org_esp = results[self.asset_org_esp.uid]
        latest_version = self.asset_org_esp.latest_version
        assert org_esp['version_id'] == latest_version.uid
        assert org_esp['version__content_hash'] == latest_version.content_hash
        version_count = self.asset_org_esp.asset_versions.count()
        assert version_count > 1
        assert org_esp['version_count'] == version_count
        assert org_esp['deployed_version_id'] is None
        assert org_esp['summary'] == self.asset_org_esp.summary
        assert org_esp['status'] == 'private'
        assert results[self.asset_org_fra.uid]['status'] == 'shared'

    def test_extra_fields_separate_latest_version_from_deployed_version(self):
        """
        A version saved after the deployment changes `version_id`, while
        `deployed_version_id` still identifies the form that is deployed
        """

        url = self._login_superuser_on_org_view()
        asset = self._create_deployed_asset(self.admin_user)
        deployed_version_uid = asset.latest_version.uid
        new_version = asset.create_version()
        assert new_version.uid != deployed_version_uid

        response = self.client.get(url, {'extra_fields': 'on'})
        assert response.status_code == status.HTTP_200_OK
        results = {row['uid']: row for row in response.data['results']}

        assert results[asset.uid]['version_id'] == new_version.uid
        assert results[asset.uid]['deployed_version_id'] == deployed_version_uid

    def test_extra_fields_ignored_without_superuser_or_param(self):
        extra_fields = {
            'status',
            'summary',
            'version_id',
            'version__content_hash',
            'deployed_version_id',
            'version_count',
        }
        url = self._login_superuser_on_org_view()
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert not extra_fields & set(response.data['results'][0])

        self.client.force_login(self.regular_user)
        response = self.client.get(url, {'extra_fields': 'on'})
        assert response.status_code == status.HTTP_200_OK
        assert not extra_fields & set(response.data['results'][0])

    def test_extra_fields_query_count_does_not_grow_with_the_page(self):
        url = self._login_superuser_on_org_view()
        # Warm up the caches that only the first request fills
        self.client.get(url, {'extra_fields': 'on'})
        with CaptureQueriesContext(connection) as before:
            response = self.client.get(url, {'extra_fields': 'on'})
        results_before = len(response.data['results'])

        for index in range(3):
            Asset.objects.create(
                owner=self.admin_user,
                name=f'Org extra {index}',
                asset_type=ASSET_TYPE_SURVEY,
            )
        with CaptureQueriesContext(connection) as after:
            response = self.client.get(url, {'extra_fields': 'on'})

        assert len(response.data['results']) == results_before + 3
        assert len(after.captured_queries) == len(before.captured_queries)

    def _add_to_organization(self, user: User, is_admin: bool = False) -> None:
        self.org.mmo_override = True
        self.org.save(update_fields=['mmo_override'])
        self.org.add_user(user, is_admin=is_admin)

    @staticmethod
    def _create_deployed_asset(owner: User) -> Asset:
        """
        Deploy a project in Spain, so that `pv_country` lists it
        """

        asset = Asset.objects.create(
            owner=owner,
            name=f'Deployed by {owner.username}',
            asset_type=ASSET_TYPE_SURVEY,
            settings={'country': [{'value': 'ESP', 'label': 'España'}]},
        )
        asset.deploy(backend='mock', active=True)
        return asset

    def _create_organization_view(self, user: User, permission: str) -> None:
        """
        Assign `user` to a project view that covers every country, and that is
        filtered by the organization of `admin_user`
        """

        project_view = ProjectView.objects.create(
            name='Org View', countries='*', permissions=[permission]
        )
        project_view.organizations.add(self.org)
        project_view.users.add(user)

    @staticmethod
    def _create_owners(count: int) -> list[User]:
        return [
            User.objects.create_user(
                username=f'owner{index}',
                password='password',
                email=f'owner{index}@example.com',
            )
            for index in range(count)
        ]

    def _create_viewer(self) -> User:
        """
        Create a user whose only project view is `pv_country`, which grants
        `view_asset` only and is not filtered by organization
        """

        viewer = User.objects.create_user(
            username='viewer', password='password', email='viewer@example.com'
        )
        self.pv_country.users.add(viewer)
        return viewer

    def _deactivate_external_user(self) -> None:
        """
        Leave `external_user` with no organization at all, which is the state
        `User.organization` refuses to auto-create one for
        """

        self.external_user.organizations_organizationuser.all().delete()
        self.external_user.is_active = False
        self.external_user.save()

    def _get_submission_counts(self, user: User) -> dict:
        """
        Return the submission count that `user` sees for each project of `pv_country`
        """

        self.client.force_login(user)
        url = reverse(
            self._get_endpoint('projectview-assets'),
            kwargs={'uid_project_view': self.pv_country.uid},
        )
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        return {
            asset['uid']: asset['deployment__submission_count']
            for asset in response.data['results']
        }

    def _login_superuser_on_org_view(self) -> str:
        """
        Log in a superuser who belongs to `pv_org` and return the URL of its
        asset list
        """

        superuser = User.objects.create_superuser(
            username='superadmin', password='password', email='superadmin@example.com'
        )
        self.pv_org.users.add(superuser)
        self.client.force_login(superuser)
        return reverse(
            self._get_endpoint('projectview-assets'),
            kwargs={'uid_project_view': self.pv_org.uid},
        )
