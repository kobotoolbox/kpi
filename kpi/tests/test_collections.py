from rest_framework import status
from django.test import TestCase
from kpi.models.collection import Collection
from kpi.models.survey_asset import SurveyAsset
from kpi.models.object_permission import get_all_objects_for_user
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
        initial_asset_count = SurveyAsset.objects.count()
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
        initial_asset_count = SurveyAsset.objects.count()
        initial_collection_count = Collection.objects.count()
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
        self.grandparent_coll = Collection.objects.create(owner=self.superuser)
        self.parent_coll = Collection.objects.create(
            owner=self.superuser,
            parent=self.grandparent_coll
        )
        self.child_coll = Collection.objects.create(
            owner=self.superuser,
            parent=self.parent_coll
        )

    def grant_and_revoke_standalone(self, user, perm):
        coll = self.standalone_coll
        self.assertEqual(user.has_perm(perm, coll), False)
        # Grant
        coll.assign_perm(user, perm)
        self.assertEqual(user.has_perm(perm, coll), True)
        # Revoke
        coll.remove_perm(user, perm)
        self.assertEqual(user.has_perm(perm, coll), False)

    def test_user_view_permission_on_standalone_collection(self):
        self.grant_and_revoke_standalone(self.someuser, 'view_collection')

    def test_user_change_permission_on_standalone_collection(self):
        self.grant_and_revoke_standalone(self.someuser, 'change_collection')

    def grant_and_revoke_parent(self, user, perm):
        self.assertEqual(user.has_perm(perm, self.parent_coll), False)
        self.assertEqual(user.has_perm(perm, self.child_coll), False)
        # Grant
        self.parent_coll.assign_perm(user, perm)
        self.assertEqual(user.has_perm(perm, self.parent_coll), True)
        self.assertEqual(user.has_perm(perm, self.child_coll), True)
        # Revoke
        self.parent_coll.remove_perm(user, perm)
        self.assertEqual(user.has_perm(perm, self.parent_coll), False)
        self.assertEqual(user.has_perm(perm, self.child_coll), False)

    def test_user_view_permission_on_parent_collection(self):
        self.grant_and_revoke_parent(self.someuser, 'view_collection')

    def test_user_change_permission_on_parent_collection(self):
        self.grant_and_revoke_parent(self.someuser, 'change_collection')

    def grant_and_revoke_child(self, user, perm):
        self.assertEqual(user.has_perm(perm, self.parent_coll), False)
        self.assertEqual(user.has_perm(perm, self.child_coll), False)
        # Grant
        self.child_coll.assign_perm(user, perm)
        self.assertEqual(user.has_perm(perm, self.parent_coll), False)
        self.assertEqual(user.has_perm(perm, self.child_coll), True)
        # Revoke
        self.child_coll.remove_perm(user, perm)
        self.assertEqual(user.has_perm(perm, self.parent_coll), False)
        self.assertEqual(user.has_perm(perm, self.child_coll), False)

    def test_user_view_permission_on_child_collection(self):
        self.grant_and_revoke_child(self.someuser, 'view_collection')

    def test_user_change_permission_on_child_collection(self):
        self.grant_and_revoke_child(self.someuser, 'change_collection')

    def assign_parent_child_perms(self, user, parent_perm, child_perm,
                                  parent_deny=False, child_deny=False,
                                  child_first=False):
        self.assertEqual(user.has_perm(parent_perm, self.parent_coll), False)
        self.assertEqual(user.has_perm(child_perm, self.child_coll), False)
        if child_first:
            self.child_coll.assign_perm(user, child_perm, deny=child_deny)
            self.parent_coll.assign_perm(user, parent_perm, deny=parent_deny)
        else:
            self.parent_coll.assign_perm(user, parent_perm, deny=parent_deny)
            self.child_coll.assign_perm(user, child_perm, deny=child_deny)
        self.assertEqual(user.has_perm(parent_perm, self.parent_coll),
                         not parent_deny)
        self.assertEqual(user.has_perm(child_perm, self.child_coll),
                         not child_deny)
        
    def test_user_view_parent_change_child(self, child_first=False):
        user = self.someuser
        self.assign_parent_child_perms(
            user,
            'view_collection',
            'change_collection',
            child_first=child_first
        )
        # assign_parent_child_perms verifies the assignments, but make sure
        # that the change permission hasn't applied to the parent
        self.assertEqual(user.has_perm('change_collection', self.parent_coll),
                         False)

    def test_user_change_parent_view_child(self, child_first=False):
        user = self.someuser
        self.assign_parent_child_perms(
            user,
            'change_collection',
            'change_collection',
            child_deny=True,
            child_first=child_first
        )
        # assign_parent_child_perms verifies the assignments, but make sure
        # that the user can still view the child
        self.assertEqual(user.has_perm('view_collection', self.child_coll),
                         True)

    def test_user_change_parent_deny_child(self, child_first=False):
        user = self.someuser
        self.assign_parent_child_perms(
            user,
            'change_collection',
            'view_collection',
            child_deny=True,
            child_first=child_first
        )
        # Verify that denying view_collection denies change_collection as well
        self.assertEqual(user.has_perm('change_collection', self.child_coll),
                                       False)

    def test_user_deny_parent_change_child(self, child_first=False):
        # A deny at the root level doesn't make sense, so start by granting
        # on the grandparent collection
        user = self.someuser
        self.assertEqual(len(self.grandparent_coll.get_perms(user)), 0)
        self.grandparent_coll.assign_perm(user, 'change_collection')
        self.assertEqual(
            self.grandparent_coll.has_perm(user, 'change_collection'),
            True
        )
        self.assertEqual(self.parent_coll.has_perm(user, 'change_collection'),
                         True)
        self.assertEqual(self.child_coll.has_perm(user, 'change_collection'),
                         True)
        # Don't use assign_parent_child_perms because it expects that the
        # parent won't have any existing permissions
        parent_perm = 'view_collection'
        parent_deny = True
        child_perm = 'change_collection'
        child_deny = False
        if child_first:
            self.child_coll.assign_perm(user, child_perm, deny=child_deny)
            self.parent_coll.assign_perm(user, parent_perm, deny=parent_deny)
        else:
            self.parent_coll.assign_perm(user, parent_perm, deny=parent_deny)
            self.child_coll.assign_perm(user, child_perm, deny=child_deny)
        self.assertEqual(user.has_perm(parent_perm, self.parent_coll),
                         not parent_deny)
        self.assertEqual(user.has_perm(child_perm, self.child_coll),
                         not child_deny)
        # Verify that denying view_collection denies change_collection as well
        self.assertEqual(user.has_perm('change_collection', self.parent_coll),
                                       False)
        # Make sure that the deny permission hasn't applied to the grandparent
        self.assertEqual(
            self.grandparent_coll.has_perm(user, 'change_collection'),
            True
        )

    ''' Try the previous tests again, but this time assign permissions to the
    child before assigning permissions to the parent. '''
    def test_user_change_child_view_parent(self):
        self.test_user_view_parent_change_child(child_first=True)
    def test_user_view_child_change_parent(self):
        self.test_user_change_parent_view_child(child_first=True)
    def test_user_deny_child_change_parent(self):
        self.test_user_change_parent_deny_child(child_first=True)
    def test_user_change_child_deny_parent(self):
        self.test_user_deny_parent_change_child(child_first=True)

    def test_query_all_collections_user_can_access(self):
        # The owner should have access to all owned collections
        self.assertEqual(
            get_all_objects_for_user(self.superuser, Collection).count(),
            4
        )
        # The other users should have nothing yet
        self.assertEqual(
            get_all_objects_for_user(self.someuser, Collection).count(),
            0
        )
        self.assertEqual(
            get_all_objects_for_user(self.anotheruser, Collection).count(),
            0
        )
        # Grant some access and verify the result
        self.grandparent_coll.assign_perm(self.someuser, 'view_collection')
        self.standalone_coll.assign_perm(self.anotheruser, 'change_collection')
        someuser_objects = get_all_objects_for_user(self.someuser, Collection)
        anotheruser_objects = get_all_objects_for_user(self.anotheruser,
                                                       Collection)
        someuser_expected = [
            self.grandparent_coll.pk,
            self.parent_coll.pk,
            self.child_coll.pk
        ]
        self.assertItemsEqual(
            someuser_objects.values_list('pk', flat=True),
            someuser_expected
        )
        self.assertEqual(
            # django.db.models.query.ValuesListQuerySet isn't a real list
            # and will fail the comparison!
            list(anotheruser_objects.values_list('pk', flat=True)),
            [self.standalone_coll.pk]
        )

    def test_url_view_permission_on_standalone_collection(self): pass
    def test_url_change_permission_on_standalone_collection(self): pass
    def test_url_view_permission_on_parent_collection(self): pass
    def test_url_change_permission_on_parent_collection(self): pass
    def test_url_view_permission_on_child_collection(self): pass
    def test_url_change_permission_on_child_collection(self): pass
    def test_url_permission_conflict_resolution(self): pass
