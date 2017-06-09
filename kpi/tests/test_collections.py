from django.contrib.auth.models import User, AnonymousUser, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.test import TestCase

from ..models.asset import Asset
from ..models.collection import Collection
from ..models.object_permission import ObjectPermission
from ..models.object_permission import get_all_objects_for_user


class CreateCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.coll = Collection.objects.create(owner=self.user)
        self.asset = Asset.objects.get(name='fixture asset')
        self.initial_asset_count= Asset.objects.count()
        self.initial_collection_count= Collection.objects.count()

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

    def test_import_assets_to_collection(self):
        self.assertEqual(self.coll.assets.count(), 0)
        self.coll.assets.create(name='test', content={'survey': [
            {'type': 'text', 'label': 'Q1', 'name': 'q1'},
            {'type': 'text', 'label': 'Q2', 'name': 'q2'},
        ]})
        self.assertEqual(self.coll.assets.count(), 1)
        self.coll.assets.add(self.asset)
        self.assertEqual(self.coll.assets.count(), 2)

    def test_assets_are_deleted_with_collection(self):
        '''
        right now, this does make it easy to delete assets within a
        collection.
        '''
        asset = self.coll.assets.create(name='test', content={'survey': [
            {'type': 'text', 'label': 'Q1', 'name': 'q1'},
            {'type': 'text', 'label': 'Q2', 'name': 'q2'},
        ]})
        self.assertEqual(Asset.objects.filter(id=asset.id).count(), 1)
        self.assertEqual(Asset.objects.count(), self.initial_asset_count + 1)
        self.coll.delete()
        self.assertEqual(Asset.objects.filter(id=asset.id).count(), 0)
        self.assertEqual(Asset.objects.count(), self.initial_asset_count)

    def test_descendants_are_deleted_with_collection(self):
        child = Collection.objects.create(name='test_child_collection',
                                          owner=self.user, parent=self.coll)
        grandchild = Collection.objects.create(name='test_child_collection',
                                               owner=self.user, parent=child)
        self.assertEqual(Collection.objects.count(), self.initial_collection_count + 2)
        _ = child.assets.create()
        _ = grandchild.assets.create()
        self.assertEqual(Asset.objects.count(), self.initial_asset_count + 2)
        self.coll.delete()
        self.assertEqual(Collection.objects.count(), self.initial_collection_count - 1)
        self.assertEqual(Asset.objects.count(), self.initial_asset_count)

    def test_create_collection_with_assets(self):
        self.assertTrue(Collection.objects.count() >= 1)
        Collection.objects.create(name='test_collection', owner=self.user, assets=[
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
        ])
        self.assertEqual(Asset.objects.count(), self.initial_asset_count + 2)
        self.assertEqual(Collection.objects.count(), self.initial_collection_count + 1)

    def test_create_child_collection(self):
        self.assertEqual(Collection.objects.count(), 1)
        child = Collection.objects.create(name='test_child_collection',
                                          owner=self.user, parent=self.coll)
        self.assertEqual(Collection.objects.count(), 2)
        self.assertEqual(self.coll.get_children()[0], child)
        self.assertEqual(self.coll.get_children().count(), 1)
        self.assertEqual(child.get_ancestors()[0], self.coll)
        self.assertEqual(child.get_ancestors().count(), 1)

    # Leave in this class or create a new one?
    def test_move_standalone_collection_into_collection(self):
        self.assertEqual(Collection.objects.count(), 1)
        standalone = Collection.objects.create(name='move_me',
                                               owner=self.user)
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
                                          owner=self.user, parent=self.coll)
        self.assertEqual(Collection.objects.count(), 2)
        self.assertEqual(child.parent, self.coll)
        child.parent = None
        child.save()
        self.assertEqual(self.coll.get_children().count(), 0)
        self.assertEqual(child.get_ancestors().count(), 0)

    def test_move_collection_between_collections(self):
        self.assertEqual(Collection.objects.count(), 1)
        adoptive_parent = Collection.objects.create(name='adoptive_parent',
                                                    owner=self.user)
        child = Collection.objects.create(name='on_the_move',
                                          owner=self.user, parent=self.coll)
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
        self.coll_owner = User.objects.create(username='coll_owner')
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.standalone_coll = Collection.objects.create(owner=self.coll_owner)
        self.grandparent_coll = Collection.objects.create(
            owner=self.coll_owner)
        self.parent_coll = Collection.objects.create(
            owner=self.coll_owner,
            parent=self.grandparent_coll
        )
        self.child_coll = Collection.objects.create(
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
            get_all_objects_for_user(self.coll_owner, Collection).count(),
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
            # Without coercion, django.db.models.query.ValuesListQuerySet isn't
            # a real list and will fail the comparison.
            list(anotheruser_objects.values_list('pk', flat=True)),
            [self.standalone_coll.pk]
        )

    def test_object_permissions_are_deleted_with_collection(self):
        # The owner of the collection gets all permissions by default,
        # so we expect those to be present.
        content_type = ContentType.objects.get_for_model(self.standalone_coll)
        expected_perms = sorted(Permission.objects.filter(
            content_type=content_type,
            codename__in=Collection.ASSIGNABLE_PERMISSIONS
        ).values_list('pk', flat=True))
        self.assertEqual(
            sorted(ObjectPermission.objects.filter_for_object(
                self.standalone_coll,
                user=self.standalone_coll.owner
            ).values_list('permission_id', flat=True)),
            expected_perms
        )
        # Assign some new permissions
        self.standalone_coll.assign_perm(self.someuser, 'view_collection')
        self.standalone_coll.assign_perm(self.anotheruser, 'change_collection')
        # change_collection also provides view_collection, so expect 3 more
        # permissions, not 2
        self.assertEqual(
            ObjectPermission.objects.filter_for_object(
                self.standalone_coll
            ).count(),
            len(expected_perms) + 3
        )
        # Delete the collection and make sure all associated permissions
        # are gone
        self.standalone_coll.delete()
        self.assertEqual(
            ObjectPermission.objects.filter_for_object(
                self.standalone_coll
            ).count(),
            0
        )

    def test_owner_can_edit_permissions(self):
        self.assertTrue(self.standalone_coll.owner.has_perm(
            'share_collection',
            self.standalone_coll
        ))

    def test_share_collection_permission_is_not_inherited(self):
        # Make a child collection whose owner is different than its parent's
        coll = Collection.objects.create(
            name="anotheruser's collection",
            owner=self.anotheruser,
            parent=self.standalone_coll,
            # The change permission is inherited; prevent it from allowing
            # users to edit permissions
            editors_can_change_permissions=False
        )
        # Ensure the parent's owner can't change permissions on the child
        self.assertFalse(self.standalone_coll.owner.has_perm(
            'share_collection',
            coll
        ))

    def test_change_permission_provides_share_permission(self):
        self.assertFalse(self.someuser.has_perm(
            'change_collection', self.standalone_coll))
        # Grant the change permission and make sure it provides
        # share_collection
        self.standalone_coll.assign_perm(self.someuser, 'change_collection')
        self.assertTrue(self.someuser.has_perm(
            'share_collection', self.standalone_coll))
        # Restrict share_collection to the owner and make sure someuser loses
        # share_collection
        self.standalone_coll.editors_can_change_permissions = False
        self.assertFalse(self.someuser.has_perm(
            'share_collection', self.standalone_coll))

    def test_anonymous_view_permission_on_standalone_collection(self):
        # Grant
        self.assertFalse(AnonymousUser().has_perm(
            'view_collection', self.standalone_coll))
        self.standalone_coll.assign_perm(AnonymousUser(), 'view_collection')
        self.assertTrue(AnonymousUser().has_perm(
            'view_collection', self.standalone_coll))
        # Revoke
        self.standalone_coll.remove_perm(AnonymousUser(), 'view_collection')
        self.assertFalse(AnonymousUser().has_perm(
            'view_collection', self.standalone_coll))

    def test_anoymous_change_permission_on_standalone_collection(self):
        # TODO: behave properly if ALLOWED_ANONYMOUS_PERMISSIONS actually
        # includes change_collection
        try:
            # This is expected to fail since only real users can have any
            # permissions beyond view
            self.standalone_coll.assign_perm(
                AnonymousUser(), 'change_collection')
        except ValidationError:
            pass
        # Make sure the assignment failed
        self.assertFalse(AnonymousUser().has_perm(
            'change_collection', self.standalone_coll))

    def test_anonymous_as_baseline_for_authenticated(self):
        ''' If the public can view an object, then all users should be able
        to do the same. '''
        # No one should have any permission yet
        for user_obj in AnonymousUser(), self.someuser:
            self.assertFalse(user_obj.has_perm(
                'view_collection', self.standalone_coll))
        # Grant to anonymous
        self.standalone_coll.assign_perm(AnonymousUser(), 'view_collection')
        # Check that both anonymous and someuser can view
        for user_obj in AnonymousUser(), self.someuser:
            self.assertTrue(user_obj.has_perm(
                'view_collection', self.standalone_coll))


class DiscoverablePublicCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.coll = Collection.objects.create(owner=self.user)

    def test_collection_not_discoverable_by_default(self):
        self.assertFalse(self.coll.discoverable_when_public)
        self.assertFalse(AnonymousUser().has_perm(
            'view_collection', self.coll))
        # Should remain non-discoverable even after allowing anon access
        self.coll.assign_perm(AnonymousUser(), 'view_collection')
        self.assertTrue(AnonymousUser().has_perm(
            'view_collection', self.coll))
        self.assertFalse(self.coll.discoverable_when_public)
