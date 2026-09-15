from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.project_views.models import ProjectView
from kpi.constants import (
    ASSET_TYPE_SURVEY,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models.asset import Asset
from kpi.tests.base_test_case import BaseTestCase
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

    def _deactivate_external_user(self) -> None:
        """
        Leave `external_user` with no organization at all, which is the state
        `User.organization` refuses to auto-create one for
        """

        self.external_user.organizations_organizationuser.all().delete()
        self.external_user.is_active = False
        self.external_user.save()
