from __future__ import absolute_import

from django.contrib.auth.models import User
from django.test import TestCase

from ..models.collection import Collection
from ..models.survey_asset import SurveyAsset

class PermissionsTestCase(TestCase):
    fixtures= ['test_case']

    def setUp(self):
        self.admin= User.objects.get(username='admin')
        self.someuser= User.objects.get(username='someuser')
        self.admin_collection= Collection.objects.create(owner=self.admin)
        self.admin_asset= SurveyAsset.objects.get(name='fixture asset')

    def _test_add_permission(self, obj, perm, user):
        obj.assign_perm('can_view', user)
        self.assertTrue(obj.has_perm('can_view', user)) # 'obj.has_perm' will likely change.

    def test_add_asset_view_permission(self):
        self.admin_asset.assign_perm('can_view', self.someuser)
        self.assertTrue(self.admin_asset.has_perm('can_view', self.someuser))

    def test_add_collection_view_permission(self):
        self._test_add_permission(self.admin_collection, 'can_view', self.someuser)
