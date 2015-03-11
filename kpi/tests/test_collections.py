from rest_framework import status
from django.test import TestCase
from kpi.models.collection import Collection
from kpi.models.survey_asset import SurveyAsset
from django.contrib.auth.models import User

class CreateCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.all()[0]
        self.coll = Collection.objects.create(owner=self.user)

    def test_import_survey_assets_to_collection(self):
        self.assertEqual(self.coll.survey_assets.count(), 0)
        self.coll.survey_assets.create(name='test', content=[
                {'type': 'text', 'label': 'Q1', 'name': 'q1'},
                {'type': 'text', 'label': 'Q2', 'name': 'q2'},
            ])
        self.assertEqual(self.coll.survey_assets.count(), 1)

    def test_assets_are_deleted_with_collection(self):
        '''
        right now, this does make it easy to delete survey_assets within a
        collection.
        '''
        asset = self.coll.survey_assets.create(name='test', content=[
                {'type': 'text', 'label': 'Q1', 'name': 'q1'},
                {'type': 'text', 'label': 'Q2', 'name': 'q2'},
            ])
        self.assertEqual(SurveyAsset.objects.filter(id=asset.id).count(), 1)
        self.assertEqual(SurveyAsset.objects.count(), 1)
        self.coll.delete()
        self.assertEqual(SurveyAsset.objects.filter(id=asset.id).count(), 0)
        self.assertEqual(SurveyAsset.objects.count(), 0)

    def test_descendants_are_deleted_with_collection(self):
        # TODO
        # also assets of descendants
        pass

    def test_create_collection_with_survey_assets(self):
        self.assertEqual(Collection.objects.count(), 1)
        self.assertEqual(SurveyAsset.objects.count(), 0)
        Collection.objects.create(name='test_collection', owner=self.user, survey_assets=[
                {
                    'name': 'test_survey_asset',
                    'content': [
                        {'type': 'text', 'label': 'Q1', 'name': 'q1'},
                    ]
                },
                {
                    'name': 'test_survey_asset',
                    'content': [
                        {'type': 'text', 'label': 'Q2', 'name': 'q2'},
                    ]
                },
            ])
        self.assertEqual(SurveyAsset.objects.count(), 2)
        self.assertEqual(Collection.objects.count(), 2)

    def test_create_child_collection(self):
        self.assertEqual(Collection.objects.count(), 1)
        child = Collection.objects.create(name='test_child_collection',
            owner=User.objects.first(), parent=self.coll)
        self.assertEqual(Collection.objects.count(), 2)
        self.assertEqual(self.coll.get_children()[0], child)
        self.assertEqual(self.coll.get_children().count(), 1)
        self.assertEqual(child.get_ancestors()[0], self.coll)
        self.assertEqual(child.get_ancestors().count(), 1)

    # Leave in this class or create a new one?
    def test_move_standalone_collection_into_collection(self):
        # TODO
        pass

    def test_move_collection_from_collection_to_standalone(self):
        # TODO
        pass

    def test_move_collection_between_collections(self):
        # TODO
        pass

class ShareCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        # TODO
        pass

    def test_user_view_permission_on_standalone_collection(self):
        # TODO
        # Grant and revoke for all of these
        pass

    def test_user_edit_permission_on_standalone_collection(self):
        # TODO
        pass

    def test_user_view_permission_on_parent_collection(self):
        # TODO
        # Child with no direct permissions must be affected accordingly
        pass

    def test_user_edit_permission_on_parent_collection(self):
        # TODO
        pass

    def test_user_view_permission_on_child_collection(self):
        # TODO
        # Parent must remain unaffected
        pass

    def test_user_edit_permission_on_child_collection(self):
        # TODO
        pass

    def test_user_permission_conflict_resolution(self):
        # TODO
        '''
        User has:
        * View on parent, edit on child
        * Edit on parent, view on child
        * Edit on parent, deny on child
        * Deny on parent, edit on child
           ? Should this scenario exist? Maybe permit->deny->permit could
             happen. A top-level deny isn't different than abscence and should
             probably not be allowed.

        '''
        pass

    def test_url_view_permission_on_standalone_collection(self): pass
    def test_url_edit_permission_on_standalone_collection(self): pass
    def test_url_view_permission_on_parent_collection(self): pass
    def test_url_edit_permission_on_parent_collection(self): pass
    def test_url_view_permission_on_child_collection(self): pass
    def test_url_edit_permission_on_child_collection(self): pass
    def test_url_permission_conflict_resolution(self): pass
