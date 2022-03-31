# coding: utf-8
from django.contrib.auth.models import User, AnonymousUser, Permission
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase
from rest_framework import serializers

from kpi.constants import (
    ASSET_TYPE_COLLECTION,
    ASSET_TYPE_QUESTION,
    PERM_CHANGE_ASSET,
    PERM_DISCOVER_ASSET,
    PERM_VIEW_ASSET,
)
from kpi.utils.object_permission import get_all_objects_for_user
from ..models.asset import Asset


class CreateCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.coll = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, owner=self.user
        )
        self.asset = Asset.objects.get(name='fixture asset')
        self.initial_asset_count = Asset.objects.exclude(
            asset_type=ASSET_TYPE_COLLECTION
        ).count()
        self.initial_collection_count= Asset.objects.filter(
            asset_type=ASSET_TYPE_COLLECTION
        ).count()

    @staticmethod
    def _get_ancestors(asset):
        ancestors = []
        while True:
            if not asset.parent:
                return ancestors
            ancestors.append(asset.parent)
            asset = asset.parent

    def test_collections_can_be_owned(self):
        self.assertEqual(self.coll.owner, self.user)

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

    def test_import_assets_to_collection(self):
        self.assertEqual(self.coll.children.count(), 0)
        self.coll.children.create(name='test', content={'survey': [
            {'type': 'text', 'label': 'Q1', 'name': 'q1'},
            {'type': 'text', 'label': 'Q2', 'name': 'q2'},
        ]})
        self.assertEqual(self.coll.children.count(), 1)
        self.coll.children.add(self.asset)
        self.assertEqual(self.coll.children.count(), 2)

    def test_assets_are_deleted_with_collection(self):
        """
        right now, this does make it easy to delete assets within a
        collection.
        """
        asset = self.coll.children.create(name='test', content={'survey': [
            {'type': 'text', 'label': 'Q1', 'name': 'q1'},
            {'type': 'text', 'label': 'Q2', 'name': 'q2'},
        ]})
        self.assertEqual(Asset.objects.filter(id=asset.id).count(), 1)
        self.assertEqual(
            Asset.objects.exclude(asset_type=ASSET_TYPE_COLLECTION).count(),
            self.initial_asset_count + 1,
        )
        self.coll.delete()
        self.assertEqual(Asset.objects.filter(id=asset.id).count(), 0)
        self.assertEqual(
            Asset.objects.exclude(asset_type=ASSET_TYPE_COLLECTION).count(),
            self.initial_asset_count,
        )

    def test_descendants_are_deleted_with_collection(self):
        child = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, name='test_child_collection',
            owner=self.user, parent=self.coll
        )
        grandchild = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, name='test_child_collection',
            owner=self.user, parent=child
        )
        self.assertEqual(
            Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION).count(),
            self.initial_collection_count + 2,
        )
        _ = child.children.create()
        _ = grandchild.children.create()
        self.assertEqual(
            Asset.objects.exclude(asset_type=ASSET_TYPE_COLLECTION).count(),
            self.initial_asset_count + 2,
        )
        self.coll.delete()
        self.assertEqual(
            Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION).count(),
            self.initial_collection_count - 1,
        )
        self.assertEqual(
            Asset.objects.exclude(asset_type=ASSET_TYPE_COLLECTION).count(),
            self.initial_asset_count,
        )

    def test_create_collection_with_assets(self):
        self.assertTrue(
            Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION).count() >= 1
        )
        Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, name='test_collection',
            owner=self.user, children_to_create=[
                {
                    'name': 'test_asset',
                    'content': {'survey': [
                            {'type': 'text', 'label': 'Q1', 'name': 'q1'},
                    ]}
                },
                {
                    'name': 'test_asset',
                    'content': {'survey': [
                            {'type': 'text', 'label': 'Q2', 'name': 'q2'},
                    ]}
                },
            ]
        )
        self.assertEqual(
            Asset.objects.exclude(asset_type=ASSET_TYPE_COLLECTION).count(),
            self.initial_asset_count + 2,
        )
        self.assertEqual(
            Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION).count(),
            self.initial_collection_count + 1,
        )

    def test_create_child_collection(self):
        self.assertEqual(
            Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION).count(), 1
        )
        child = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION,
            name="test_child_collection",
            owner=self.user,
            parent=self.coll,
        )
        self.assertEqual(
            Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION).count(), 2
        )
        self.assertEqual(self.coll.children.first(), child)
        self.assertEqual(self.coll.children.count(), 1)
        self.assertEqual(self._get_ancestors(child)[0], self.coll)
        self.assertEqual(len(self._get_ancestors(child)), 1)

    # Leave in this class or create a new one?
    def test_move_standalone_collection_into_collection(self):
        self.assertEqual(
            Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION).count(), 1
        )
        standalone = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, name="move_me", owner=self.user
        )
        self.assertEqual(
            Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION).count(), 2
        )
        self.assertEqual(standalone.parent, None)
        standalone.parent = self.coll
        standalone.save()
        self.assertEqual(self.coll.children.first(), standalone)
        self.assertEqual(self.coll.children.count(), 1)
        self.assertEqual(self._get_ancestors(standalone)[0], self.coll)
        self.assertEqual(len(self._get_ancestors(standalone)), 1)

    def test_move_collection_from_collection_to_standalone(self):
        self.assertEqual(
            Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION).count(), 1
        )
        child = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION,
            name="move_me_too",
            owner=self.user,
            parent=self.coll,
        )
        self.assertEqual(
            Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION).count(), 2
        )
        self.assertEqual(child.parent, self.coll)
        child.parent = None
        child.save()
        self.assertEqual(self.coll.children.count(), 0)
        self.assertEqual(len(self._get_ancestors(child)), 0)

    def test_move_collection_between_collections(self):
        self.assertEqual(
            Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION).count(), 1
        )
        adoptive_parent = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION,
            name="adoptive_parent",
            owner=self.user,
        )
        child = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION,
            name="on_the_move",
            owner=self.user,
            parent=self.coll,
        )
        self.assertEqual(
            Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION).count(), 3
        )
        self.assertEqual(self.coll.children.first(), child)
        self.assertEqual(self.coll.children.count(), 1)
        self.assertEqual(self._get_ancestors(child)[0], self.coll)
        self.assertEqual(len(self._get_ancestors(child)), 1)
        child.parent = adoptive_parent
        child.save()
        self.assertEqual(self.coll.children.count(), 0)
        self.assertEqual(adoptive_parent.children.first(), child)
        self.assertEqual(adoptive_parent.children.count(), 1)
        self.assertEqual(self._get_ancestors(child)[0], adoptive_parent)
        self.assertEqual(len(self._get_ancestors(child)), 1)


class ShareCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.coll_owner = User.objects.create(username='coll_owner')
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.standalone_coll = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, owner=self.coll_owner
        )
        self.grandparent_coll = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, owner=self.coll_owner
        )
        self.parent_coll = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION,
            owner=self.coll_owner,
            parent=self.grandparent_coll
        )
        self.child_coll = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION,
            owner=self.coll_owner,
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
        self.grant_and_revoke_standalone(self.someuser, PERM_VIEW_ASSET)

    def test_user_change_permission_on_standalone_collection(self):
        self.grant_and_revoke_standalone(self.someuser, PERM_CHANGE_ASSET)

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
        self.grant_and_revoke_parent(self.someuser, PERM_VIEW_ASSET)

    def test_user_change_permission_on_parent_collection(self):
        self.grant_and_revoke_parent(self.someuser, PERM_CHANGE_ASSET)

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
        self.grant_and_revoke_child(self.someuser, PERM_VIEW_ASSET)

    def test_user_change_permission_on_child_collection(self):
        self.grant_and_revoke_child(self.someuser, PERM_CHANGE_ASSET)

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
            PERM_VIEW_ASSET,
            PERM_CHANGE_ASSET,
            child_first=child_first
        )
        # assign_parent_child_perms verifies the assignments, but make sure
        # that the change permission hasn't applied to the parent
        self.assertEqual(user.has_perm(PERM_CHANGE_ASSET, self.parent_coll),
                         False)

    def test_user_change_parent_view_child(self, child_first=False):
        user = self.someuser
        self.assign_parent_child_perms(
            user,
            PERM_CHANGE_ASSET,
            PERM_CHANGE_ASSET,
            child_deny=True,
            child_first=child_first
        )
        # assign_parent_child_perms verifies the assignments, but make sure
        # that the user can still view the child
        self.assertEqual(user.has_perm(PERM_VIEW_ASSET, self.child_coll),
                         True)

    def test_user_change_parent_deny_child(self, child_first=False):
        user = self.someuser
        self.assign_parent_child_perms(
            user,
            PERM_CHANGE_ASSET,
            PERM_VIEW_ASSET,
            child_deny=True,
            child_first=child_first
        )
        # Verify that denying view_asset denies change_asset as well
        self.assertEqual(user.has_perm(PERM_CHANGE_ASSET, self.child_coll),
                         False)

    def test_user_deny_parent_change_child(self, child_first=False):
        # A deny at the root level doesn't make sense, so start by granting
        # on the grandparent collection
        user = self.someuser
        self.assertEqual(len(self.grandparent_coll.get_perms(user)), 0)
        self.grandparent_coll.assign_perm(user, PERM_CHANGE_ASSET)
        self.assertEqual(
            self.grandparent_coll.has_perm(user, PERM_CHANGE_ASSET),
            True
        )
        self.assertEqual(self.parent_coll.has_perm(user, PERM_CHANGE_ASSET),
                         True)
        self.assertEqual(self.child_coll.has_perm(user, PERM_CHANGE_ASSET),
                         True)
        # Don't use assign_parent_child_perms because it expects that the
        # parent won't have any existing permissions
        parent_perm = PERM_VIEW_ASSET
        parent_deny = True
        child_perm = PERM_CHANGE_ASSET
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
        # Verify that denying view_asset denies change_asset as well
        self.assertEqual(user.has_perm(PERM_CHANGE_ASSET, self.parent_coll),
                         False)
        # Make sure that the deny permission hasn't applied to the grandparent
        self.assertEqual(
            self.grandparent_coll.has_perm(user, PERM_CHANGE_ASSET),
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
            get_all_objects_for_user(self.coll_owner, Asset)
            .filter(asset_type=ASSET_TYPE_COLLECTION)
            .count(),
            4,
        )
        # The other users should have nothing yet
        self.assertEqual(
            get_all_objects_for_user(self.someuser, Asset)
            .filter(asset_type=ASSET_TYPE_COLLECTION)
            .count(),
            0,
        )
        self.assertEqual(
            get_all_objects_for_user(self.anotheruser, Asset)
            .filter(asset_type=ASSET_TYPE_COLLECTION)
            .count(),
            0,
        )
        # Grant some access and verify the result
        self.grandparent_coll.assign_perm(self.someuser, PERM_VIEW_ASSET)
        self.standalone_coll.assign_perm(self.anotheruser, PERM_CHANGE_ASSET)
        someuser_objects = get_all_objects_for_user(
            self.someuser, Asset
        ).filter(asset_type=ASSET_TYPE_COLLECTION)
        anotheruser_objects = get_all_objects_for_user(
            self.anotheruser, Asset
        ).filter(asset_type=ASSET_TYPE_COLLECTION)
        someuser_expected = [
            self.grandparent_coll.pk,
            self.parent_coll.pk,
            self.child_coll.pk
        ]
        self.assertListEqual(
            sorted(list(someuser_objects.values_list('pk', flat=True))),
            sorted(someuser_expected)
        )
        self.assertEqual(
            # Without coercion, django.db.models.query.ValuesListQuerySet isn't
            # a real list and will fail the comparison.
            list(anotheruser_objects.values_list('pk', flat=True)),
            [self.standalone_coll.pk]
        )

    def test_object_permissions_are_deleted_with_collection(self):
        # The owner of the collection gets all permissions by default,
        # so we expect those to be present.
        content_type = ContentType.objects.get_for_model(self.standalone_coll)
        expected_perms = sorted(
            Permission.objects.filter(
                content_type=content_type,
                codename__in=Asset.ASSIGNABLE_PERMISSIONS_BY_TYPE[
                    ASSET_TYPE_COLLECTION
                ],
            ).values_list("pk", flat=True)
        )
        self.assertEqual(
            sorted(
                self.standalone_coll.permissions.filter(
                    user=self.standalone_coll.owner
                ).values_list('permission_id', flat=True)
            ),
            expected_perms,
        )
        # Assign some new permissions
        self.standalone_coll.assign_perm(self.someuser, PERM_VIEW_ASSET)
        self.standalone_coll.assign_perm(self.anotheruser, PERM_CHANGE_ASSET)
        # change_asset also provides view_asset, so expect 3 more
        # permissions, not 2
        self.assertEqual(
            self.standalone_coll.permissions.count(), len(expected_perms) + 3
        )
        # Delete the collection and make sure all associated permissions
        # are gone
        self.standalone_coll.delete()
        self.assertEqual(self.standalone_coll.permissions.count(), 0)

    def test_anonymous_view_permission_on_standalone_collection(self):
        # Grant
        self.assertFalse(AnonymousUser().has_perm(
            PERM_VIEW_ASSET, self.standalone_coll))
        self.standalone_coll.assign_perm(AnonymousUser(), PERM_VIEW_ASSET)
        self.assertTrue(AnonymousUser().has_perm(
            PERM_VIEW_ASSET, self.standalone_coll))
        # Revoke
        self.standalone_coll.remove_perm(AnonymousUser(), PERM_VIEW_ASSET)
        self.assertFalse(AnonymousUser().has_perm(
            PERM_VIEW_ASSET, self.standalone_coll))

    def test_anonymous_change_permission_on_standalone_collection(self):
        # TODO: behave properly if ALLOWED_ANONYMOUS_PERMISSIONS actually
        # includes change_asset
        try:
            # This is expected to fail since only real users can have any
            # permissions beyond view
            self.standalone_coll.assign_perm(
                AnonymousUser(), PERM_CHANGE_ASSET)
        except serializers.ValidationError:
            pass
        # Make sure the assignment failed
        self.assertFalse(AnonymousUser().has_perm(
            PERM_CHANGE_ASSET, self.standalone_coll))

    def test_anonymous_as_baseline_for_authenticated(self):
        """
        If the public can view an object, then all users should be able
        to do the same.
        """
        # No one should have any permission yet
        for user_obj in AnonymousUser(), self.someuser:
            self.assertFalse(user_obj.has_perm(
                PERM_VIEW_ASSET, self.standalone_coll))
        # Grant to anonymous
        self.standalone_coll.assign_perm(AnonymousUser(), PERM_VIEW_ASSET)
        # Check that both anonymous and `someuser` can view
        for user_obj in AnonymousUser(), self.someuser:
            self.assertTrue(user_obj.has_perm(
                PERM_VIEW_ASSET, self.standalone_coll))


class DiscoverablePublicCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.coll = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, owner=self.user
        )

    def test_collection_not_discoverable_by_default(self):
        self.assertFalse(AnonymousUser().has_perm(
            PERM_DISCOVER_ASSET, self.coll))
        self.assertFalse(AnonymousUser().has_perm(
            PERM_VIEW_ASSET, self.coll))
        # Should remain non-discoverable even after allowing anon access
        self.coll.assign_perm(AnonymousUser(), PERM_VIEW_ASSET)
        self.assertTrue(AnonymousUser().has_perm(
            PERM_VIEW_ASSET, self.coll))
        self.assertFalse(AnonymousUser().has_perm(
            PERM_DISCOVER_ASSET, self.coll))


class LanguagesCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.one_collection = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION,
            owner=self.user,
            name='One collection'
        )

        self.other_collection = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION,
            owner=self.user,
            name='Another collection'
        )

    def add_child(self, update_parent_languages=True, content=None):
        question_content = content or {
            'survey': [
                {
                    'type': 'text',
                    'label': ['Une question', 'Una pregunta']
                }
            ],
            'translations': ['Français (fr)', 'Español (es)'],
            'translated': ['label'],
            'schema': '1',
            'settings': {}
        }
        child = Asset.objects.create(
            asset_type=ASSET_TYPE_QUESTION,
            owner=self.user,
            parent=self.one_collection,
            content=question_content,
            update_parent_languages=update_parent_languages
        )
        return child

    def test_add_child(self):
        self.assertEqual(self.one_collection.summary.get('languages', []), [])
        child = self.add_child()
        self.assertEqual(sorted(self.one_collection.summary.get('languages')),
                         sorted(child.summary.get('languages')))
        return child

    def test_move_child_to_another_collection(self):
        child = self.add_child()
        self.assertEqual(self.other_collection.summary.get('languages', []), [])
        self.assertEqual(sorted(self.one_collection.summary.get('languages')),
                         sorted(child.summary.get('languages')))

        child.parent = self.other_collection
        child.save()

        self.one_collection.refresh_from_db()
        self.assertEqual(self.one_collection.summary.get('languages', []), [])
        self.assertEqual(sorted(self.other_collection.summary.get('languages')),
                         sorted(child.summary.get('languages')))

    def test_delete_children(self):
        first_child = self.add_child()
        second_child = self.add_child(content={
            'survey': [
                {
                    'type': 'text',
                    'label': ['One question', 'Jedno pytanie', 'Une question']
                }
            ],
            'translations': ['English (en)', 'Polski (pl)', 'Français (fr)'],
            'translated': ['label'],
            'schema': '1',
            'settings': {}
        })
        first_child.delete()
        self.assertEqual(sorted(self.one_collection.summary.get('languages')),
                         sorted(second_child.summary.get('languages')))

        second_child.delete()
        self.assertEqual(self.one_collection.summary.get('languages', []), [])

    def test_bulk_insert_children(self):
        self.assertEqual(self.one_collection.summary.get('languages', []), [])
        first_child = self.add_child(update_parent_languages=False)
        second_child = self.add_child(update_parent_languages=False, content={
            'survey': [
                {
                    'type': 'text',
                    'label': ['One question', 'Jedno pytanie', 'Une question']
                }
            ],
            'translations': ['English (en)', 'Polski (pl)', 'Français (fr)'],
            'translated': ['label'],
            'schema': '1',
            'settings': {}
        })
        self.assertEqual(self.one_collection.summary.get('languages', []), [])
        self.one_collection.update_languages([first_child, second_child])

        children_languages = list(set(first_child.summary.get('languages')
                                      + second_child.summary.get('languages')))
        self.assertEqual(sorted(self.one_collection.summary.get('languages')),
                         sorted(children_languages))

    def test_rename_child_language(self):
        child = self.add_child()
        self.assertEqual(self.one_collection.summary.get('languages').sort(),
                         child.summary.get('languages').sort())

        child.content['translations'] = ['Français (fra)', 'Español (es)']
        child.save()
        self.one_collection.refresh_from_db()
        self.assertEqual(sorted(self.one_collection.summary.get('languages')),
                         sorted(child.summary.get('languages')))
