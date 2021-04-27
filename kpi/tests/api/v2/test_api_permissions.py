# coding: utf-8
from django.contrib.auth.models import User, Permission
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from kpi.constants import (
    ASSET_TYPE_COLLECTION,
    PERM_CHANGE_ASSET,
    PERM_MANAGE_ASSET,
    PERM_VIEW_ASSET,
)
from kpi.models import Asset, ObjectPermission
from kpi.models.object_permission import get_anonymous_user
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class ApiAnonymousPermissionsTestCase(KpiTestCase):
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.anon = get_anonymous_user()
        self.someuser = User.objects.get(username='someuser')
        self.someuser_password = 'someuser'

        # This was written when we allowed anons to create assets, but I'll
        # leave it here just to make sure it has no effect
        permission = Permission.objects.get(codename='add_asset')
        self.anon.user_permissions.add(permission)

        # Log in and create an asset that anon can access
        self.client.login(username=self.someuser.username,
                          password=self.someuser_password)
        self.anon_accessible = self.create_asset('Anonymous can access this!')
        self.add_perm(self.anon_accessible, self.anon, 'view_')
        # Log out and become anonymous again
        self.client.logout()
        response = self.client.get(reverse('currentuser-detail'))
        self.assertFalse('username' in response.data)

    def test_anon_list_assets(self):
        # `view_` granted to anon means detail access, NOT list access
        self.assert_object_in_object_list(self.anon_accessible, in_list=False)

    def test_anon_asset_detail(self):
        self.assert_detail_viewable(self.anon_accessible)

    def test_cannot_create_asset(self):
        url = reverse(self._get_endpoint('asset-list'))
        data = {'name': 'my asset', 'content': ''}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN,
                         msg="anonymous user cannot create a asset")


class ApiPermissionsPublicAssetTestCase(KpiTestCase):
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        KpiTestCase.setUp(self)

        self.anon = get_anonymous_user()
        self.admin = User.objects.get(username='admin')
        self.admin_password = 'pass'
        self.someuser = User.objects.get(username='someuser')
        self.someuser_password = 'someuser'

        self.login(self.admin.username, self.admin_password)
        self.admins_public_asset = self.create_asset('admins_public_asset')
        self.add_perm(self.admins_public_asset, self.anon, 'view')

        self.login(self.someuser.username, self.someuser_password)
        self.someusers_public_asset = self.create_asset('someusers_public_asset')
        self.add_perm(self.someusers_public_asset, self.anon, 'view')

    def test_user_can_view_public_asset(self):
        self.assert_detail_viewable(self.admins_public_asset, self.someuser, self.someuser_password)

    def test_public_asset_not_in_list_user(self):
        self.assert_object_in_object_list(self.admins_public_asset, self.someuser, self.someuser_password,
                                          in_list=False)

    def test_public_asset_not_in_list_admin(self):
        self.assert_object_in_object_list(self.someusers_public_asset, self.admin, self.admin_password,
                                          in_list=False)

    def test_revoke_anon_from_asset_in_public_collection(self):
        self.login(self.someuser.username, self.someuser_password)
        public_collection = self.create_collection('public_collection')
        child_asset = self.create_asset('child_asset_in_public_collection')
        self.add_to_collection(child_asset, public_collection)
        child_asset.refresh_from_db()

        # Anon should have no access at this point
        self.client.logout()
        self.assert_viewable(child_asset, viewable=False)

        # Grant anon access to the parent collection
        self.login(self.someuser.username, self.someuser_password)
        self.add_perm(public_collection, self.anon, 'view_')

        # Verify anon can access the child asset
        self.client.logout()
        # Anon can only see a public asset by accessing the detail view
        # directly; `assert_viewble()` will always fail because it expects the
        # asset to be in the list view as well
        self.assert_detail_viewable(child_asset)

        # Revoke anon's access to the child asset
        self.login(self.someuser.username, self.someuser_password)
        self.remove_perm_v2_api(child_asset, self.anon, PERM_VIEW_ASSET)

        # Make sure anon cannot access the child asset any longer
        self.client.logout()
        self.assert_viewable(child_asset, viewable=False)


class ApiPermissionsTestCase(KpiTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.admin = User.objects.get(username='admin')
        self.admin_password = 'pass'
        self.someuser = User.objects.get(username='someuser')
        self.someuser_password = 'someuser'
        self.anotheruser = User.objects.get(username='anotheruser')
        self.anotheruser_password = 'anotheruser'

        self.assertTrue(self.client.login(username=self.admin.username,
                                          password=self.admin_password))
        self.admin_asset = self.create_asset('admin_asset')
        self.admin_collection = self.create_collection('admin_collection')
        self.child_collection = self.create_collection('child_collection')
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
        perm_name = self._get_perm_name('view_', self.admin_asset)
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
        delete_perm = self._get_perm_name('delete_', self.admin_asset)
        self.assertFalse(self.someuser.has_perm(delete_perm, self.admin_asset))

        # Test that "someuser" can't delete the asset.
        self.client.login(username=self.someuser.username,
                          password=self.someuser_password)
        url = reverse(self._get_endpoint('asset-detail'), kwargs={'uid': self.admin_asset.uid})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inherited_viewable_asset_not_deletable(self):
        # Give "someuser" view permissions on a collection owned by "admin" and
        #   add an asset also owned by "admin" to that collection.
        self.add_perm(self.admin_asset, self.someuser, 'view_')
        self.add_to_collection(self.admin_asset, self.admin_collection,
                               self.admin, self.admin_password)

        # Confirm that "someuser" is not allowed to delete the asset.
        delete_perm = self._get_perm_name('delete_', self.admin_asset)
        self.assertFalse(self.someuser.has_perm(delete_perm, self.admin_asset))

        # Test that "someuser" can't delete the asset.
        self.client.login(username=self.someuser.username,
                          password=self.someuser_password)
        url = reverse(self._get_endpoint('asset-detail'), kwargs={'uid': self.admin_asset.uid})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_shared_asset_remove_own_permissions_allowed(self):
        """
        Ensuring that a non-owner who has been shared an asset is able to remove
        themselves from that asset if they want.
        """
        self.client.login(
            username=self.someuser.username,
            password=self.someuser_password,
        )
        new_asset = self.create_asset(
            name='a new asset',
            owner=self.someuser,
        )
        perm = new_asset.assign_perm(self.anotheruser, 'view_asset')
        kwargs = {
            'parent_lookup_asset': new_asset.uid,
            'uid': perm.uid,
        }
        url = reverse(
            'api_v2:asset-permission-assignment-detail', kwargs=kwargs
        )
        self.client.logout()
        self.client.login(
            username=self.anotheruser.username,
            password=self.anotheruser_password,
        )
        assert self.anotheruser.has_perm(PERM_VIEW_ASSET, new_asset)

        # `anotheruser` attempting to remove themselves from the asset
        res = self.client.delete(url)
        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert not self.anotheruser.has_perm(PERM_VIEW_ASSET, new_asset)
        assert len(new_asset.get_perms(self.anotheruser)) == 0

    def test_shared_asset_non_owner_remove_owners_permissions_not_allowed(self):
        """
        Ensuring that a non-owner who has been shared an asset is not able to
        remove permissions from the owner of that asset
        """
        self.client.login(
            username=self.someuser.username,
            password=self.someuser_password,
        )
        new_asset = self.create_asset(
            name='a new asset',
            owner=self.someuser,
        )
        # Getting existing permission for the owner of the asset
        perm = ObjectPermission.objects.filter(asset=new_asset).get(
            user=self.someuser, permission__codename=PERM_VIEW_ASSET
        )
        new_asset.assign_perm(self.anotheruser, PERM_VIEW_ASSET)
        kwargs = {
            'parent_lookup_asset': new_asset.uid,
            'uid': perm.uid,
        }
        url = reverse(
            'api_v2:asset-permission-assignment-detail', kwargs=kwargs
        )
        self.client.logout()
        self.client.login(
            username=self.anotheruser.username,
            password=self.anotheruser_password,
        )
        assert self.someuser.has_perm(PERM_VIEW_ASSET, new_asset)

        # `anotheruser` attempting to remove `someuser` from the asset
        res = self.client.delete(url)
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert self.someuser.has_perm(PERM_VIEW_ASSET, new_asset)

    def test_shared_asset_non_owner_remove_another_non_owners_permissions_not_allowed(self):
        """
        Ensuring that a non-owner who has an asset shared with them cannot
        remove permissions from another non-owner with that same asset shared
        with them.
        """
        yetanotheruser = User.objects.create(
            username='yetanotheruser',
        )
        self.client.login(
            username=self.someuser.username,
            password=self.someuser_password,
        )
        new_asset = self.create_asset(
            name='a new asset',
            owner=self.someuser,
            owner_password=self.someuser_password,
        )
        new_asset.assign_perm(self.anotheruser, PERM_VIEW_ASSET)
        perm = new_asset.assign_perm(yetanotheruser, PERM_VIEW_ASSET)
        kwargs = {
            'parent_lookup_asset': new_asset.uid,
            'uid': perm.uid,
        }
        url = reverse(
            'api_v2:asset-permission-assignment-detail', kwargs=kwargs
        )
        self.client.logout()
        self.client.login(
            username=self.anotheruser.username,
            password=self.anotheruser_password,
        )
        assert yetanotheruser.has_perm(PERM_VIEW_ASSET, new_asset)

        # `anotheruser` attempting to remove `yetanotheruser` from the asset
        res = self.client.delete(url)
        assert res.status_code == status.HTTP_404_NOT_FOUND
        assert yetanotheruser.has_perm(PERM_VIEW_ASSET, new_asset)

    def test_shared_asset_manage_asset_remove_another_non_owners_permissions_allowed(self):
        """
        Ensure that a non-owner who has an asset shared with them and has
        `manage_asset` permissions is able to remove permissions from another
        non-owner with that same asset shared with them.
        """
        yetanotheruser = User.objects.create(
            username='yetanotheruser',
        )
        self.client.login(
            username=self.someuser.username,
            password=self.someuser_password,
        )
        new_asset = self.create_asset(
            name='a new asset',
            owner=self.someuser,
            owner_password=self.someuser_password,
        )
        new_asset.assign_perm(self.anotheruser, PERM_MANAGE_ASSET)
        perm = new_asset.assign_perm(yetanotheruser, PERM_VIEW_ASSET)
        kwargs = {
            'parent_lookup_asset': new_asset.uid,
            'uid': perm.uid,
        }
        url = reverse(
            'api_v2:asset-permission-assignment-detail', kwargs=kwargs
        )
        self.client.logout()
        self.client.login(
            username=self.anotheruser.username,
            password=self.anotheruser_password,
        )
        assert yetanotheruser.has_perm(PERM_VIEW_ASSET, new_asset)

        # `anotheruser` attempting to remove `yetanotheruser` from the asset
        res = self.client.delete(url)
        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert not yetanotheruser.has_perm(PERM_VIEW_ASSET, new_asset)

    def test_copy_permissions_between_assets(self):
        # Give "someuser" edit permissions on an asset owned by "admin"
        self.add_perm(self.admin_asset, self.someuser, 'change_')
        # Confirm that "someuser" has received the implied permissions
        expected_perms = [PERM_CHANGE_ASSET, PERM_VIEW_ASSET]
        self.assertListEqual(
            sorted(self.admin_asset.get_perms(self.someuser)),
            expected_perms
        )
        # Create another asset to receive the copied permissions
        new_asset = self.create_asset(
            name='destination asset', owner=self.admin,
            owner_password=self.admin_password
        )
        # Add some extraneous permissions to the destination asset; these
        # should be removed by the copy operation
        self.add_perm(new_asset, self.anotheruser, 'view_')
        self.assertTrue(self.anotheruser.has_perm(PERM_VIEW_ASSET, new_asset))
        # Perform the permissions copy via the API endpoint
        self.client.login(
            username=self.admin.username, password=self.admin_password
        )
        if self.URL_NAMESPACE is None:
            dest_asset_perm_url = reverse(
                'asset-permissions', kwargs={'uid': new_asset.uid}
            )
        else:
            dest_asset_perm_url = reverse(
                'api_v2:asset-permission-assignment-clone',
                kwargs={'parent_lookup_asset': new_asset.uid}
            )
        # TODO: check that `clone_from` can also be a URL.
        # You know, Roy Fielding and all that.
        self.client.patch(
            dest_asset_perm_url, data={'clone_from': self.admin_asset.uid}
        )
        # Check the result; since the source and destination have the same
        # owner, the permissions should be identical
        self.assertDictEqual(
            self.admin_asset.get_users_with_perms(attach_perms=True),
            new_asset.get_users_with_perms(attach_perms=True)
        )

    def test_cannot_copy_permissions_between_non_owned_assets(self):
        # Give "someuser" view permissions on an asset owned by "admin"
        self.add_perm(self.admin_asset, self.someuser, 'view_')
        self.assertTrue(self.someuser.has_perm(PERM_VIEW_ASSET, self.admin_asset))
        # Create another asset to receive the copied permissions
        new_asset = self.create_asset(
            name='destination asset', owner=self.admin,
            owner_password=self.admin_password
        )
        # Give "someuser" edit permissions on the new asset owned by "admin"
        self.add_perm(new_asset, self.someuser, 'change_')
        self.assertTrue(self.someuser.has_perm(PERM_CHANGE_ASSET, new_asset))
        new_asset_perms_before_copy_attempt = new_asset.get_users_with_perms(
            attach_perms=True
        )
        # Perform the permissions copy via the API endpoint
        self.client.login(
            username=self.someuser.username, password=self.someuser_password
        )
        if self.URL_NAMESPACE is None:
            dest_asset_perm_url = reverse(
                'asset-permissions', kwargs={'uid': new_asset.uid}
            )
        else:
            dest_asset_perm_url = reverse(
                'api_v2:asset-permission-assignment-clone',
                kwargs={'parent_lookup_asset': new_asset.uid}
            )
        response = self.client.patch(
            dest_asset_perm_url, data={'clone_from': self.admin_asset.uid}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        # Check the result; nothing should have changed
        self.assertDictEqual(
            new_asset_perms_before_copy_attempt,
            new_asset.get_users_with_perms(attach_perms=True)
        )

    def test_user_cannot_copy_permissions_from_non_viewable_asset(self):
        # Make sure "someuser" cannot view the asset owned by "admin"
        self.assertFalse(
            self.someuser.has_perm(PERM_VIEW_ASSET, self.admin_asset)
        )
        # Create another asset to receive the copied permissions
        new_asset = self.create_asset(
            name='destination asset', owner=self.admin,
            owner_password=self.admin_password
        )
        # Take note of the destination asset's permissions to make sure they
        # are *not* changed later
        dest_asset_original_perms = new_asset.get_users_with_perms(
            attach_perms=True
        )
        # Perform the permissions copy via the API endpoint
        self.client.login(
            username=self.someuser.username, password=self.someuser_password
        )
        if self.URL_NAMESPACE is None:
            dest_asset_perm_url = reverse(
                'asset-permissions', kwargs={'uid': new_asset.uid}
            )
        else:
            dest_asset_perm_url = reverse(
                'api_v2:asset-permission-assignment-clone',
                kwargs={'parent_lookup_asset': new_asset.uid}
            )
        response = self.client.patch(
            dest_asset_perm_url, data={'clone_from': self.admin_asset.uid}
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        # Make sure no permissions were changed on the destination asset
        self.assertDictEqual(
            dest_asset_original_perms,
            new_asset.get_users_with_perms(attach_perms=True)
        )

    def test_user_cannot_copy_permissions_to_non_editable_asset(self):
        # Give "someuser" view permissions on an asset owned by "admin"
        self.add_perm(self.admin_asset, self.someuser, 'view_')
        self.assertTrue(self.someuser.has_perm(PERM_VIEW_ASSET, self.admin_asset))
        # Create another asset to receive the copied permissions
        new_asset = self.create_asset(
            name='destination asset', owner=self.admin,
            owner_password=self.admin_password
        )
        # Give "someuser" view permissions on the new asset owned by "admin"
        self.add_perm(new_asset, self.someuser, 'view_')
        self.assertTrue(self.someuser.has_perm(PERM_VIEW_ASSET, new_asset))
        # Take note of the destination asset's permissions to make sure they
        # are *not* changed later
        dest_asset_original_perms = new_asset.get_users_with_perms(
            attach_perms=True
        )
        # Perform the permissions copy via the API endpoint
        self.client.login(
            username=self.someuser.username, password=self.someuser_password
        )
        if self.URL_NAMESPACE is None:
            dest_asset_perm_url = reverse(
                'asset-permissions', kwargs={'uid': new_asset.uid}
            )
        else:
            dest_asset_perm_url = reverse(
                'api_v2:asset-permission-assignment-clone',
                kwargs={'parent_lookup_asset': new_asset.uid}
            )
        response = self.client.patch(
            dest_asset_perm_url, data={'clone_from': self.admin_asset.uid}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        # Make sure no permissions were changed on the destination asset
        self.assertDictEqual(
            dest_asset_original_perms,
            new_asset.get_users_with_perms(attach_perms=True)
        )

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
        perm_name = self._get_perm_name('view_', self.admin_collection)
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
        grandchild_collection = self.create_collection('grandchild_collection',
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
        grandchild_collection = self.create_collection('grandchild_collection',
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
        delete_perm = self._get_perm_name('delete_', self.admin_collection)
        self.assertFalse(self.someuser.has_perm(delete_perm,
                                                self.admin_collection))

        # Test that "someuser" can't delete the collection.
        self.client.login(username=self.someuser.username,
                          password=self.someuser_password)
        url = reverse(self._get_endpoint('asset-detail'),
                      kwargs={'uid': self.admin_collection.uid})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inherited_viewable_collection_not_deletable(self):
        # Give "someuser" view permissions on a collection owned by "admin".
        self.add_perm(self.admin_collection, self.someuser, 'view_')

        # Confirm that "someuser" is not allowed to delete the child collection.
        delete_perm = self._get_perm_name('delete_', self.child_collection)
        self.assertFalse(self.someuser.has_perm(delete_perm, self.child_collection))

        # Test that "someuser" can't delete the child collection.
        self.client.login(username=self.someuser.username,
                          password=self.someuser_password)
        url = reverse(self._get_endpoint('asset-detail'), kwargs={'uid':
                                                       self.child_collection.uid})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ApiAssignedPermissionsTestCase(KpiTestCase):
    """
    An obnoxiously large amount of code to test that the endpoint for listing
    assigned permissions complies with the following rules:

        * Superusers see it all (and there is *no* pagination)
        * Anonymous users see nothing
        * Regular users see everything that concerns them, namely all
          their own permissions and all the owners' permissions for all objects
          to which they have been assigned any permission

    See also
        kpi.utils.object_permission_helper.ObjectPermissionHelper.get_user_permission_assignments_queryset
    """

    # TODO: does this duplicate stuff in
    # test_api_asset_permission_assignment.py / should it be moved there?

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        super().setUp()
        self.anon = get_anonymous_user()
        self.super = User.objects.get(username='admin')
        self.super_password = 'pass'
        self.someuser = User.objects.get(username='someuser')
        self.someuser_password = 'someuser'
        self.anotheruser = User.objects.get(username='anotheruser')
        self.anotheruser_password = 'anotheruser'

        self.collection = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, owner=self.someuser
        )
        self.asset = Asset.objects.create(owner=self.someuser)

    def test_anon_only_sees_owner_permissions(self):
        self.asset.assign_perm(self.anon, PERM_VIEW_ASSET)
        self.assertTrue(self.anon.has_perm(PERM_VIEW_ASSET, self.asset))

        url = self.get_asset_perm_assignment_list_url(self.asset)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        owner_url = self.absolute_reverse(
            self._get_endpoint('user-detail'),
            kwargs={'username': self.asset.owner.username},
        )
        self.assertSetEqual(
            set((a['user'] for a in response.data)), set((owner_url,))
        )

    def test_user_sees_relevant_permissions_on_assigned_objects(self):
        # A user with explicitly-assigned permissions should see their
        # own permissions and the owner's permissions, but not permissions
        # assigned to other users
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_ASSET)
        self.assertTrue(self.anotheruser.has_perm(PERM_VIEW_ASSET, self.asset))

        irrelevant_user = User.objects.create(username='mindyourown')
        self.asset.assign_perm(irrelevant_user, PERM_VIEW_ASSET)

        self.client.login(username=self.anotheruser.username,
                          password=self.anotheruser_password)

        url = self.get_asset_perm_assignment_list_url(self.asset)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returned_urls = [r['url'] for r in response.data]
        all_obj_perms = self.asset.permissions.all()
        relevant_obj_perms = all_obj_perms.filter(
            user__in=(self.asset.owner, self.anotheruser),
            permission__codename__in=self.asset.get_assignable_permissions(
                with_partial=False
            ),
        )

        self.assertListEqual(
            sorted(returned_urls),
            sorted(
                self.get_urls_for_asset_perm_assignment_objs(
                    relevant_obj_perms, asset=self.asset
                )
            ),
        )

    def test_user_cannot_see_permissions_on_unassigned_objects(self):
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_ASSET)
        self.assertTrue(self.anotheruser.has_perm(PERM_VIEW_ASSET, self.asset))

        self.client.login(username=self.anotheruser.username,
                          password=self.anotheruser_password)

        url = self.get_asset_perm_assignment_list_url(self.collection)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_superuser_sees_all_permissions(self):
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_ASSET)
        self.assertTrue(self.anotheruser.has_perm(PERM_VIEW_ASSET, self.asset))

        self.client.login(username=self.super.username,
                          password=self.super_password)

        url = self.get_asset_perm_assignment_list_url(self.asset)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returned_urls = [r['url'] for r in response.data]
        all_obj_perms = self.asset.permissions.all()

        self.assertListEqual(
            sorted(returned_urls),
            sorted(
                self.get_urls_for_asset_perm_assignment_objs(
                    all_obj_perms, asset=self.asset
                )
            ),
        )
