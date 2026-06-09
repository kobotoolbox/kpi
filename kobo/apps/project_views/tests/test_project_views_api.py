from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.project_views.models import ProjectView
from kpi.constants import ASSET_TYPE_SURVEY, PERM_VIEW_ASSET
from kpi.models.asset import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE
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

        # Create Project Views
        self.pv_country = ProjectView.objects.create(
            name='Spain Projects',
            countries='ESP',
            uid_organizations='*',
            permissions=[PERM_VIEW_ASSET],
        )
        self.pv_country.users.add(self.regular_user)

        self.pv_org = ProjectView.objects.create(
            name='Org Projects',
            countries='*',
            uid_organizations=self.org.id,
            permissions=[PERM_VIEW_ASSET],
        )
        self.pv_org.users.add(self.regular_user)

        self.pv_both = ProjectView.objects.create(
            name='Org Spain Projects',
            countries='ESP',
            uid_organizations=self.org.id,
            permissions=[PERM_VIEW_ASSET],
        )
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
