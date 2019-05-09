from rest_framework import status
from django.utils import timezone
from django.core.urlresolvers import reverse
from django.contrib.auth.models import User, Permission

from ..models import Asset, Collection, ObjectPermission
from .kpi_test_case import KpiTestCase
from ..models.object_permission import get_anonymous_user


class ApiAnonymousPermissionsTestCase(KpiTestCase):

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
        self.anotheruser = User.objects.get(username='anotheruser')
        self.anotheruser_password = 'anotheruser'

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

    def test_copy_permissions_between_assets(self):
        # Give "someuser" edit permissions on an asset owned by "admin"
        self.add_perm(self.admin_asset, self.someuser, 'change_')
        # Confirm that "someuser" has received the implied permissions
        expected_perms = ['change_asset', 'share_asset', 'view_asset']
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
        self.assertTrue(self.anotheruser.has_perm('view_asset', new_asset))
        # Perform the permissions copy via the API endpoint
        self.client.login(
            username=self.admin.username, password=self.admin_password
        )
        dest_asset_perm_url = reverse(
            'asset-permissions', kwargs={'uid': new_asset.uid}
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

    def test_copy_permissions_between_non_owned_assets(self):
        # Give "someuser" view permissions on an asset owned by "admin"
        self.add_perm(self.admin_asset, self.someuser, 'view_')
        self.assertTrue(self.someuser.has_perm('view_asset', self.admin_asset))
        # Create another asset to receive the copied permissions
        new_asset = self.create_asset(
            name='destination asset', owner=self.admin,
            owner_password=self.admin_password
        )
        # Give "someuser" edit permissions on the new asset owned by "admin"
        self.add_perm(new_asset, self.someuser, 'change_')
        self.assertTrue(self.someuser.has_perm('change_asset', new_asset))
        # Perform the permissions copy via the API endpoint
        self.client.login(
            username=self.someuser.username, password=self.someuser_password
        )
        dest_asset_perm_url = reverse(
            'asset-permissions', kwargs={'uid': new_asset.uid}
        )
        self.client.patch(
            dest_asset_perm_url, data={'clone_from': self.admin_asset.uid}
        )
        # Check the result; since the source and destination have the same
        # owner, the permissions should be identical
        self.assertDictEqual(
            self.admin_asset.get_users_with_perms(attach_perms=True),
            new_asset.get_users_with_perms(attach_perms=True)
        )
        # Fun fact: the copying user has obliterated their own privileges
        self.assertFalse(self.someuser.has_perm('change_asset', new_asset))

    def test_user_cannot_copy_permissions_from_non_viewable_asset(self):
        # Make sure "someuser" cannot view the asset owned by "admin"
        self.assertFalse(
            self.someuser.has_perm('view_asset', self.admin_asset)
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
        dest_asset_perm_url = reverse(
            'asset-permissions', kwargs={'uid': new_asset.uid}
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
        self.assertTrue(self.someuser.has_perm('view_asset', self.admin_asset))
        # Create another asset to receive the copied permissions
        new_asset = self.create_asset(
            name='destination asset', owner=self.admin,
            owner_password=self.admin_password
        )
        # Give "someuser" view permissions on the new asset owned by "admin"
        self.add_perm(new_asset, self.someuser, 'view_')
        self.assertTrue(self.someuser.has_perm('view_asset', new_asset))
        # Take note of the destination asset's permissions to make sure they
        # are *not* changed later
        dest_asset_original_perms = new_asset.get_users_with_perms(
            attach_perms=True
        )
        # Perform the permissions copy via the API endpoint
        self.client.login(
            username=self.someuser.username, password=self.someuser_password
        )
        dest_asset_perm_url = reverse(
            'asset-permissions', kwargs={'uid': new_asset.uid}
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


class ApiAssignedPermissionsTestCase(KpiTestCase):
    """
    An obnoxiously large amount of code to test that the endpoint for listing
    assigned permissions complies with the following rules:

        * Superusers see it all (thank goodness for pagination)
        * Anonymous users see nothing
        * Regular users see everything that concerns them, namely all
          permissions for all objects to which they have been assigned any
          permission

    See also `kpi.filters.KpiAssignedObjectPermissionsFilter`
    """

    def setUp(self):
        super(ApiAssignedPermissionsTestCase, self).setUp()
        self.anon = get_anonymous_user()
        self.super = User.objects.get(username='admin')
        self.super_password = 'pass'
        self.someuser = User.objects.get(username='someuser')
        self.someuser_password = 'someuser'
        self.anotheruser = User.objects.get(username='anotheruser')
        self.anotheruser_password = 'anotheruser'

        # Find an unused, common PK for both Asset and Collection--useful for
        # catching bugs related to content types like
        # https://github.com/kobotoolbox/kpi/issues/2270
        last_asset = Asset.objects.order_by('pk').last()
        last_collection = Collection.objects.order_by('pk').last()
        available_pk = 1 + max(last_asset.pk if last_asset else 1,
                               last_collection.pk if last_collection else 1)

        def create_object_with_specific_pk(model, pk, **kwargs):
            obj = model()
            obj.pk = pk
            for k, v in kwargs.items():
                setattr(obj, k, v)
            obj.save()
            return obj

        self.collection = create_object_with_specific_pk(
            Collection,
            available_pk,
            owner=self.someuser,
        )
        self.asset = create_object_with_specific_pk(
            Asset, available_pk, owner=self.someuser,
            # perenially evil `auto_now_add` leaves the field NULL if a pk is
            # specified, leading to `IntegrityError` unless we set it manually
            date_created=timezone.now(),
        )

    def test_anon_cannot_list_permissions(self):
        self.asset.assign_perm(self.anon, 'view_asset')
        self.assertTrue(self.anon.has_perm('view_asset', self.asset))

        url = reverse('objectpermission-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertListEqual(response.data['results'], [])

        self.asset.remove_perm(self.anon, 'view_asset')
        self.assertFalse(self.anon.has_perm('view_asset', self.asset))

    def test_user_sees_all_permissions_on_assigned_objects(self):
        self.asset.assign_perm(self.anotheruser, 'view_asset')
        self.assertTrue(self.anotheruser.has_perm('view_asset', self.asset))

        self.client.login(username=self.anotheruser.username,
                          password=self.anotheruser_password)

        url = reverse('objectpermission-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returned_uids = [r['uid'] for r in response.data['results']]
        all_obj_perms = ObjectPermission.objects.filter_for_object(self.asset)

        self.assertTrue(
            set(returned_uids).issuperset(
                all_obj_perms.values_list('uid', flat=True)
            )
        )

        self.asset.remove_perm(self.anotheruser, 'view_asset')
        self.assertFalse(self.anotheruser.has_perm('view_asset', self.asset))

    def test_user_cannot_see_permissions_on_unassigned_objects(self):
        self.asset.assign_perm(self.anotheruser, 'view_asset')
        self.assertTrue(self.anotheruser.has_perm('view_asset', self.asset))

        self.client.login(username=self.anotheruser.username,
                          password=self.anotheruser_password)

        url = reverse('objectpermission-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returned_uids = [r['uid'] for r in response.data['results']]
        other_obj_perms = ObjectPermission.objects.filter_for_object(
            self.collection)

        self.assertFalse(
            set(returned_uids).intersection(
                other_obj_perms.values_list('uid', flat=True)
            )
        )

        self.asset.remove_perm(self.anotheruser, 'view_asset')
        self.assertFalse(self.anotheruser.has_perm('view_asset', self.asset))

    def test_superuser_sees_all_permissions(self):
        self.asset.assign_perm(self.anotheruser, 'view_asset')
        self.assertTrue(self.anotheruser.has_perm('view_asset', self.asset))

        self.client.login(username=self.super.username,
                          password=self.super_password)

        url = reverse('objectpermission-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returned_uids = [r['uid'] for r in response.data['results']]
        self.assertListEqual(
            sorted(returned_uids),
            sorted(ObjectPermission.objects.values_list('uid', flat=True))
        )

        self.asset.remove_perm(self.anotheruser, 'view_asset')
        self.assertFalse(self.anotheruser.has_perm('view_asset', self.asset))
