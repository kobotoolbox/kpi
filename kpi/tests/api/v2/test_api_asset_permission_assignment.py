# coding: utf-8
from django.contrib.auth.models import User, Permission
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework import status

from kpi.constants import (
    ASSET_TYPE_TEMPLATE,
    PERM_VIEW_ASSET,
    PERM_CHANGE_ASSET,
    PERM_MANAGE_ASSET,
    PERM_ADD_SUBMISSIONS,
    PERM_DELETE_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
    PERM_CHANGE_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
)
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.object_permission import get_anonymous_user


class BaseApiAssetPermissionTestCase(KpiTestCase):

    fixtures = ["test_data"]

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.admin = User.objects.get(username='admin')
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')

        self.client.login(username='admin', password='pass')
        self.asset = self.create_asset('An asset to be shared')

    def _grant_perm_as_logged_in_user(self, username, codename):
        """
        Uses the API to grant the permission identified by `codename` on
        `self.asset` to the user identified by `username`. Does not attempt any
        authentication.
        """
        data = {
            'user': self.obj_to_url(User.objects.get(username=username)),
            'permission': self.obj_to_url(
                Permission.objects.get(codename=codename)
            ),
        }
        response = self.client.post(
            self.get_asset_perm_assignment_list_url(self.asset),
            data,
            format='json',
        )
        return response


class ApiAssetPermissionTestCase(BaseApiAssetPermissionTestCase):

    def test_owner_can_give_permissions(self):
        # Current user is `self.admin`
        response = self._grant_perm_as_logged_in_user('someuser', PERM_VIEW_ASSET)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_viewers_cannot_give_permissions(self):
        self._grant_perm_as_logged_in_user('someuser', PERM_VIEW_ASSET)
        self.assertTrue(self.asset.has_perm(self.someuser, PERM_VIEW_ASSET))
        self.client.login(username='someuser', password='someuser')
        # Current user is now: `self.someuser`
        response = self._grant_perm_as_logged_in_user('anotheruser', PERM_VIEW_ASSET)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_editors_cannot_give_permissions(self):
        self._grant_perm_as_logged_in_user('someuser', PERM_CHANGE_ASSET)
        self.assertTrue(self.asset.has_perm(self.someuser, PERM_CHANGE_ASSET))
        self.client.login(username='someuser', password='someuser')
        # Current user is now: `self.someuser`
        response = self._grant_perm_as_logged_in_user('anotheruser', PERM_VIEW_ASSET)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_give_permissions(self):
        self.client.logout()
        response = self._grant_perm_as_logged_in_user('someuser', PERM_VIEW_ASSET)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_managers_can_give_permissions(self):
        self._grant_perm_as_logged_in_user('someuser', PERM_MANAGE_ASSET)
        self.assertTrue(self.asset.has_perm(self.someuser, PERM_MANAGE_ASSET))
        self.client.login(username='someuser', password='someuser')
        response = self._grant_perm_as_logged_in_user('anotheruser', PERM_VIEW_ASSET)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_submission_assignments_ignored_for_non_survey_assets(self):
        self.asset.asset_type = ASSET_TYPE_TEMPLATE
        self.asset.save()
        response = self._grant_perm_as_logged_in_user(
            'someuser', PERM_VIEW_SUBMISSIONS
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(self.asset.has_perm(self.someuser, PERM_VIEW_SUBMISSIONS))


class ApiAssetPermissionListTestCase(BaseApiAssetPermissionTestCase):
    """
    TODO Refactor tests - Redundant codes
    """
    fixtures = ["test_data"]

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        super().setUp()

        self.asset.assign_perm(self.someuser, PERM_CHANGE_ASSET)
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_ASSET)
        self.asset.assign_perm(get_anonymous_user(), PERM_VIEW_ASSET)

    def test_viewers_see_only_self_anon_and_owner_assignments(self):

        self.client.login(username='anotheruser', password='anotheruser')
        permission_list_response = self.client.get(
            self.get_asset_perm_assignment_list_url(self.asset), format='json'
        )
        self.assertEqual(
            permission_list_response.status_code, status.HTTP_200_OK
        )
        results = permission_list_response.data

        # `anotheruser` must see only permissions assigned to themselves, the
        # owner (`self.admin`) and the anonymous user. Permissions assigned to
        # `someuser` must not appear
        assignable_perms = self.asset.get_assignable_permissions()
        expected_perms = []
        for user in [self.admin, self.anotheruser, get_anonymous_user()]:
            user_perms = self.asset.get_perms(user)
            expected_perms.extend(
                (user.username, perm)
                for perm in set(user_perms).intersection(assignable_perms)
            )
        expected_perms = sorted(
            expected_perms, key=lambda element: (element[0], element[1])
        )

        obj_perms = []
        for assignment in results:
            object_permission = self.url_to_obj(assignment.get('url'))
            obj_perms.append(
                (
                    object_permission.user.username,
                    object_permission.permission.codename,
                )
            )
        obj_perms = sorted(
            obj_perms, key=lambda element: (element[0], element[1])
        )

        self.assertEqual(expected_perms, obj_perms)

    def test_managers_see_all_assignments(self):
        manager = User(username='businessfish')
        manager.set_password('manage this!')
        manager.save()
        self.asset.assign_perm(manager, PERM_MANAGE_ASSET)

        self.client.login(username='businessfish', password='manage this!')
        response = self.client.get(
            self.get_asset_perm_assignment_list_url(self.asset)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returned_urls = [r['url'] for r in response.data]
        all_obj_perms = self.asset.permissions.all()
        assigned_obj_perms = all_obj_perms.filter(
            permission__codename__in=self.asset.get_assignable_permissions(
                with_partial=False
            ),
        )

        self.assertListEqual(
            sorted(returned_urls),
            sorted(
                self.get_urls_for_asset_perm_assignment_objs(
                    assigned_obj_perms, asset=self.asset
                )
            ),
        )

    def test_editors_see_only_self_anon_and_owner_assignments(self):

        self.client.login(username='someuser', password='someuser')
        permission_list_response = self.client.get(
            self.get_asset_perm_assignment_list_url(self.asset), format='json'
        )
        self.assertEqual(
            permission_list_response.status_code, status.HTTP_200_OK
        )
        results = permission_list_response.data

        # As an editor of the asset, `someuser` should see all.
        assignable_perms = self.asset.get_assignable_permissions()
        expected_perms = []
        for user in [
            self.admin,
            self.someuser,
            # Permissions assigned to self.anotheruser must not appear
            get_anonymous_user(),
        ]:
            user_perms = self.asset.get_perms(user)
            expected_perms.extend(
                (user.username, perm)
                for perm in set(user_perms).intersection(assignable_perms)
            )
        expected_perms = sorted(
            expected_perms, key=lambda element: (element[0], element[1])
        )

        obj_perms = []
        for assignment in results:
            object_permission = self.url_to_obj(assignment.get('url'))
            obj_perms.append(
                (
                    object_permission.user.username,
                    object_permission.permission.codename,
                )
            )
        obj_perms = sorted(
            obj_perms, key=lambda element: (element[0], element[1])
        )

        self.assertEqual(expected_perms, obj_perms)

    def test_anonymous_get_only_owner_and_anonymous_assignments(self):

        self.client.logout()
        permission_list_response = self.client.get(
            self.get_asset_perm_assignment_list_url(self.asset), format='json'
        )
        self.assertEqual(permission_list_response.status_code, status.HTTP_200_OK)
        admin = self.admin
        admin_perms = self.asset.get_perms(admin)
        anon = get_anonymous_user()
        anon_perms = self.asset.get_perms(anon)
        assignable_perms = self.asset.get_assignable_permissions()
        results = permission_list_response.data

        # Get admin permissions.
        expected_perms = []
        for user, perms in [(anon, anon_perms), (admin, admin_perms)]:
            for perm in perms:
                if perm in assignable_perms:
                    expected_perms.append((user.username, perm))

        expected_perms = sorted(expected_perms, key=lambda element: (element[0],
                                                                     element[1]))
        obj_perms = []
        for assignment in results:
            object_permission = self.url_to_obj(assignment.get('url'))
            obj_perms.append((object_permission.user.username,
                              object_permission.permission.codename))

        obj_perms = sorted(obj_perms, key=lambda element: (element[0],
                                                           element[1]))
        self.assertEqual(expected_perms, obj_perms)


class ApiBulkAssetPermissionTestCase(BaseApiAssetPermissionTestCase):

    def _assign_perms_as_logged_in_user(self, assignments):
        """
        Uses the bulk API to replace the permission assignments of `self.asset`
        with `assignments`. Does not attempt any authentication.
        """
        url = reverse(
            # this view name is a bit... bulky
            self._get_endpoint('asset-permission-assignment-bulk-assignments'),
            kwargs={'parent_lookup_asset': self.asset.uid}
        )

        def get_data_template(username_, codename_):
            return {
                'user': self.obj_to_url(User.objects.get(username=username)),
                'permission': self.obj_to_url(
                    Permission.objects.get(codename=codename_)
                ),
            }

        data = []
        for username, codename in assignments:
            data.append(get_data_template(username, codename))
        response = self.client.post(url, data, format='json')
        return response

    def test_cannot_assign_permissions_to_owner(self):
        self._grant_perm_as_logged_in_user('someuser', PERM_MANAGE_ASSET)
        self.client.login(username='someuser', password='someuser')
        response = self._assign_perms_as_logged_in_user([
            ('admin', PERM_VIEW_ASSET),
            ('admin', PERM_CHANGE_ASSET)
        ])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_owner_can_assign_permissions(self):
        permission_list_response = self.client.get(
            self.get_asset_perm_assignment_list_url(self.asset), format='json'
        )
        self.assertEqual(permission_list_response.status_code, status.HTTP_200_OK)

        response = self._assign_perms_as_logged_in_user([
            ('someuser', PERM_VIEW_ASSET),
            ('someuser', PERM_VIEW_ASSET),  # Add a duplicate which should not count
            ('anotheruser', PERM_CHANGE_ASSET)
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returned_urls = [r['url'] for r in response.data]
        all_obj_perms = self.asset.permissions.all()
        assigned_obj_perms = all_obj_perms.filter(
            permission__codename__in=self.asset.get_assignable_permissions(
                with_partial=False
            )
        )
        self.assertListEqual(
            sorted(
                assigned_obj_perms.values_list(
                    'user__username', 'permission__codename'
                )
            ),
            sorted([
                ('admin', PERM_VIEW_ASSET),
                ('admin', PERM_CHANGE_ASSET),
                ('admin', PERM_MANAGE_ASSET),
                ('admin', PERM_ADD_SUBMISSIONS),
                ('admin', PERM_DELETE_SUBMISSIONS),
                ('admin', PERM_VIEW_SUBMISSIONS),
                ('admin', PERM_CHANGE_SUBMISSIONS),
                ('admin', PERM_VALIDATE_SUBMISSIONS),
                ('someuser', PERM_VIEW_ASSET),
                ('anotheruser', PERM_VIEW_ASSET),
                ('anotheruser', PERM_CHANGE_ASSET),
            ]),
        )
        self.assertListEqual(
            sorted(returned_urls),
            sorted(
                self.get_urls_for_asset_perm_assignment_objs(
                    assigned_obj_perms, asset=self.asset
                )
            ),
        )

    def test_assignment_removes_old_permissions(self):
        self.asset.assign_perm(self.someuser, PERM_CHANGE_ASSET)
        self.assertTrue(self.asset.has_perm(self.someuser, PERM_CHANGE_ASSET))
        response = self._assign_perms_as_logged_in_user([
            ('someuser', PERM_VIEW_ASSET),
            ('anotheruser', PERM_CHANGE_ASSET)
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(self.asset.has_perm(self.someuser, PERM_CHANGE_ASSET))

    def test_viewers_cannot_give_permissions(self):
        self.asset.assign_perm(self.someuser, PERM_VIEW_ASSET)
        self.assertTrue(self.asset.has_perm(self.someuser, PERM_VIEW_ASSET))
        self.client.login(username='someuser', password='someuser')
        response = self._assign_perms_as_logged_in_user([
            ('anotheruser', PERM_CHANGE_ASSET),
            ('anotheruser', PERM_CHANGE_SUBMISSIONS)
        ])
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        # If they don't have `view_asset`, they don't have anything, and we're
        # in good shape
        self.assertFalse(self.asset.has_perm(self.anotheruser, PERM_VIEW_ASSET))

    def test_editors_cannot_give_permissions(self):
        self._grant_perm_as_logged_in_user('someuser', PERM_CHANGE_ASSET)
        self.assertTrue(self.asset.has_perm(self.someuser, PERM_CHANGE_ASSET))
        self.client.login(username='someuser', password='someuser')
        response = self._assign_perms_as_logged_in_user([
            ('anotheruser', PERM_CHANGE_ASSET),
            ('anotheruser', PERM_CHANGE_SUBMISSIONS)
        ])
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(self.asset.has_perm(self.anotheruser, PERM_VIEW_ASSET))

    def test_anonymous_cannot_give_permissions(self):
        self.client.logout()
        response = self._assign_perms_as_logged_in_user([
            ('anotheruser', PERM_CHANGE_ASSET),
            ('anotheruser', PERM_CHANGE_SUBMISSIONS)
        ])
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(self.asset.has_perm(self.anotheruser, PERM_VIEW_ASSET))

    def test_managers_can_give_permissions(self):
        self._grant_perm_as_logged_in_user('someuser', PERM_MANAGE_ASSET)
        self.assertTrue(self.asset.has_perm(self.someuser, PERM_MANAGE_ASSET))
        self.client.login(username='someuser', password='someuser')
        response = self._assign_perms_as_logged_in_user([
            ('anotheruser', PERM_CHANGE_ASSET),
            ('anotheruser', PERM_CHANGE_SUBMISSIONS)
        ])
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(self.asset.has_perm(self.anotheruser, PERM_CHANGE_ASSET))
        self.assertTrue(self.asset.has_perm(self.anotheruser, PERM_CHANGE_SUBMISSIONS))

    def test_submission_assignments_ignored_for_non_survey_assets(self):
        self.asset.asset_type = ASSET_TYPE_TEMPLATE
        self.asset.save()
        response = self._assign_perms_as_logged_in_user(
            [
                ('someuser', PERM_VIEW_SUBMISSIONS),
                ('anotheruser', PERM_VALIDATE_SUBMISSIONS),
            ]
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(self.asset.has_perm(self.someuser, PERM_VIEW_SUBMISSIONS))
        self.assertFalse(self.asset.has_perm(self.anotheruser, PERM_VALIDATE_SUBMISSIONS))
