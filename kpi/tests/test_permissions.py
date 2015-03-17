from __future__ import absolute_import

from django.contrib.auth.models import User
from django.test import TestCase

from ..models.collection import Collection
from ..models.survey_asset import SurveyAsset

class PermissionsTestCase(TestCase):
    fixtures= ['test_data']

    def setUp(self):
        self.admin= User.objects.get(username='admin')
        self.someuser= User.objects.get(username='someuser')
        self.admin_collection= Collection.objects.create(owner=self.admin)
        self.admin_asset= SurveyAsset.objects.get(name='fixture asset')

    def _test_add_permission(self, assign_perm_object, perm, user, has_perm_object=None):
        return
        if not has_perm_object:
            has_perm_object= assign_perm_object
        self.assertFalse(has_perm_object.has_perm(perm, user)) # TODO: 'obj.has_perm' will likely change.
        assign_perm_object.assign_perm(perm, user)
        self.assertTrue(has_perm_object.has_perm(perm, user)) # TODO: 'obj.has_perm' will likely change.

    def _test_remove_permission(self, remove_perm_object, perm, user, has_perm_object=None):
        return
        if not has_perm_object:
            has_perm_object= remove_perm_object
        self._test_add_permission(remove_perm_object, perm, user, has_perm_object)
        remove_perm_object.remove_perm(perm, user)
        self.assertFalse(has_perm_object.has_perm(perm, user))

    def test_add_asset_permission(self):
        return
        self._test_add_permission(self.admin_asset, 'can_view', self.someuser)
        self._test_add_permission(self.admin_asset, 'can_edit', self.someuser)

    def test_remove_asset_permission(self):
        return
        self._test_remove_permission(self.admin_asset, 'can_view', self.someuser)
        self._test_remove_permission(self.admin_asset, 'can_edit', self.someuser)

    def test_add_collection_permission(self):
        return
        self._test_add_permission(self.admin_collection, 'can_view', self.someuser)
        self._test_add_permission(self.admin_collection, 'can_edit', self.someuser)

    def test_remove_collection_permission(self):
        return
        self._test_remove_permission(self.admin_collection, 'can_view', self.someuser)
        self._test_remove_permission(self.admin_collection, 'can_edit', self.someuser)

    def test_add_asset_inherited_permission(self):
        return
        self.admin_collection.add(self.admin_asset)
        self._test_add_permission(self.admin_collection, 'can_view', self.someuser, has_perm_object=self.admin_asset)
        self._test_add_permission(self.admin_collection, 'can_edit', self.someuser, has_perm_object=self.admin_asset)

    def test_remove_collection_inherited_permission(self):
        return
        self.admin_collection.add(self.admin_asset)
        self._test_remove_permission(self.admin_collection, 'can_view', self.someuser, has_perm_object=self.admin_asset)
        self._test_remove_permission(self.admin_collection, 'can_edit', self.someuser, has_perm_object=self.admin_asset)

    def test_get_objects_for_user(self):
        return
        admin_objects= get_objects_for_user('can_view', self.admin) # FIXME
        someuser_objects= get_objects_for_user('can_view', self.someuser) # FIXME
        self.assertIn(self.admin_asset, admin_objects)
        self.assertIn(self.admin_collection, admin_objects)
        self.assertNotIn(self.admin_asset, someuser_objects)
        self.assertNotIn(self.admin_collection, someuser_objects)
