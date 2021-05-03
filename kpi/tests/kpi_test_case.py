# coding: utf-8
"""
Created on Apr 6, 2015

@author: esmail
"""
import re

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.urls import reverse
from rest_framework import status

from kpi.constants import ASSET_TYPE_COLLECTION

# FIXME: Remove the following line when the permissions API is in place.
from .base_test_case import BaseTestCase
from .test_permissions import BasePermissionsTestCase
from ..models.asset import Asset
from ..models.object_permission import ObjectPermission


class KpiTestCase(BaseTestCase, BasePermissionsTestCase):
    """
    A base `APITestCase` with helper functions for KPI testing.
    """

    fixtures = ['test_data']

    def login(self, username=None, password=None, expect_success=True):
        '''
        Log in, asserting success. Uses `username` rather than `user`, preferring consistency with
        :py:class:`BasePermissionsTestCase` over the rest of the calls in this class.
        '''

        kwargs = dict()
        if username and password:
            kwargs = {'username': username, 'password': password}
        self.assertEqual(self.client.login(**kwargs), expect_success)

    def _url_to_uid(self, url):
        return re.match(r'.+/(.+)/.*$', url).groups()[0]

    def url_to_obj(self, url):
        uid = re.match(r'.+/(.+)/.*$', url).groups()[0]
        if uid.startswith('a'):
            klass = Asset
        elif uid.startswith('p'):
            klass = ObjectPermission
        else:
            raise NotImplementedError()
        obj = klass.objects.get(uid=uid)
        return obj

    def obj_to_url(self, obj):
        # Add more types as you need them
        if isinstance(obj, ObjectPermission):
            return reverse(
                self._get_endpoint('asset-permission-assignment-detail'),
                kwargs={'parent_lookup_asset': obj.asset.uid, 'uid': obj.uid},
            )
        if isinstance(obj, Permission):
            return reverse(
                self._get_endpoint('permission-detail'),
                kwargs={'codename': obj.codename},
            )
        elif isinstance(obj, get_user_model()):
            return reverse(
                self._get_endpoint('user-detail'),
                kwargs={'username': obj.username},
            )
        raise NotImplementedError

    def get_asset_perm_assignment_list_url(self, asset):
        return reverse(
            self._get_endpoint('asset-permission-assignment-list'),
            kwargs={'parent_lookup_asset': asset.uid}
        )

    def get_urls_for_asset_perm_assignment_objs(self, perm_assignments, asset):
        return [
            self.absolute_reverse(
                self._get_endpoint('asset-permission-assignment-detail'),
                kwargs={'uid': uid, 'parent_lookup_asset': asset.uid},
            )
            for uid in perm_assignments.values_list('uid', flat=True)
        ]

    def create_collection(self, name, owner=None, owner_password=None,
                          **kwargs):
        if owner and owner_password:
            self.login(owner.username, owner_password)

        kwargs.update({'name': name, 'asset_type': ASSET_TYPE_COLLECTION})
        response = self.client.post(
            reverse(self._get_endpoint("asset-list")), kwargs
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        if owner and owner_password:
            self.client.logout()

        collection = self.url_to_obj(response.data['url'])
        return collection

    def create_asset(self, name, content=None, owner=None,
                     owner_password=None, **kwargs):
        if owner and owner_password:
            if isinstance(owner, str):
                self.login(owner, owner_password)
            self.login(owner.username, owner_password)

        if content is None:
            content = ''

        kwargs.update({
            'name': name,
            'content': content,
            'asset_type': kwargs.get('asset_type', 'survey')
        })

        response = self.client.post(reverse(self._get_endpoint('asset-list')), kwargs)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        if owner and owner_password:
            self.client.logout()

        asset = self.url_to_obj(response.data['url'])
        return asset

    def assert_child_of(self, child, parent_collection, owner=None,
                        owner_password=None):
        if owner and owner_password:
            self.login(owner.username, owner_password)

        parent_url = reverse(self._get_endpoint('asset-detail'),
                             kwargs={'uid': parent_collection.uid})
        parent_detail_response = self.client.get(parent_url)
        self.assertEqual(
            parent_detail_response.status_code, status.HTTP_200_OK)

        child_view_name = child._meta.model_name + '-detail'
        child_url = reverse(self._get_endpoint(child_view_name),
                            kwargs={'uid': child.uid})
        child_detail_response = self.client.get(child_url)
        self.assertEqual(child_detail_response.status_code, status.HTTP_200_OK)

        if owner and owner_password:
            self.client.logout()

        parent_data = parent_detail_response.data
        child_data = child_detail_response.data
        self.assertIn(parent_url, child_data['parent'])

        assert parent_collection.children.count() ==\
            parent_data['children']['count']

    def add_to_collection(self, child, parent_collection,
                          owner=None, owner_password=None):
        if owner and owner_password:
            self.login(owner.username, owner_password)

        parent_url = reverse(self._get_endpoint('asset-detail'),
                             kwargs={'uid': parent_collection.uid})

        child_view_name = child._meta.model_name + '-detail'
        child_url = reverse(self._get_endpoint(child_view_name),
                            kwargs={'uid': child.uid})
        response = self.client.patch(child_url, {'parent': parent_url})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assert_child_of(child, parent_collection, owner, owner_password)

        if owner and owner_password:
            self.client.logout()

    def add_perm(self, obj, other_user, perm_name_prefix):
        '''
        Add a permission.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Asset`
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
    #         perm_url= reverse('asset-permission',
    #                           kwargs={'uid': self.admin_asset.uid})
    #         response= self.client.get(perm_url)
    #         self.assertEqual(response.status_code, status.HTTP_200_OK)
    #         permissions= response.data['results']
    #         self.assertNotIn(PERM_VIEW_ASSET, permissions[self.someuser['username']])
    #         permissions[self.someuser['username']].append(PERM_VIEW_ASSET)
    #         response= self.client.patch(data=permissions)
    #         self.assertEqual(response.status_code, status.HTTP_200_OK)
    #         self.client.logout()

    def remove_perm(self, obj, owner, owner_password, other_user,
                    other_user_password, perm_name_prefix):
        """
        Remove a permission.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Asset`
        :param owner: The owner of `obj`.
        :type owner: :py:class:`User`
        :param owner_password: The password for user 'owner'.
        :type owner_password: str
        :param other_user: The user for whom permissions on `obj` will be
            manipulated.
        :type other_user: :py:class:`User`
        :param other_user_password: The password for user `other_user`
        :type other_user_password: str
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        """
        # FIXME: Do this through the API once the interface has stabilized.
        # self._test_add_and_remove_perm(obj, perm_name_prefix, other_user)
        # jnm: _test_add_and_remove expects the permission to not have been
        # assigned yet and fails when it has.
        self._test_remove_perm(obj, perm_name_prefix, other_user)

    def remove_perm_v2_api(self, asset, user, perm_codename):
        # TODO: replace `remove_perm()` with this method

        if not isinstance(asset, Asset):
            raise NotImplementedError

        list_url = reverse(
            'api_v2:asset-permission-assignment-list', args=[asset.uid]
        )
        perm_list = self.client.get(list_url).data
        for perm in perm_list:
            # Is there there no simple way to resolve a URL to an object?
            user_detail = self.client.get(perm['user']).data
            if user_detail['username'] == user.username:
                perm_detail = self.client.get(perm['permission']).data
                if perm_detail['codename'] == perm_codename:
                    break
        response = self.client.delete(perm['url'])
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def assert_object_in_object_list(self, obj, user=None, password=None,
                                     in_list=True, msg=None):
        view_name = obj._meta.model_name + '-list'
        url = reverse(self._get_endpoint(view_name))

        if user and password:
            self.login(user.username, password)
        response = self.client.get(url)
        if user and password:
            self.client.logout()

        if response.status_code == status.HTTP_403_FORBIDDEN:
            uid_found = False
        else:
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            uid_found = False
            for rslt in response.data['results']:
                uid = self._url_to_uid(rslt['url'])
                if uid == obj.uid:
                    uid_found = True
                    break

        if msg is None:
            in_list_string = in_list and 'not ' or ''
            msg = 'Object "{}" {}found in list.'.format(obj, in_list_string)
        self.assertEqual(uid_found, in_list, msg=msg)

    def assert_detail_viewable(self, obj, user=None, password=None,
                               viewable=True, msg=None):
        view_name = obj._meta.model_name + '-detail'
        url = reverse(self._get_endpoint(view_name), kwargs={'uid': obj.uid})

        if user and password:
            self.login(user.username, password)
        response = self.client.get(url)
        if user and password:
            self.client.logout()

        viewable_string = viewable and 'not ' or ''
        msg = msg or 'Object "{}" {}detail viewable.'.format(obj, viewable_string)
        if viewable:
            self.assertEqual(response.status_code, status.HTTP_200_OK, msg=msg)
        else:
            # 404 expected here; see
            # https://github.com/tomchristie/django-rest-framework/issues/1439
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND, viewable_string)

    def assert_viewable(self, obj, user=None, password=None, viewable=True):
        self.assert_object_in_object_list(
            obj, user, password, in_list=viewable)
        self.assert_detail_viewable(obj, user, password, viewable)
