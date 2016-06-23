from django.contrib.auth.models import (
    Permission,
    User,)
from django.core.urlresolvers import reverse
from rest_framework import status

from ..models.object_permission import get_anonymous_user
from .kpi_test_case import KpiTestCase


class ApiAnonymousPermissionsTestCase(KpiTestCase):

    def setUp(self):
        self.anon= get_anonymous_user()
        self.someuser = User.objects.get(username='someuser')
        self.someuser_password = 'someuser'

        # This was written when we allowed anons to create assets, but I'll
        # leave it here just to make sure it has no effect
        permission= Permission.objects.get(codename='add_asset')
        self.anon.user_permissions.add(permission)

        # Log in and create an asset that anon can access
        self.client.login(username=self.someuser.username,
                          password=self.someuser_password)
        self.anon_accessible = self.create_asset('Anonymous can access this!')
        self.add_perm(self.anon_accessible, self.anon, 'view_')
        # Log out and become anonymous again
        self.client.logout()
        response = self.client.get(reverse('current-user'))
        self.assertFalse('username' in response.data)

    def test_anon_list_assets(self):
        # `view_` granted to anon means detail access, NOT list access
        self.assert_object_in_object_list(self.anon_accessible, in_list=False)

    def test_anon_asset_detail(self):
        self.assert_detail_viewable(self.anon_accessible)

    def test_cannot_create_asset(self):
        url = reverse('asset-list')
        data = {'name': 'my asset', 'content': ''}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN,
                         msg="anonymous user cannot create a asset")

    def test_cannot_create_collection(self):
        url = reverse('collection-list')
        data = {'name': 'my collection', 'collections': [], 'assets': []}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN,
                         msg="anonymous user cannot create a collection")


class ApiPermissionsPublicAssetTestCase(KpiTestCase):
    def setUp(self):
        KpiTestCase.setUp(self)

        self.anon= get_anonymous_user()
        self.admin= User.objects.get(username='admin')
        self.admin_password= 'pass'
        self.someuser= User.objects.get(username='someuser')
        self.someuser_password= 'someuser'

        self.login(self.admin.username, self.admin_password)
        self.admins_public_asset= self.create_asset('admins_public_asset')
        self.add_perm(self.admins_public_asset, self.anon, 'view')

        self.login(self.someuser.username, self.someuser_password)
        self.someusers_public_asset= self.create_asset('someusers_public_asset')
        self.add_perm(self.someusers_public_asset, self.anon, 'view')

    def test_user_can_view_public_asset(self):
        self.assert_detail_viewable(self.admins_public_asset, self.someuser, self.someuser_password)

    def test_public_asset_not_in_list_user(self):
        self.assert_object_in_object_list(self.admins_public_asset, self.someuser, self.someuser_password,
                                     in_list=False)

    def test_public_asset_not_in_list_admin(self):
        self.assert_object_in_object_list(self.someusers_public_asset, self.admin, self.admin_password,
                                     in_list=False)


class ApiPermissionsTestCase(KpiTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.admin= User.objects.get(username='admin')
        self.admin_password= 'pass'
        self.someuser= User.objects.get(username='someuser')
        self.someuser_password= 'someuser'

        self.assertTrue(self.client.login(username=self.admin.username,
                                          password=self.admin_password))
        self.admin_asset= self.create_asset('admin_asset')
        self.admin_collection= self.create_collection('admin_collection')
        self.child_collection= self.create_collection('child_collection')
        self.add_to_collection(self.child_collection, self.admin_collection)
        self.client.logout()

################# Asset tests #####################

    def test_own_asset_in_asset_list(self):
        self.assert_viewable(self.admin_asset, self.admin,
                             self.admin_password)

    def test_viewable_asset_in_asset_list(self):
        # Give "someuser" view permissions on an asset owned by "admin".
        self.add_perm(self.admin_asset, self.someuser, 'view_')

        # Test that "someuser" can now view the asset.
        self.assert_viewable(self.admin_asset, self.someuser,
                             self.someuser_password)

    def test_non_viewable_asset_not_in_asset_list(self):
        # Wow, that's quite a function name...
        # Ensure that "someuser" doesn't have permission to view the survey
        #   asset owned by "admin".
        perm_name= self._get_perm_name('view_', self.admin_asset)
        self.assertFalse(self.someuser.has_perm(perm_name, self.admin_asset))

        # Verify they can't view the asset through the API.
        self.assert_viewable(self.admin_asset, self.someuser,
                             self.someuser_password, viewable=False)

    def test_inherited_viewable_assets_in_asset_list(self):
        # Give "someuser" view permissions on a collection owned by "admin" and
        #   add an asset also owned by "admin" to that collection.
        self.add_perm(self.admin_asset, self.someuser, 'view_')

        self.add_to_collection(self.admin_asset, self.admin_collection,
                               self.admin, self.admin_password)

        # Test that "someuser" can now view the asset.
        self.assert_viewable(self.admin_asset, self.someuser,
                             self.someuser_password)

    def test_viewable_asset_inheritance_conflict(self):
        # Log in as "admin", create a new child collection, and add an asset to
        #   that collection.
        self.add_to_collection(self.admin_asset, self.child_collection,
                               self.admin, self.admin_password)

        # Give "someuser" view permission on 'child_collection'.
        self.add_perm(self.child_collection, self.someuser, 'view_')

        # Give "someuser" view permission on the parent collection.
        self.add_perm(self.admin_collection, self.someuser, 'view_')

        # Revoke the view permissions of "someuser" on the parent collection.
        self.remove_perm(self.admin_collection, self.admin,
                         self.admin_password, self.someuser,
                         self.someuser_password, 'view_')

        # Confirm that "someuser" can view the contents of 'child_collection'.
        self.assert_viewable(self.admin_asset, self.someuser,
                             self.someuser_password)

    def test_non_viewable_asset_inheritance_conflict(self):
        # Log in as "admin", create a new child collection, and add an asset to
        #   that collection.
        self.add_to_collection(self.admin_asset, self.child_collection,
                               self.admin, self.admin_password)

        # Give "someuser" view permission on the parent collection.
        self.add_perm(self.admin_collection, self.someuser, 'view_')

        # Revoke the view permissions of "someuser" on the child collection.
        self.remove_perm(self.child_collection, self.admin, self.admin_password,
                         self.someuser, self.someuser_password, 'view_')

        # Confirm that "someuser" can't view the contents of 'child_collection'.
        self.assert_viewable(self.admin_asset, self.someuser,
                             self.someuser_password, viewable=False)

    def test_viewable_asset_not_deletable(self):
        # Give "someuser" view permissions on an asset owned by "admin".
        self.add_perm(self.admin_asset, self.someuser, 'view_')

        # Confirm that "someuser" is not allowed to delete the asset.
        delete_perm= self._get_perm_name('delete_', self.admin_asset)
        self.assertFalse(self.someuser.has_perm(delete_perm, self.admin_asset))

        # Test that "someuser" can't delete the asset.
        self.client.login(username=self.someuser.username,
                          password=self.someuser_password)
        url= reverse('asset-detail', kwargs={'uid': self.admin_asset.uid})
        response= self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inherited_viewable_asset_not_deletable(self):
        # Give "someuser" view permissions on a collection owned by "admin" and
        #   add an asset also owned by "admin" to that collection.
        self.add_perm(self.admin_asset, self.someuser, 'view_')
        self.add_to_collection(self.admin_asset, self.admin_collection,
                               self.admin, self.admin_password)

        # Confirm that "someuser" is not allowed to delete the asset.
        delete_perm= self._get_perm_name('delete_', self.admin_asset)
        self.assertFalse(self.someuser.has_perm(delete_perm, self.admin_asset))

        # Test that "someuser" can't delete the asset.
        self.client.login(username=self.someuser.username,
                          password=self.someuser_password)
        url= reverse('asset-detail', kwargs={'uid': self.admin_asset.uid})
        response= self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

############# Collection tests ###############

    def test_own_collection_in_collection_list(self):
        self.assert_viewable(self.admin_collection, self.admin,
                             self.admin_password)

    def test_viewable_collection_in_collection_list(self):
        # Give "someuser" view permissions on a collection owned by "admin".
        self.add_perm(self.admin_collection, self.someuser, 'view_')

        # Test that "someuser" can now view the collection.
        self.assert_viewable(self.admin_collection, self.someuser,
                             self.someuser_password)

    def test_non_viewable_collection_not_in_collection_list(self):
        # Wow, that's quite a function name...
        # Ensure that "someuser" doesn't have permission to view the survey
        #   collection owned by "admin".
        perm_name= self._get_perm_name('view_', self.admin_collection)
        self.assertFalse(self.someuser.has_perm(perm_name, self.admin_collection))

        # Verify they can't view the collection through the API.
        self.assert_viewable(self.admin_collection, self.someuser,
                             self.someuser_password, viewable=False)

    def test_inherited_viewable_collections_in_collection_list(self):
        # Give "someuser" view permissions on the parent collection.
        self.add_perm(self.admin_collection, self.someuser, 'view_')
        # Test that "someuser" can now view the child collection.
        self.assert_viewable(self.child_collection, self.someuser,
                             self.someuser_password)

    def test_viewable_collection_inheritance_conflict(self):
        grandchild_collection= self.create_collection('grandchild_collection',
                                                      self.admin, self.admin_password)
        self.add_to_collection(grandchild_collection, self.child_collection,
                               self.admin, self.admin_password)

        # Give "someuser" view permission on 'child_collection'.
        self.add_perm(self.child_collection, self.someuser, 'view_')

        # Give "someuser" view permission on the parent collection.
        self.add_perm(self.admin_collection, self.someuser, 'view_')

        # Revoke the view permissions of "someuser" on 'parent_collection'.
        self.remove_perm(self.admin_collection, self.admin,
                         self.admin_password, self.someuser,
                         self.someuser_password, 'view_')

        # Confirm that "someuser" can view 'grandchild_collection'.
        self.assert_viewable(grandchild_collection, self.someuser,
                             self.someuser_password)

    def test_non_viewable_collection_inheritance_conflict(self):
        grandchild_collection= self.create_collection('grandchild_collection',
                                                      self.admin, self.admin_password)
        self.add_to_collection(grandchild_collection, self.child_collection,
                               self.admin, self.admin_password)

        # Give "someuser" view permission on the parent collection.
        self.add_perm(self.admin_collection, self.someuser, 'view_')

        # Revoke the view permissions of "someuser" on the child collection.
        self.remove_perm(self.child_collection, self.admin,
                         self.admin_password, self.someuser,
                         self.someuser_password, 'view_')

        # Confirm that "someuser" can't view 'grandchild_collection'.
        self.assert_viewable(grandchild_collection, self.someuser,
                             self.someuser_password, viewable=False)

    def test_viewable_collection_not_deletable(self):
        # Give "someuser" view permissions on a collection owned by "admin".
        self.add_perm(self.admin_collection, self.someuser, 'view_')

        # Confirm that "someuser" is not allowed to delete the collection.
        delete_perm= self._get_perm_name('delete_', self.admin_collection)
        self.assertFalse(self.someuser.has_perm(delete_perm,
                                                self.admin_collection))

        # Test that "someuser" can't delete the collection.
        self.client.login(username=self.someuser.username,
                          password=self.someuser_password)
        url= reverse('collection-detail', kwargs={'uid':
                                                  self.admin_collection.uid})
        response= self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inherited_viewable_collection_not_deletable(self):
        # Give "someuser" view permissions on a collection owned by "admin".
        self.add_perm(self.admin_collection, self.someuser, 'view_')

        # Confirm that "someuser" is not allowed to delete the child collection.
        delete_perm= self._get_perm_name('delete_', self.child_collection)
        self.assertFalse(self.someuser.has_perm(delete_perm, self.child_collection))

        # Test that "someuser" can't delete the child collection.
        self.client.login(username=self.someuser.username,
                          password=self.someuser_password)
        url= reverse('collection-detail', kwargs={'uid':
                                                  self.child_collection.uid})
        response= self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
