# coding: utf-8
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status

from kpi.constants import PERM_VIEW_COLLECTION, PERM_CHANGE_COLLECTION
from kpi.models import Collection
from kpi.models.object_permission import get_anonymous_user
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class BaseApiCollectionPermissionTestCase(KpiTestCase):

    fixtures = ["test_data"]

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.admin = User.objects.get(username='admin')
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')

        self.client.login(username='admin', password='pass')
        self.collection = self.create_collection('A collection to be shared')

        self.admin_detail_url = reverse(
            self._get_endpoint('user-detail'),
            kwargs={'username': self.admin.username})

        self.someuser_detail_url = reverse(
            self._get_endpoint('user-detail'),
            kwargs={'username': self.someuser.username})

        self.anotheruser_detail_url = reverse(
            self._get_endpoint('user-detail'),
            kwargs={'username': self.anotheruser.username})

        self.view_collection_permission_detail_url = reverse(
            self._get_endpoint('permission-detail'),
            kwargs={'codename': PERM_VIEW_COLLECTION})

        self.change_collection_permission_detail_url = reverse(
            self._get_endpoint('permission-detail'),
            kwargs={'codename': PERM_CHANGE_COLLECTION})

        self.collection_permissions_list_url = reverse(
            self._get_endpoint('collection-permission-assignment-list'),
            kwargs={'parent_lookup_collection': self.collection.uid}
        )

    def _logged_user_gives_permission(self, username, permission):
        data = {
            'user': getattr(self, '{}_detail_url'.format(username)),
            'permission': getattr(self, '{}_permission_detail_url'.format(permission))
        }
        response = self.client.post(self.collection_permissions_list_url,
                                    data, format='json')
        return response


class ApiCollectionPermissionTestCase(BaseApiCollectionPermissionTestCase):

    def test_owner_can_give_permissions(self):
        # Current user is `self.admin`
        response = self._logged_user_gives_permission('someuser', PERM_VIEW_COLLECTION)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_viewers_can_not_give_permissions(self):
        self._logged_user_gives_permission('someuser', PERM_VIEW_COLLECTION)
        self.client.login(username='someuser', password='someuser')
        # Current user is now: `self.someuser`
        response = self._logged_user_gives_permission('anotheruser', PERM_VIEW_COLLECTION)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_editors_can_give_permissions(self):
        self._logged_user_gives_permission('someuser', PERM_CHANGE_COLLECTION)
        self.client.login(username='someuser', password='someuser')
        # Current user is now: `self.someuser`
        response = self._logged_user_gives_permission('anotheruser', PERM_VIEW_COLLECTION)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_anonymous_can_not_give_permissions(self):
        self.client.logout()
        response = self._logged_user_gives_permission('someuser', PERM_VIEW_COLLECTION)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ApiCollectionPermissionListTestCase(BaseApiCollectionPermissionTestCase):
    fixtures = ["test_data"]

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        super().setUp()

        self.collection.assign_perm(self.someuser, PERM_CHANGE_COLLECTION)
        self.collection.assign_perm(self.anotheruser, PERM_VIEW_COLLECTION)

    def test_viewers_see_only_their_own_assignments_and_owner_s(self):

        # Checks if can see all permissions
        self.client.login(username='anotheruser', password='anotheruser')
        permission_list_response = self.client.get(self.collection_permissions_list_url,
                                                   format='json')
        self.assertEqual(permission_list_response.status_code, status.HTTP_200_OK)
        admin_perms = self.collection.get_perms(self.admin)
        anotheruser_perms = self.collection.get_perms(self.anotheruser)
        results = permission_list_response.data

        # `anotheruser` can only see the owner's permissions `self.admin` and
        # `anotheruser`'s permissions. Should not see `someuser`s ones.
        expected_perms = []
        for admin_perm in admin_perms:
            if admin_perm in Collection.get_assignable_permissions():
                expected_perms.append((self.admin.username, admin_perm))
        for anotheruser_perm in anotheruser_perms:
            if anotheruser_perm in Collection.get_assignable_permissions():
                expected_perms.append((self.anotheruser.username, anotheruser_perm))

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

    def test_editors_see_all_assignments(self):

        self.client.login(username='someuser', password='someuser')
        permission_list_response = self.client.get(self.collection_permissions_list_url,
                                                   format='json')
        self.assertEqual(permission_list_response.status_code, status.HTTP_200_OK)
        admin_perms = self.collection.get_perms(self.admin)
        someuser_perms = self.collection.get_perms(self.someuser)
        anotheruser_perms = self.collection.get_perms(self.anotheruser)
        results = permission_list_response.data

        # As an editor of the collection. `someuser` should see all.
        expected_perms = []
        for admin_perm in admin_perms:
            if admin_perm in Collection.get_assignable_permissions():
                expected_perms.append((self.admin.username, admin_perm))
        for someuser_perm in someuser_perms:
            if someuser_perm in Collection.get_assignable_permissions():
                expected_perms.append((self.someuser.username, someuser_perm))
        for anotheruser_perm in anotheruser_perms:
            if anotheruser_perm in Collection.get_assignable_permissions():
                expected_perms.append((self.anotheruser.username, anotheruser_perm))

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

    def test_anonymous_get_only_owner_s_assignments(self):

        self.client.logout()
        self.collection.assign_perm(get_anonymous_user(), PERM_VIEW_COLLECTION)
        permission_list_response = self.client.get(self.collection_permissions_list_url,
                                                   format='json')
        self.assertEqual(permission_list_response.status_code, status.HTTP_200_OK)
        admin_perms = self.collection.get_perms(self.admin)
        results = permission_list_response.data

        # As an editor of the collection. `someuser` should see all.
        expected_perms = []
        for admin_perm in admin_perms:
            if admin_perm in Collection.get_assignable_permissions():
                expected_perms.append((self.admin.username, admin_perm))

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


class ApiBulkCollectionPermissionTestCase(BaseApiCollectionPermissionTestCase):

    def _logged_user_gives_permissions(self, assignments):
        """
        Uses the API to grant `permission` to `username`
        """
        url = '{}bulk/'.format(self.collection_permissions_list_url)

        def get_data_template(username_, permission_):
            return {
                'user': getattr(self, '{}_detail_url'.format(username_)),
                'permission': getattr(self, '{}_permission_detail_url'.format(
                    permission_))
            }

        data = []
        for username, permission in assignments:
            data.append(get_data_template(username, permission))

        response = self.client.post(url, data, format='json')
        return response

    def test_cannot_assign_permissions_to_owner(self):
        self._logged_user_gives_permission('someuser', PERM_CHANGE_COLLECTION)
        self.client.login(username='someuser', password='someuser')
        response = self._logged_user_gives_permissions([
            ('admin', PERM_VIEW_COLLECTION),
            ('admin', PERM_CHANGE_COLLECTION)
        ])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_assign_permissions(self):
        # TODO Improve this test
        permission_list_response = self.client.get(self.collection_permissions_list_url,
                                                   format='json')
        self.assertEqual(permission_list_response.status_code, status.HTTP_200_OK)
        total = len(permission_list_response.data)
        # Add number of permissions added with 'view_collection'
        total += len(Collection.get_implied_perms(PERM_VIEW_COLLECTION)) + 1
        # Add number of permissions added with 'change_collection'
        total += len(Collection.get_implied_perms(PERM_CHANGE_COLLECTION)) + 1

        response = self._logged_user_gives_permissions([
            ('someuser', PERM_VIEW_COLLECTION),
            ('someuser', PERM_VIEW_COLLECTION),  # Add a duplicate which should not count
            ('anotheruser', PERM_CHANGE_COLLECTION)
        ])

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), total)
