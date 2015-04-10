'''
Created on Apr 6, 2015

@author: esmail
'''

import re

from django.core.urlresolvers import reverse
from rest_framework.test import APITestCase
from rest_framework import status

# FIXME: Remove the following line when the permissions API is in place.
from .test_permissions import BasePermissionsTestCase
from ..models.collection import Collection
from ..models.survey_asset import SurveyAsset

class KpiTestCase(APITestCase, BasePermissionsTestCase):
    '''
    A base `APITestCase` with helper functions for KPI testing.
    '''

    fixtures = ['test_data']

    def _url_to_uid(self, url):
        return re.match(r'.+/(.+)/.*$', url).groups()[0]

    def url_to_obj(self, url):
        uid= re.match(r'.+/(.+)/.*$', url).groups()[0]
        if uid.startswith('c'):
            klass= Collection
        elif uid.startswith('a'):
            klass= SurveyAsset
        else:
            raise NotImplementedError()
        obj= klass.objects.get(uid=uid)
        return obj

    def create_collection(self, name, owner=None, owner_password=None):
        if owner and owner_password:
            self.assertTrue(self.client.login(username=owner.username,
                                              password=owner_password))

        response= self.client.post(reverse('collection-list'),
                                   {'name': name})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        if owner and owner_password:
            self.client.logout()

        collection= self.url_to_obj(response.data['url'])
        return collection

    def create_asset(self, name, content=None, owner=None,
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

        asset= self.url_to_obj(response.data['url'])
        return asset

    def assert_child_of(self, child, parent_collection, owner=None,
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

    def add_to_collection(self, child, parent_collection,
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
        self.assert_child_of(child, parent_collection, owner, owner_password)

        if owner and owner_password:
            self.client.logout()

    def add_perm(self, obj, owner, owner_password, other_user,
                  other_user_password, perm_name_prefix):
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
        :param other_user_password: The password for user `other_user`
        :type other_user_password: str
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

    def remove_perm(self, obj, owner, owner_password, other_user,
                     other_user_password, perm_name_prefix):
        '''
        Remove a permission.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Collection` or :py:class:`SurveyAsset`
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
        '''
        # FIXME: Do this through the API once the interface has stabilized.
        #self._test_add_and_remove_perm(obj, perm_name_prefix, other_user)
        # jnm: _test_add_and_remove expects the permission to not have been
        # assigned yet and fails when it has.
        self._test_remove_perm(obj, perm_name_prefix, other_user)

    def assert_object_in_object_list(self, obj, user=None, password=None,
                                     in_list=True):
        view_name= obj._meta.model_name + '-list'
        url= reverse(view_name)

        if user and password:
            self.assertTrue(self.client.login(username=user.username,
                                              password=password))
        response= self.client.get(url)
        if user and password:
            self.client.logout()

        if response.status_code == status.HTTP_403_FORBIDDEN:
            uid_found= False
        else:
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            uid_found= False
            for rslt in response.data['results']:
                uid= self._url_to_uid(rslt['url'])
                if uid == obj.uid:
                    uid_found= True
                    break

        self.assertEqual(uid_found, in_list)


    def assert_detail_viewable(self, obj, user=None, password=None, viewable=True):
        view_name= obj._meta.model_name + '-detail'
        url= reverse(view_name, kwargs={'uid': obj.uid})

        if user and password:
            self.assertTrue(self.client.login(username=user.username,
                                              password=password))
        response= self.client.get(url)
        if user and password:
            self.client.logout()

        if viewable:
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        else:
            # 404 expected here; see
            # https://github.com/tomchristie/django-rest-framework/issues/1439
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def assert_viewable(self, obj, user=None, password=None, viewable=True):
        self.assert_object_in_object_list(obj, user, password, in_list=viewable)
        self.assert_detail_viewable(obj, user, password, viewable)

