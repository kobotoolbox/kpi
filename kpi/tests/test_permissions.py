from django.contrib.auth.models import User
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase

from ..models.collection import Collection
from ..models.object_permission import get_all_objects_for_user
from ..models.asset import SurveyAsset

class BasePermissionsTestCase(TestCase):
    def _get_perm_name(self, perm_name_prefix, model_instance):
        '''
        Get the type-specific permission name for a model from a permission name
        prefix and a model instance.

        Example:
            >>>self._get_perm_name('view_', my_asset)
            'view_asset'

        :param perm_name_prefix: Prefix of the desired permission name (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param model_instance: An instance of the model for which the permission
            name is desired.
        :type model_instance: :py:class:`Collection` or :py:class:`SurveyAsset`
        :return: The computed permission name.
        :rtype: str
        '''
        perm_name= Permission.objects.get(
            content_type= ContentType.objects.get_for_model(model_instance),
            codename__startswith=perm_name_prefix
        ).natural_key()[0]
        return perm_name

    def _test_add_perm(self, obj, perm_name_prefix, user):
        '''
        Test that a permission can be added and that the permission successfully
        takes effect.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Collection` or :py:class:`SurveyAsset`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param user: The user for whom permissions on `obj` will be manipulated.
        :type user: :py:class:`User`
        '''
        perm_name= self._get_perm_name(perm_name_prefix, obj)
        self.assertFalse(user.has_perm(perm_name, obj))
        obj.assign_perm(user, perm_name)
        self.assertTrue(user.has_perm(perm_name, obj))

    def _test_remove_perm(self, obj, perm_name_prefix, user):
        '''
        Test that a permission can be removed and that the removal successfully
        takes effect.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Collection` or :py:class:`SurveyAsset`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param user: The user for whom permissions on `obj` will be manipulated.
        :type user: :py:class:`User`
        '''
        perm_name= self._get_perm_name(perm_name_prefix, obj)
        self.assertTrue(user.has_perm(perm_name, obj))
        obj.remove_perm(user, perm_name)
        self.assertFalse(user.has_perm(perm_name, obj))

    def _test_add_inherited_perm(self, ancestor_collection, perm_name_prefix,
                                 user, descendant_obj):
        '''
        Test that a permission can be added to a collection and that the
        permission successfully propagates to a descendant.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Collection` or :py:class:`SurveyAsset`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param user: The user for whom permissions on `obj` will be manipulated.
        :type user: :py:class:`User`
        :param descendant_obj: The descendant object to check for the
            changed permission (i.e. an asset/collection contained in
            `ancestor_collection`).
        :type descendant_obj: :py:class:`Collection` or :py:class:`SurveyAsset`
        '''
        descendant_perm_name= self._get_perm_name(perm_name_prefix, descendant_obj)
        self.assertFalse(user.has_perm(descendant_perm_name, descendant_obj))
        self._test_add_perm(ancestor_collection, perm_name_prefix, user)
        self.assertTrue(user.has_perm(descendant_perm_name, descendant_obj))

    def _test_add_and_remove_perm(self, obj, perm_name_prefix, user):
        '''
        Test that a permission can be removed after being added and that the
        removal successfully takes effect.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Collection` or :py:class:`SurveyAsset`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param user: The user for whom permissions on `obj` will be manipulated.
        :type user: :py:class:`User`
        '''
        self._test_add_perm(obj, perm_name_prefix, user)
        remove_perm_name= self._get_perm_name(perm_name_prefix, obj)
        obj.remove_perm(user, remove_perm_name)
        self.assertFalse(user.has_perm(remove_perm_name, obj))

    def _test_add_remove_inherited_perm(self, ancestor_collection,
                                        perm_name_prefix, user, descendant_obj):
        '''
        Test that a permission can be added and removed, and that the removal
        successfully takes effect.

        :param ancestor_collection: Object to manipulate permissions on.
        :type ancestor_collection: :py:class:`Collection`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param user: The user for whom permissions on `ancestor_collection` will
            be manipulated.
        :type user: :py:class:`User`
        :param descendant_obj: The descendant object to check for the
            changed permission (i.e. an asset/collection contained in
            `ancestor_collection`).
        :type descendant_obj: :py:class:`Collection` or :py:class:`SurveyAsset`
        '''
        self._test_add_inherited_perm(ancestor_collection,
                                            perm_name_prefix, user,
                                            descendant_obj)
        descendant_perm_name= self._get_perm_name(perm_name_prefix, descendant_obj)
        ancestor_perm_name= self._get_perm_name(perm_name_prefix, ancestor_collection)
        ancestor_collection.remove_perm(user, ancestor_perm_name)
        self.assertFalse(user.has_perm(descendant_perm_name, descendant_obj))

class PermissionsTestCase(BasePermissionsTestCase):
    fixtures= ['test_data']

    def setUp(self):
        self.admin= User.objects.get(username='admin')
        self.someuser= User.objects.get(username='someuser')
        self.admin_collection= Collection.objects.create(owner=self.admin)
        self.admin_asset= SurveyAsset.objects.create(content=[
            {'type': 'text', 'label': 'Question 1', 'name': 'q1', 'kuid': 'abc'},
            {'type': 'text', 'label': 'Question 2', 'name': 'q2', 'kuid': 'def'},
        ], owner=self.admin)

    def test_add_asset_permission(self):
        self._test_add_perm(self.admin_asset, 'view_', self.someuser)
        self._test_add_perm(self.admin_asset, 'change_', self.someuser)

    def test_remove_asset_permission(self):
        self._test_add_and_remove_perm(self.admin_asset, 'view_', self.someuser)
        self._test_add_and_remove_perm(self.admin_asset, 'change_', self.someuser)

    def test_add_collection_permission(self):
        self._test_add_perm(self.admin_collection, 'view_', self.someuser)
        self._test_add_perm(self.admin_collection, 'change_', self.someuser)

    def test_remove_collection_permission(self):
        self._test_add_and_remove_perm(self.admin_collection, 'view_', self.someuser)
        self._test_add_and_remove_perm(self.admin_collection, 'change_', self.someuser)

    def test_add_asset_inherited_permission(self):
        self.admin_collection.assets.add(self.admin_asset)
        self._test_add_inherited_perm(self.admin_collection, 'view_',
                                            self.someuser, self.admin_asset)
        self._test_add_inherited_perm(self.admin_collection, 'change_',
                                            self.someuser, self.admin_asset)

    def test_remove_collection_inherited_permission(self):
        self.admin_collection.assets.add(self.admin_asset)
        self._test_add_remove_inherited_perm(self.admin_collection, 'view_',
                                     self.someuser, self.admin_asset)
        self._test_add_remove_inherited_perm(self.admin_collection, 'change_',
                                     self.someuser, self.admin_asset)

    def test_get_objects_for_user(self):
        admin_assets= get_all_objects_for_user(self.admin, SurveyAsset)
        admin_collections= get_all_objects_for_user(self.admin, Collection)
        someuser_assets= get_all_objects_for_user(self.someuser, SurveyAsset)
        someuser_collections= get_all_objects_for_user(self.someuser, Collection)
        self.assertIn(self.admin_asset, admin_assets)
        self.assertIn(self.admin_collection, admin_collections)
        self.assertNotIn(self.admin_asset, someuser_assets)
        self.assertNotIn(self.admin_collection, someuser_collections)
