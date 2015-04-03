import re

from django.core.urlresolvers import reverse
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status

from .test_permissions import BasePermissionsTestCase
from ..models.collection import Collection
from ..models.survey_asset import SurveyAsset

class ApiPermissionsTestCase(APITestCase,
                             BasePermissionsTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.admin= User.objects.get(username='admin')
        self.someuser= User.objects.get(username='someuser')
        self.someuser_password= 'someuser'
        self.admin_password= 'pass'

        self.assertTrue(self.client.login(username=self.admin.username,
                                          password=self.admin_password))
        self.admin_asset= self._create_asset('admin_asset', '[]')
        self.admin_collection= self._create_collection('admin_collection')
        self.child_collection= self._create_collection('child_collection')
        self._add_to_collection(self.child_collection, self.admin_collection)
        self.client.logout()

################### Helpers #######################

    def _url_to_uid(self, url):
        uid= re.match(r'.+/(.+)/.*$', url).groups()[0]
        return uid

    def _url_to_obj(self, url):
        uid= re.match(r'.+/(.+)/.*$', url).groups()[0]
        if uid.startswith('c'):
            klass= Collection
        elif uid.startswith('a'):
            klass= SurveyAsset
        else:
            raise NotImplementedError()
        obj= klass.objects.get(uid=uid)
        return obj

    def _create_collection(self, name, owner=None, owner_password=None):
        if owner and owner_password:
            self.assertTrue(self.client.login(username=owner.username,
                                              password=owner_password))

        response= self.client.post(reverse('collection-list'),
                                   {'name': name})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        if owner and owner_password:
            self.client.logout()

        collection= self._url_to_obj(response.data['url'])
        return collection

    def _create_asset(self, name, content=None, owner=None,
                      owner_password=None):
        if owner and owner_password:
            self.assertTrue(self.client.login(username=owner.username,
                                              password=owner_password))

        if content == None:
            content= '[]'

        response= self.client.post(reverse('surveyasset-list'),
                                   {'name': name, 'content': content})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        if owner and owner_password:
            self.client.logout()

        asset= self._url_to_obj(response.data['url'])
        return asset

    def _assert_child_of(self, child, parent_collection, owner=None,
                         owner_password=None):
        if owner and owner_password:
            self.assertTrue(self.client.login(username=owner.username,
                                              password=owner_password))

        parent_url= reverse('collection-detail',
                            kwargs={'uid': parent_collection.uid})
        parent_detail_response= self.client.get(parent_url)
        self.assertEqual(parent_detail_response.status_code, status.HTTP_200_OK)

        child_view_name= child._meta.model_name + '-detail'
        child_url= reverse(child_view_name,
                            kwargs={'uid': child.uid})
        child_detail_response= self.client.get(child_url)
        self.assertEqual(child_detail_response.status_code, status.HTTP_200_OK)

        if owner and owner_password:
            self.client.logout()

        parent_data= parent_detail_response.data
        child_data= child_detail_response.data
        self.assertIn(parent_url, child_data['parent'])

        if type(child) == Collection:
            child_field= 'children'
        elif type(child) == SurveyAsset:
            child_field= 'survey_assets'
        child_found= False
        for c_url in parent_data[child_field]:
            if child_url in c_url:
                child_found= True
                break
        self.assertTrue(child_found)

    def _add_to_collection(self, child, parent_collection,
                                 owner=None, owner_password=None):
        if owner and owner_password:
            self.assertTrue(self.client.login(username=owner.username,
                                              password=owner_password))

        parent_url= reverse('collection-detail',
                            kwargs={'uid': parent_collection.uid})

        child_view_name= child._meta.model_name + '-detail'
        child_url= reverse(child_view_name,
                            kwargs={'uid': child.uid})
        response= self.client.patch(child_url, {'parent': parent_url})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self._assert_child_of(child, parent_collection, owner, owner_password)

        if owner and owner_password:
            self.client.logout()

    def _add_perm(self, obj, owner, owner_password, other_user, perm_name_prefix):
        '''
        Add a permission.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Collection` or :py:class:`SurveyAsset`
        :param owner: The owner of `obj`.
        :type owner: :py:class:`User`
        :param owner_password: The password for user 'owner'.
        :type owner_password: str
        :param other_user: The user for whom permissions on `obj` will be
            manipulated.
        :type other_user: :py:class:`User`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        '''
        # FIXME: Do this through the API once the interface has stabilized.
        self._test_add_perm(obj, perm_name_prefix, other_user)
#         self.client.login(username=owner.username, owner_password='pass')
#         perm_url= reverse('surveyasset-permission',
#                           kwargs={'uid': self.admin_asset.uid})
#         response= self.client.get(perm_url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         permissions= response.data['results']
#         self.assertNotIn('view_surveyasset', permissions[self.someuser['username']])
#         permissions[self.someuser['username']].append('view_surveyasset')
#         response= self.client.patch(data=permissions)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.client.logout()

    def _remove_perm(self, obj, owner, owner_password, other_user, perm_name_prefix):
        '''
        Add a permission.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Collection` or :py:class:`SurveyAsset`
        :param owner: The owner of `obj`.
        :type owner: :py:class:`User`
        :param owner_password: The password for user 'owner'.
        :type owner_password: str
        :param other_user: The user for whom permissions on `obj` will be
            manipulated.
        :type other_user: :py:class:`User`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        '''
        # FIXME: Do this through the API once the interface has stabilized.
        self._test_add_and_remove_perm(obj, perm_name_prefix, other_user)

    def _object_in_object_list(self, obj):
        view_name= obj._meta.model_name + '-list'
        url= reverse(view_name)
        response= self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        uid_found= False
        for rslt in response.data['results']:
            uid= self._url_to_uid(rslt['url'])
            if uid == obj.uid:
                uid_found= True
                break
        return uid_found

    def _assert_viewability(self, obj, user, password, viewable=True):
        # Log in as the user and check their ability to view the object.
        self.assertTrue(self.client.login(username=user.username,
                                          password=password))

        view_name= obj._meta.model_name + '-list'
        url= reverse(view_name)
        response= self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        uid_found= False
        for rslt in response.data['results']:
            uid= self._url_to_uid(rslt['url'])
            if uid == obj.uid:
                uid_found= True
                break

        self.assertEqual(uid_found, viewable)
        self.client.logout()

################# Asset tests #####################

    def test_own_asset_in_asset_list(self):
        self._assert_viewability(self.admin_asset, self.admin,
                               self.admin_password)

    def test_viewable_asset_in_asset_list(self):
        # Give "someuser" view permissions on an asset owned by "admin".
        self._add_perm(self.admin_asset, self.admin, self.admin_password,
                       self.someuser, 'view_')

        # Test that "someuser" can now view the asset.
        self._assert_viewability(self.admin_asset, self.someuser,
                               self.someuser_password)

    def test_non_viewable_asset_not_in_asset_list(self):
        # Wow, that's quite a function name...
        # Ensure that "someuser" doesn't have permission to view the survey
        #   asset owned by "admin".
        perm_name= self._get_perm_name('view_', self.admin_asset)
        self.assertFalse(self.someuser.has_perm(perm_name, self.admin_asset))

        # Verify they can't view the asset through the API.
        self._assert_viewability(self.admin_asset, self.someuser,
                               self.someuser_password, viewable=False)

    def test_inherited_viewable_assets_in_asset_list(self):
        # Give "someuser" view permissions on a collection owned by "admin" and
        #   add an asset also owned by "admin" to that collection.
        self._add_perm(self.admin_asset, self.admin, self.admin_password,
                       self.someuser, 'view_')

        self._add_to_collection(self.admin_asset, self.admin_collection,
                                self.admin, self.admin_password)

        # Test that "someuser" can now view the asset.
        self._assert_viewability(self.admin_asset, self.someuser,
                               self.someuser_password)

    def test_viewable_asset_inheritance_conflict(self):
        # Log in as "admin", create a new child collection, and add an asset to
        #   that collection.
        self._add_to_collection(self.admin_asset, self.child_collection,
                                self.admin, self.admin_password)

        # Give "someuser" view permission on 'child_collection'.
        self._add_perm(self.child_collection, self.admin, self.admin_password,
                       self.someuser, 'view_')

        # Revoke the view permissions of "someuser" on the parent collection.
        self._remove_perm(self.admin_collection, self.admin,
                          self.admin_password, self.someuser, 'view_')

        # Confirm that "someuser" can view the contents of 'child_collection'.
        self._assert_viewability(self.admin_asset, self.someuser,
                               self.someuser_password)

    def test_non_viewable_asset_inheritance_conflict(self):
        # Log in as "admin", create a new child collection, and add an asset to
        #   that collection.
        self._add_to_collection(self.admin_asset, self.child_collection,
                                self.admin, self.admin_password)

        # Revoke the view permissions of "someuser" on the child collection.
        self._remove_perm(self.child_collection, self.admin, self.admin_password,
                          self.someuser, 'view_')

        # Give "someuser" view permission on the parent collection.
        self._add_perm(self.admin_collection, self.admin, self.admin_password,
                       self.someuser, 'view_')

        # Confirm that "someuser" can't view the contents of 'child_collection'.
        self._assert_viewability(self.admin_asset, self.someuser,
                               self.someuser_password, viewable=False)

    def test_viewable_asset_not_deletable(self):
        # Give "someuser" view permissions on an asset owned by "admin".
        self._add_perm(self.admin_asset, self.admin, self.admin_password,
                       self.someuser, 'view_')

        # Confirm that "someuser" is not allowed to delete the asset.
        delete_perm= self._get_perm_name('delete_', self.admin_asset)
        self.assertFalse(self.someuser.has_perm(delete_perm, self.admin_asset))

        # Test that "someuser" can't delete the asset.
        self.client.login(username=self.someuser.username,
                          password=self.someuser_password)
        url= reverse('surveyasset-detail', kwargs={'uid': self.admin_asset.uid})
        response= self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inherited_viewable_asset_not_deletable(self):
        # Give "someuser" view permissions on a collection owned by "admin" and
        #   add an asset also owned by "admin" to that collection.
        self._add_perm(self.admin_asset, self.admin, self.admin_password,
                       self.someuser, 'view_')
        self._add_to_collection(self.admin_asset, self.admin_collection,
                                self.admin, self.admin_password)

        # Confirm that "someuser" is not allowed to delete the asset.
        delete_perm= self._get_perm_name('delete_', self.admin_asset)
        self.assertFalse(self.someuser.has_perm(delete_perm, self.admin_asset))

        # Test that "someuser" can't delete the asset.
        self.client.login(username=self.someuser.username,
                          password=self.someuser_password)
        url= reverse('surveyasset-detail', kwargs={'uid': self.admin_asset.uid})
        response= self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

############# Collection tests ###############

    def test_own_collection_in_collection_list(self):
        self._assert_viewability(self.admin_collection, self.admin,
                               self.admin_password)

    def test_viewable_collection_in_collection_list(self):
        # Give "someuser" view permissions on a collection owned by "admin".
        self._add_perm(self.admin_collection, self.admin, self.admin_password,
                       self.someuser, 'view_')

        # Test that "someuser" can now view the collection.
        self._assert_viewability(self.admin_collection, self.someuser,
                               self.someuser_password)

    def test_non_viewable_collection_not_in_collection_list(self):
        # Wow, that's quite a function name...
        # Ensure that "someuser" doesn't have permission to view the survey
        #   collection owned by "admin".
        perm_name= self._get_perm_name('view_', self.admin_collection)
        self.assertFalse(self.someuser.has_perm(perm_name, self.admin_collection))

        # Verify they can't view the collection through the API.
        self._assert_viewability(self.admin_collection, self.someuser,
                               self.someuser_password, viewable=False)

    def test_inherited_viewable_collections_in_collection_list(self):
        # Give "someuser" view permissions on the parent collection.
        self._add_perm(self.admin_collection, self.admin, self.admin_password,
                       self.someuser, 'view_')
        # Test that "someuser" can now view the child collection.
        self._assert_viewability(self.child_collection, self.someuser,
                               self.someuser_password)

    def test_viewable_collection_inheritance_conflict(self):
        grandchild_collection= self._create_collection('grandchild_collection',
                                        self.admin, self.admin_password)
        self._add_to_collection(grandchild_collection, self.child_collection,
                                self.admin, self.admin_password)

        # Give "someuser" view permission on 'child_collection'.
        self._add_perm(self.child_collection, self.admin, self.admin_password,
                       self.someuser, 'view_')

        # Revoke the view permissions of "someuser" on 'parent_collection'.
        self._remove_perm(self.admin_collection, self.admin,
                          self.admin_password, self.someuser, 'view_')

        # Confirm that "someuser" can view 'grandchild_collection'.
        self._assert_viewability(grandchild_collection, self.someuser,
                               self.someuser_password)

    def test_non_viewable_collection_inheritance_conflict(self):
        grandchild_collection= self._create_collection('grandchild_collection',
                                        self.admin, self.admin_password)
        self._add_to_collection(grandchild_collection, self.child_collection,
                                self.admin, self.admin_password)

        # Revoke the view permissions of "someuser" on the child collection.
        self._remove_perm(self.child_collection, self.admin,
                          self.admin_password, self.someuser, 'view_')

        # Give "someuser" view permission on the parent collection.
        self._add_perm(self.admin_collection, self.admin, self.admin_password,
                       self.someuser, 'view_')

        # Confirm that "someuser" can't view 'grandchild_collection'.
        self._assert_viewability(grandchild_collection, self.someuser,
                               self.someuser_password, viewable=False)

    def test_viewable_collection_not_deletable(self):
        # Give "someuser" view permissions on a collection owned by "admin".
        self._add_perm(self.admin_collection, self.admin, self.admin_password,
                       self.someuser, 'view_')

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

