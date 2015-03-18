from rest_framework import status
from django.test import TestCase
from kpi.models.collection import Collection
from kpi.models.survey_asset import SurveyAsset
from django.contrib.auth.models import User

class CreateCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='admin')
        self.coll = Collection.objects.create(owner=self.user)

    def test_collections_can_be_owned(self):
        self.assertEqual(self.coll.owner, self.user)

    def test_collections_cannot_be_anonymous(self):
        def _create_collection_with_no_owner():
            Collection.objects.create()
        self.assertRaises(_create_collection_with_no_owner)

    def test_collection_can_be_tagged(self):
        def _list_tag_names():
            return sorted(list(self.coll.tags.names()))
        self.assertEqual(_list_tag_names(), [])
        self.coll.tags.add('tag1')
        self.assertEqual(_list_tag_names(), ['tag1'])
        # duplicate tags ignored
        self.coll.tags.add('tag1')
        self.assertEqual(_list_tag_names(), ['tag1'])
        self.coll.tags.add('tag2')
        self.assertEqual(_list_tag_names(), ['tag1', 'tag2'])

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
        initial_asset_count= SurveyAsset.objects.count()
        asset = self.coll.survey_assets.create(name='test', content=[
                {'type': 'text', 'label': 'Q1', 'name': 'q1'},
                {'type': 'text', 'label': 'Q2', 'name': 'q2'},
            ])
        self.assertEqual(SurveyAsset.objects.filter(id=asset.id).count(), 1)
        self.assertEqual(SurveyAsset.objects.count(), initial_asset_count + 1)
        self.coll.delete()
        self.assertEqual(SurveyAsset.objects.filter(id=asset.id).count(), 0)
        self.assertEqual(SurveyAsset.objects.count(), initial_asset_count)

    def test_descendants_are_deleted_with_collection(self):
        self.assertEqual(Collection.objects.count(), 1)
        child = Collection.objects.create(name='test_child_collection',
            owner=User.objects.first(), parent=self.coll)
        grandchild = Collection.objects.create(name='test_child_collection',
            owner=User.objects.first(), parent=child)
        self.assertEqual(Collection.objects.count(), 3)
        child_sa = child.survey_assets.create()
        grandchild_sa = grandchild.survey_assets.create()
        self.assertEqual(SurveyAsset.objects.count(), 2)
        self.coll.delete()
        self.assertEqual(Collection.objects.count(), 0)
        self.assertEqual(SurveyAsset.objects.count(), 0)

    def test_create_collection_with_survey_assets(self):
        initial_asset_count= SurveyAsset.objects.count()
        initial_collection_count= Collection.objects.count()
        self.assertTrue(Collection.objects.count() >= 1)
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
        self.assertEqual(SurveyAsset.objects.count(), initial_asset_count + 2)
        self.assertEqual(Collection.objects.count(), initial_collection_count + 1)

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
        self.assertEqual(Collection.objects.count(), 1)
        standalone = Collection.objects.create(name='move_me',
            owner=User.objects.first())
        self.assertEqual(Collection.objects.count(), 2)
        self.assertEqual(standalone.parent, None)
        standalone.parent = self.coll
        standalone.save()
        self.assertEqual(self.coll.get_children()[0], standalone)
        self.assertEqual(self.coll.get_children().count(), 1)
        self.assertEqual(standalone.get_ancestors()[0], self.coll)
        self.assertEqual(standalone.get_ancestors().count(), 1)

    def test_move_collection_from_collection_to_standalone(self):
        self.assertEqual(Collection.objects.count(), 1)
        child = Collection.objects.create(name='move_me_too',
            owner=User.objects.first(), parent=self.coll)
        self.assertEqual(Collection.objects.count(), 2)
        self.assertEqual(child.parent, self.coll)
        child.parent = None
        child.save()
        self.assertEqual(self.coll.get_children().count(), 0)
        self.assertEqual(child.get_ancestors().count(), 0)

    def test_move_collection_between_collections(self):
        self.assertEqual(Collection.objects.count(), 1)
        adoptive_parent = Collection.objects.create(name='adoptive_parent',
            owner=User.objects.first())
        child = Collection.objects.create(name='on_the_move',
            owner=User.objects.first(), parent=self.coll)
        self.assertEqual(Collection.objects.count(), 3)
        self.assertEqual(self.coll.get_children()[0], child)
        self.assertEqual(self.coll.get_children().count(), 1)
        self.assertEqual(child.get_ancestors()[0], self.coll)
        self.assertEqual(child.get_ancestors().count(), 1)
        child.parent = adoptive_parent
        child.save()
        self.assertEqual(self.coll.get_children().count(), 0)
        self.assertEqual(adoptive_parent.get_children()[0], child)
        self.assertEqual(adoptive_parent.get_children().count(), 1)
        self.assertEqual(child.get_ancestors()[0], adoptive_parent)
        self.assertEqual(child.get_ancestors().count(), 1)

class ShareCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.superuser = User.objects.get(username='admin')
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.standalone_coll = Collection.objects.create(owner=self.superuser)
        self.parent_coll = Collection.objects.create(owner=self.superuser)
        self.child_coll = Collection.objects.create(owner=self.superuser,
            parent=self.parent_coll)

    def test_user_view_permission_on_standalone_collection(self):
        # assign perm
        # remove perm
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

    # [AD suggests] We'll want to be able to list all collections a given user can access/edit/etc
    def test_query_all_collections_user_can_access(self): pass
