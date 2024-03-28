from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.project_views.models.project_view import ProjectView
from kpi.constants import (
    PERM_CHANGE_ASSET,
    PERM_CHANGE_METADATA_ASSET,
    PERM_CHANGE_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.utils.project_views import (
    get_project_view_user_permissions_for_asset,
    user_has_project_view_asset_perm,
    user_has_view_perms,
    view_has_perm,
    get_region_for_view,
)


class ProjectViewsUtilsTestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        regional_assignments = [
            {
                'name': 'Overview',
                'countries': '*',
                'permissions': [
                    PERM_VIEW_ASSET,
                ],
                'users': ['someuser'],
            },
            {
                'name': 'Test view 1',
                'countries': 'ZAF, NAM, ZWE, MOZ, BWA, LSO',
                'permissions': [
                    PERM_VIEW_ASSET,
                    PERM_VIEW_SUBMISSIONS,
                    PERM_CHANGE_METADATA_ASSET,
                ],
                'users': ['someuser', 'anotheruser'],
            },
            {
                'name': 'Test view 2',
                'countries': 'USA, CAN',
                'permissions': [
                    PERM_VIEW_ASSET,
                ],
                'users': ['anotheruser'],
            },
        ]
        self.client.login(username='someuser', password='someuser')
        self.user = self._get_user_obj('someuser')
        self.asset = Asset.objects.get(pk=1)
        self.asset.settings = {
            'country': [{'value': 'ZAF', 'label': 'South Africa'}]
        }
        self.asset.save()

        for region in regional_assignments:
            usernames = region.pop('users')
            users = [self._get_user_obj(u) for u in usernames]
            r = ProjectView.objects.create(**region)
            r.users.set(users)
            r.save()

    @staticmethod
    def _get_user_obj(username: str) -> User:
        return User.objects.get(username=username)

    def test_regional_user_perms_for_asset(self):
        actual_perms = sorted(
            [
                PERM_VIEW_ASSET,
                PERM_VIEW_SUBMISSIONS,
                PERM_CHANGE_METADATA_ASSET,
            ]
        )
        regional_asset_perms = get_project_view_user_permissions_for_asset(
            self.asset, self.user
        )
        assert sorted(regional_asset_perms) == actual_perms

    def test_user_has_project_view_asset_perm(self):
        assigned_perms = [
            PERM_VIEW_ASSET,
            PERM_VIEW_SUBMISSIONS,
            PERM_CHANGE_METADATA_ASSET,
        ]
        unassigned_perms = [
            PERM_CHANGE_ASSET,
            PERM_CHANGE_SUBMISSIONS,
        ]

        for perm in assigned_perms:
            assert user_has_project_view_asset_perm(self.asset, self.user, perm)
        for perm in unassigned_perms:
            assert not user_has_project_view_asset_perm(self.asset, self.user, perm)

    def test_user_has_view_perms(self):
        views = ProjectView.objects.filter(
            name__in=['Overview', 'Test view 1']
        ).values_list('uid', flat=True)
        for view in views:
            assert user_has_view_perms(self.user, view)

    def test_view_has_perm(self):
        view = ProjectView.objects.get(name='Test view 1').uid
        assigned_perms = [
            PERM_VIEW_ASSET,
            PERM_VIEW_SUBMISSIONS,
            PERM_CHANGE_METADATA_ASSET,
        ]
        for perm in assigned_perms:
            assert view_has_perm(view, perm)

    def test_get_region_for_view(self):
        assert '*' in get_region_for_view(
            ProjectView.objects.get(name='Overview').uid
        )
        assert sorted(['BWA', 'LSO', 'MOZ', 'NAM', 'ZAF', 'ZWE']) == sorted(
            get_region_for_view(ProjectView.objects.get(name='Test view 1').uid)
        )
