# coding: utf-8
import json

from constance.test import override_config
from django.contrib.auth.models import User

from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.utils.regional_views import (
    RegionalView,
    RegionalAssignment,
    get_regional_views,
    get_regional_assignments,
    get_regional_user_permissions_for_asset,
    user_has_regional_asset_perm,
    user_has_view_perms,
    view_has_perm,
    get_region_for_view,
    get_regional_views_for_user,
    get_view_as_int,
)


config = {
    'REGIONAL_VIEWS': json.dumps(
        [
            {
                'id': 0,
                'label': 'Overview',
                'countries': '*',
                'permissions': [
                    'view_asset',
                    'view_permissions',
                ],
            },
            {
                'id': 1,
                'label': 'Test view 1',
                'countries': ['ZAF', 'NAM', 'ZWE', 'MOZ', 'BWA', 'LSO'],
                'permissions': [
                    'view_asset',
                    'view_submissions',
                    'change_metadata',
                ],
            },
            {
                'id': 2,
                'label': 'Test view 2',
                'countries': ['USA', 'CAN'],
                'permissions': [
                    'view_asset',
                    'view_permissions',
                ],
            },
        ]
    ),
    'REGIONAL_ASSIGNMENTS': json.dumps(
        [
            {'username': 'someuser', 'view': 0},
            {'username': 'someuser', 'view': 1},
            {'username': 'anotheruser', 'view': 1},
            {'username': 'anotheruser', 'view': 2},
        ]
    ),
}


class RegionalViewsUtilsTestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.user = User.objects.get(username='someuser')
        self.asset = Asset.objects.get(pk=1)
        self.asset.settings = {
            'country': [{'value': 'ZAF', 'label': 'South Africa'}]
        }
        self.asset.save()

    @override_config(**config)
    def test_regional_views_config(self):
        actual_views = json.loads(config['REGIONAL_VIEWS'])
        regional_views = get_regional_views()
        assert len(regional_views) == len(actual_views)
        assert regional_views[0] == RegionalView(**actual_views[0])
        assert regional_views[0].to_dict() == actual_views[0]

    @override_config(**config)
    def test_regional_assignments_config(self):
        actual_assignments = json.loads(config['REGIONAL_ASSIGNMENTS'])
        regional_assignments = get_regional_assignments()
        assert len(regional_assignments) == len(actual_assignments)
        assert regional_assignments[0] == RegionalAssignment(
            **actual_assignments[0]
        )
        assert regional_assignments[0].to_dict() == actual_assignments[0]

    @override_config(**config)
    def test_regional_user_perms_for_asset(self):
        actual_perms = sorted(
            [
                'view_asset',
                'view_permissions',
                'view_submissions',
                'change_metadata',
            ]
        )
        regional_asset_perms = get_regional_user_permissions_for_asset(
            self.asset, self.user
        )
        assert sorted(regional_asset_perms) == actual_perms

    @override_config(**config)
    def test_user_has_regional_asset_perm(self):
        assigned_perms = [
            'view_asset',
            'view_permissions',
            'view_submissions',
            'change_metadata',
        ]
        unassigned_perms = [
            'change_asset',
            'change_submissions',
        ]

        for perm in assigned_perms:
            assert user_has_regional_asset_perm(self.asset, self.user, perm)
        for perm in unassigned_perms:
            assert not user_has_regional_asset_perm(self.asset, self.user, perm)

    @override_config(**config)
    def test_user_has_view_perms(self):
        views = [0, 1]
        for view in views:
            assert user_has_view_perms(self.user, view)

    @override_config(**config)
    def test_view_has_perm(self):
        view = 1
        assigned_perms = [
            'view_asset',
            'view_submissions',
            'change_metadata',
        ]
        for perm in assigned_perms:
            assert view_has_perm(view, perm)

    @override_config(**config)
    def test_get_region_for_view(self):
        assert '*' == get_region_for_view(0)
        assert sorted(['BWA', 'LSO', 'MOZ', 'NAM', 'ZAF', 'ZWE']) == sorted(
            get_region_for_view(1)
        )

    @override_config(**config)
    def test_get_regional_views_for_user(self):
        assert sorted([0, 1]) == sorted(
            [v.id for v in get_regional_views_for_user(self.user)]
        )

    def test_get_view_as_int(self):
        assert get_view_as_int('1') == 1
        assert get_view_as_int(None) is None
        with self.assertRaises(Exception):
            get_view_as_int('Something not an int or None')
