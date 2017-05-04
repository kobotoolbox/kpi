from django.contrib.auth.models import Permission
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase

from ..models.asset import Asset
from ..models.collection import Collection
from ..models.object_permission import get_all_objects_for_user


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
        :type model_instance: :py:class:`Collection` or :py:class:`Asset`
        :return: The computed permission name.
        :rtype: str
        '''
        if not perm_name_prefix[-1] == '_':
            perm_name_prefix += '_'
        perm_name = perm_name_prefix + model_instance._meta.model_name
        return perm_name

    def _test_add_perm(self, obj, perm_name_prefix, user):
        '''
        Test that a permission can be added and that the permission successfully
        takes effect.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Collection` or :py:class:`Asset`
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
        :type obj: :py:class:`Collection` or :py:class:`Asset`
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
        :type obj: :py:class:`Collection` or :py:class:`Asset`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param user: The user for whom permissions on `obj` will be manipulated.
        :type user: :py:class:`User`
        :param descendant_obj: The descendant object to check for the
            changed permission (i.e. an asset/collection contained in
            `ancestor_collection`).
        :type descendant_obj: :py:class:`Collection` or :py:class:`Asset`
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
        :type obj: :py:class:`Collection` or :py:class:`Asset`
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
        :type descendant_obj: :py:class:`Collection` or :py:class:`Asset`
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
        self.admin_asset= Asset.objects.create(content={'survey': [
            {'type': 'text', 'label': 'Question 1', 'name': 'q1', 'kuid': 'abc'},
            {'type': 'text', 'label': 'Question 2', 'name': 'q2', 'kuid': 'def'},
        ]}, owner=self.admin)
        self.asset_owner_permissions = [
            'add_submissions',
            'change_asset',
            'change_submissions',
            'delete_asset',
            'delete_submissions',
            'share_asset',
            'share_submissions',
            'view_asset',
            'view_submissions'
        ]
        self.collection_owner_permissions = [
            'change_collection',
            'delete_collection',
            'share_collection',
            'view_collection'
        ]

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

    def test_add_submission_permission(self):
        codenames = (
            'add_submissions',
            'view_submissions',
            'change_submissions' # Must be last since it implies `view_submissions`
        )
        asset = self.admin_asset
        grantee = self.someuser
        for codename in codenames:
            self.assertFalse(grantee.has_perm(codename, asset))
            asset.assign_perm(grantee, codename)
            self.assertTrue(grantee.has_perm(codename, asset))

    def test_remove_submission_permission(self):
        codenames = (
            'add_submissions',
            'view_submissions',
            'change_submissions' # Must be last since it implies `view_submissions`
        )
        asset = self.admin_asset
        grantee = self.someuser
        for codename in codenames:
            self.assertFalse(grantee.has_perm(codename, asset))
            asset.assign_perm(grantee, codename)
            self.assertTrue(grantee.has_perm(codename, asset))
        for codename in reversed(codenames):
            asset.remove_perm(grantee, codename)
            self.assertFalse(grantee.has_perm(codename, asset))

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

    def test_implied_asset_grant_permissions(self):
        implications = {
            'change_asset': ('view_asset',),
            'add_submissions': ('view_asset',),
            'view_submissions': ('view_asset',),
            'change_submissions': ('view_asset', 'view_submissions'),
        }
        asset = self.admin_asset
        grantee = self.someuser

        # Prevent extra `share_` permissions from being assigned
        asset.editors_can_change_permissions = False

        for explicit, implied in implications.iteritems():
            # Make sure the slate is clean
            self.assertListEqual(list(asset.get_perms(grantee)), [])
            # Assign the explicit permission
            asset.assign_perm(grantee, explicit)
            # Verify that only the expected permissions have been granted
            expected = [explicit]
            expected.extend(implied)
            self.assertListEqual(
                sorted(asset.get_perms(grantee)), sorted(expected))
            # Wipe the slate
            asset.remove_perm(grantee, explicit)
            for i in implied:
                asset.remove_perm(grantee, i)

    def test_remove_implied_asset_permissions(self):
        r"""
            Assign `change_submissions` on an asset to a user, expecting
            `view_asset` and `view_submissions` to be automatically assigned as
            well. Then, remove `view_asset` and expect `view_submissions` and
            `change_submissions` likewise to be removed.
        """
        asset = self.admin_asset
        grantee = self.someuser

        # Prevent extra `share_` permissions from being assigned
        asset.editors_can_change_permissions = False

        expected_lineage = [
            #  (___)
            #  (o o)___________________________________________/
            #   @@ `                                           \
            #    \ __________________________________________, /
            #    //                                          //
            #   ^^                                          ^^
            'view_asset', 'view_submissions', 'change_submissions']
        self.assertListEqual(list(asset.get_perms(grantee)), [])
        # Assigning the tail should bring the head and body along
        asset.assign_perm(grantee, expected_lineage[-1])
        self.assertListEqual(
            sorted(asset.get_perms(grantee)), sorted(expected_lineage))
        # Removing the head should remove the body and tail as well
        asset.remove_perm(grantee, expected_lineage[0])
        self.assertListEqual(list(asset.get_perms(grantee)), [])

    def test_implied_asset_deny_permissions(self):
        r"""
            Grant `change_collection` to a user on a collection, expecting the
            same user to receive `view_asset` and `change_asset` on a child
            asset of that collection. Then, revoke `view_asset` on the child
            from the user and verify that deny records are created for all
            assignable permissions on that asset.
        """
        asset = self.admin_asset
        collection = self.admin_collection
        grantee = self.someuser

        # Prevent extra `share_` permissions from being assigned
        asset.editors_can_change_permissions = False

        collection.assets.add(asset)
        self.assertListEqual(list(collection.get_perms(grantee)), [])
        self.assertListEqual(list(asset.get_perms(grantee)), [])

        # Granting `change_collection` should grant `change_asset` and
        # `view_asset` on the child asset
        collection.assign_perm(grantee, 'change_collection')
        self.assertListEqual(
            sorted(asset.get_perms(grantee)), ['change_asset','view_asset'])

        # Removing `view_asset` should deny all child permissions
        asset.remove_perm(grantee, 'view_asset')
        self.assertListEqual(list(asset.get_perms(grantee)), [])

        # Check that there actually deny permissions
        self.assertListEqual(
            sorted(asset.permissions.filter(
                user=grantee, deny=True).values_list(
                    'permission__codename', flat=True)
            ), [
                'add_submissions',
                'change_asset',
                'change_submissions',
                'view_asset',
                'view_submissions'
            ]
        )

    def test_contradict_implied_asset_deny_permissions(self):
        r"""
            When all assignable permissions are denied, verify that granting
            `change_submissions` also grants `view_submissions` and
            `view_asset`. Make sure that other deny records are left intact.
        """
        asset = self.admin_asset
        collection = self.admin_collection
        grantee = self.someuser

        self.test_implied_asset_deny_permissions()
        self.assertListEqual(
            sorted(asset.permissions.filter(
                user=grantee, deny=True).values_list(
                    'permission__codename', flat=True)
            ), [
                'add_submissions',
                'change_asset',
                'change_submissions',
                'view_asset',
                'view_submissions'
            ]
        )

        # Assign `change_submissions`, which contradicts denial of
        # `view_asset`, `change_asset`, and `view_submissions`
        asset.assign_perm(grantee, 'change_submissions')

        resulting_perms = list(
            asset.permissions.filter(user=grantee).values_list(
            'permission__codename', 'deny').order_by('permission__codename')
        )
        expected_perms = [
            # codename, deny
            ('add_submissions', True),
            ('change_asset', True),
            ('change_submissions', False),
            ('view_asset', False),
            ('view_submissions', False)
        ]
        self.assertListEqual(resulting_perms, expected_perms)

    def test_implied_collection_permissions(self):
        grantee = self.someuser
        collection = self.admin_collection

        # Prevent extra `share_` permissions from being assigned
        collection.editors_can_change_permissions = False

        self.assertListEqual(list(collection.get_perms(grantee)), [])
        collection.assign_perm(grantee, 'change_collection')
        self.assertListEqual(
            sorted(collection.get_perms(grantee)), [
                'change_collection',
                'view_collection'
            ]
        )
        # Now deny view and make sure change is revoked as well
        collection.assign_perm(grantee, 'view_collection', deny=True)
        self.assertListEqual(list(collection.get_perms(grantee)), [])

    def test_calculated_owner_permissions(self):
        asset = self.admin_asset
        collection = self.admin_collection
        self.assertListEqual(
            sorted(asset.get_perms(asset.owner)), self.asset_owner_permissions)
        self.assertListEqual(
            sorted(collection.get_perms(collection.owner)),
            self.collection_owner_permissions
        )

    def test_owner_permissions_individually(self):
        asset = Asset.objects.create(owner=self.someuser)
        collection = Collection.objects.create(owner=self.someuser)
        failure_message = 'Owner missing {}'
        for p in self.asset_owner_permissions:
            self.assertTrue(
                asset.owner.has_perm(p, asset), msg=failure_message.format(p))
            self.assertTrue(
                asset.has_perm(asset.owner, p), msg=failure_message.format(p))
        for p in self.collection_owner_permissions:
            self.assertTrue(
                collection.owner.has_perm(p, collection),
                msg=failure_message.format(p))
            self.assertTrue(
                collection.has_perm(collection.owner, p),
                msg=failure_message.format(p))

    def test_calculated_editor_permissions(self):
        grantee = self.someuser
        asset = self.admin_asset
        collection = self.admin_collection
        asset_editor_permissions = [
            'change_asset',
            'share_asset',
            'view_asset'
        ]
        collection_editor_permissions = [
            'change_collection',
            'share_collection',
            'view_collection'
        ]
        asset.assign_perm(grantee, 'change_asset')
        self.assertListEqual(
            sorted(asset.get_perms(grantee)), asset_editor_permissions)
        collection.assign_perm(grantee, 'change_collection')
        self.assertListEqual(
            sorted(collection.get_perms(grantee)),
            collection_editor_permissions
        )

    def test_calculated_submission_editor_permissions(self):
        grantee = self.someuser
        asset = self.admin_asset
        submission_editor_permissions = [
            'change_submissions',
            'share_submissions',
            'view_asset',
            'view_submissions',
        ]
        asset.assign_perm(grantee, 'change_submissions')
        self.assertListEqual(
            sorted(asset.get_perms(grantee)), submission_editor_permissions)

    def test_get_objects_for_user(self):
        admin_assets= get_all_objects_for_user(self.admin, Asset)
        admin_collections= get_all_objects_for_user(self.admin, Collection)
        someuser_assets= get_all_objects_for_user(self.someuser, Asset)
        someuser_collections= get_all_objects_for_user(self.someuser, Collection)
        self.assertIn(self.admin_asset, admin_assets)
        self.assertIn(self.admin_collection, admin_collections)
        self.assertNotIn(self.admin_asset, someuser_assets)
        self.assertNotIn(self.admin_collection, someuser_collections)
