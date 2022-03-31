# coding: utf-8
import unittest
from django.contrib.auth.models import User, AnonymousUser
from django.test import TestCase

from kpi.constants import (
    ASSET_TYPE_COLLECTION,
    ASSET_TYPE_SURVEY,
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_ASSET,
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_ASSET,
    PERM_DELETE_SUBMISSIONS,
    PERM_DISCOVER_ASSET,
    PERM_MANAGE_ASSET,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.exceptions import BadPermissionsException
from kpi.utils.object_permission import get_all_objects_for_user
from ..models.asset import Asset


class BasePermissionsTestCase(TestCase):

    def _get_perm_name(self, perm_name_prefix, model_instance):
        """
        Get the type-specific permission name for a model from a permission name
        prefix and a model instance.

        Example:
            >>>self._get_perm_name('view_', my_asset)
            PERM_VIEW_ASSET

        :param perm_name_prefix: Prefix of the desired permission name (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param model_instance: An instance of the model for which the permission
            name is desired.
        :type model_instance: :py:class:`Asset`
        :return: The computed permission name.
        :rtype: str
        """
        if not perm_name_prefix[-1] == '_':
            perm_name_prefix += '_'
        perm_name = perm_name_prefix + model_instance._meta.model_name
        return perm_name

    def _test_add_perm(self, obj, perm_name_prefix, user):
        """
        Test that a permission can be added and that the permission successfully
        takes effect.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Asset`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param user: The user for whom permissions on `obj` will be manipulated.
        :type user: :py:class:`User`
        """
        perm_name = self._get_perm_name(perm_name_prefix, obj)
        self.assertFalse(user.has_perm(perm_name, obj))
        obj.assign_perm(user, perm_name)
        self.assertTrue(user.has_perm(perm_name, obj))

    def _test_remove_perm(self, obj, perm_name_prefix, user):
        """
        Test that a permission can be removed and that the removal successfully
        takes effect.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Asset`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param user: The user for whom permissions on `obj` will be manipulated.
        :type user: :py:class:`User`
        """
        perm_name = self._get_perm_name(perm_name_prefix, obj)
        self.assertTrue(user.has_perm(perm_name, obj))
        obj.remove_perm(user, perm_name)
        self.assertFalse(user.has_perm(perm_name, obj))

    def _test_add_inherited_perm(self, ancestor_collection, perm_name_prefix,
                                 user, descendant_obj):
        """
        Test that a permission can be added to a collection and that the
        permission successfully propagates to a descendant.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Asset`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param user: The user for whom permissions on `obj` will be manipulated.
        :type user: :py:class:`User`
        :param descendant_obj: The descendant object to check for the
            changed permission (i.e. an asset contained in
            `ancestor_collection`).
        :type descendant_obj: :py:class:`Asset`
        """
        descendant_perm_name= self._get_perm_name(perm_name_prefix, descendant_obj)
        self.assertFalse(user.has_perm(descendant_perm_name, descendant_obj))
        self._test_add_perm(ancestor_collection, perm_name_prefix, user)
        self.assertTrue(user.has_perm(descendant_perm_name, descendant_obj))

    def _test_add_and_remove_perm(self, obj, perm_name_prefix, user):
        """
        Test that a permission can be removed after being added and that the
        removal successfully takes effect.

        :param obj: Object to manipulate permissions on.
        :type obj: :py:class:`Asset`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param user: The user for whom permissions on `obj` will be manipulated.
        :type user: :py:class:`User`
        """
        self._test_add_perm(obj, perm_name_prefix, user)
        remove_perm_name = self._get_perm_name(perm_name_prefix, obj)
        obj.remove_perm(user, remove_perm_name)
        self.assertFalse(user.has_perm(remove_perm_name, obj))

    def _test_add_remove_inherited_perm(self, ancestor_asset,
                                        perm_name_prefix, user, descendant_obj):
        """
        Test that a permission can be added and removed, and that the removal
        successfully takes effect.

        :param ancestor_asset: Object to manipulate permissions on.
        :type ancestor_asset: :py:class:`Asset`
        :param perm_name_prefix: The prefix of the permission to be used (i.e.
            "view_", "change_", or "delete_").
        :type perm_name_prefix: str
        :param user: The user for whom permissions on `ancestor_asset` will
            be manipulated.
        :type user: :py:class:`User`
        :param descendant_obj: The descendant object to check for the
            changed permission (i.e. an asset contained in
            `ancestor_asset`).
        :type descendant_obj: :py:class:`Asset`
        """
        self._test_add_inherited_perm(ancestor_asset,
                                      perm_name_prefix, user,
                                      descendant_obj)
        descendant_perm_name = self._get_perm_name(
            perm_name_prefix, descendant_obj
        )
        ancestor_perm_name = self._get_perm_name(
            perm_name_prefix, ancestor_asset
        )
        ancestor_asset.remove_perm(user, ancestor_perm_name)
        self.assertFalse(user.has_perm(descendant_perm_name, descendant_obj))


class PermissionsTestCase(BasePermissionsTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.admin = User.objects.get(username='admin')
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')

        self.admin_collection = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, owner=self.admin
        )
        self.admin_asset = Asset.objects.create(content={'survey': [
            {'type': 'text', 'label': 'Question 1', 'name': 'q1', 'kuid': 'abc'},
            {'type': 'text', 'label': 'Question 2', 'name': 'q2', 'kuid': 'def'},
        ]}, owner=self.admin)
        self.asset_owner_permissions = [
            PERM_ADD_SUBMISSIONS,
            PERM_CHANGE_ASSET,
            PERM_CHANGE_SUBMISSIONS,
            PERM_DELETE_ASSET,
            PERM_DELETE_SUBMISSIONS,
            PERM_MANAGE_ASSET,
            PERM_VALIDATE_SUBMISSIONS,
            PERM_VIEW_ASSET,
            PERM_VIEW_SUBMISSIONS,
        ]
        self.collection_owner_permissions = [
            PERM_CHANGE_ASSET,
            PERM_DELETE_ASSET,
            PERM_DISCOVER_ASSET,
            PERM_MANAGE_ASSET,
            PERM_VIEW_ASSET,
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
            PERM_ADD_SUBMISSIONS,
            PERM_VIEW_SUBMISSIONS,
            PERM_VALIDATE_SUBMISSIONS,
            PERM_CHANGE_SUBMISSIONS  # Must be last since it implies `view_submissions`
        )
        asset = self.admin_asset
        grantee = self.someuser
        for codename in codenames:
            self.assertFalse(grantee.has_perm(codename, asset))
            asset.assign_perm(grantee, codename)
            self.assertTrue(grantee.has_perm(codename, asset))

    def test_remove_submission_permission(self):
        codenames = (
            PERM_ADD_SUBMISSIONS,
            PERM_VIEW_SUBMISSIONS,
            PERM_VALIDATE_SUBMISSIONS,
            PERM_CHANGE_SUBMISSIONS  # Must be last since it implies `view_submissions`
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
        self.admin_collection.children.add(self.admin_asset)
        self._test_add_inherited_perm(self.admin_collection, 'view_',
                                      self.someuser, self.admin_asset)
        self._test_add_inherited_perm(self.admin_collection, 'change_',
                                      self.someuser, self.admin_asset)

    def test_remove_collection_inherited_permission(self):
        self.admin_collection.children.add(self.admin_asset)
        self._test_add_remove_inherited_perm(self.admin_collection, 'view_',
                                             self.someuser, self.admin_asset)
        self._test_add_remove_inherited_perm(self.admin_collection, 'change_',
                                             self.someuser, self.admin_asset)

    def test_implied_asset_grant_permissions(self):
        implications = {
            PERM_CHANGE_ASSET: (PERM_VIEW_ASSET,),
            PERM_ADD_SUBMISSIONS: (PERM_VIEW_ASSET,),
            PERM_VIEW_SUBMISSIONS: (PERM_VIEW_ASSET,),
            PERM_CHANGE_SUBMISSIONS: (
                PERM_VIEW_ASSET,
                PERM_VIEW_SUBMISSIONS,
                PERM_ADD_SUBMISSIONS,
            ),
            PERM_VALIDATE_SUBMISSIONS: (PERM_VIEW_ASSET, PERM_VIEW_SUBMISSIONS),
        }
        asset = self.admin_asset
        grantee = self.someuser

        for explicit, implied in implications.items():
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
        """
            Assign `change_submissions` on an asset to a user, expecting
            `view_asset` and `view_submissions` to be automatically assigned as
            well. Then, remove `view_asset` and expect `view_submissions` and
            `change_submissions` likewise to be removed.
        """
        asset = self.admin_asset
        grantee = self.someuser
        self.assertListEqual(list(asset.get_perms(grantee)), [])

        asset.assign_perm(grantee, PERM_CHANGE_SUBMISSIONS)
        expected_perms = [
            PERM_VIEW_ASSET,
            PERM_VIEW_SUBMISSIONS,
            PERM_CHANGE_SUBMISSIONS,
            PERM_ADD_SUBMISSIONS,
        ]
        self.assertListEqual(
            sorted(asset.get_perms(grantee)), sorted(expected_perms)
        )
        asset.remove_perm(grantee, PERM_VIEW_ASSET)
        self.assertListEqual(list(asset.get_perms(grantee)), [])

        asset.assign_perm(grantee, PERM_VALIDATE_SUBMISSIONS)
        expected_perms = [
            PERM_VIEW_ASSET,
            PERM_VIEW_SUBMISSIONS,
            PERM_VALIDATE_SUBMISSIONS,
        ]
        self.assertListEqual(
            sorted(asset.get_perms(grantee)), sorted(expected_perms)
        )
        asset.remove_perm(grantee, PERM_VIEW_ASSET)
        self.assertListEqual(list(asset.get_perms(grantee)), [])

    def test_implied_asset_deny_permissions(self):
        """
            Grant `change_asset` to a user on a collection, expecting the
            same user to receive `view_asset` and `change_asset` on a child
            asset of that collection. Then, revoke `view_asset` on the child
            from the user and verify that deny records are created for all
            assignable permissions on that asset.
        """
        asset = self.admin_asset
        collection = self.admin_collection
        grantee = self.someuser

        collection.children.add(asset)
        self.assertListEqual(list(collection.get_perms(grantee)), [])
        self.assertListEqual(list(asset.get_perms(grantee)), [])

        # Granting `change_asset` should grant `change_asset` and
        # `view_asset` on the child asset
        collection.assign_perm(grantee, PERM_CHANGE_ASSET)
        self.assertListEqual(
            sorted(asset.get_perms(grantee)), [PERM_CHANGE_ASSET, PERM_VIEW_ASSET])

        # Removing `view_asset` should deny all child permissions
        asset.remove_perm(grantee, PERM_VIEW_ASSET)
        self.assertListEqual(list(asset.get_perms(grantee)), [])

        # Check that there actually deny permissions
        self.assertListEqual(
            sorted(asset.permissions.filter(
                user=grantee, deny=True).values_list(
                    'permission__codename', flat=True)
            ), [
                PERM_ADD_SUBMISSIONS,
                PERM_CHANGE_ASSET,
                PERM_CHANGE_SUBMISSIONS,
                PERM_DELETE_SUBMISSIONS,
                PERM_MANAGE_ASSET,
                PERM_PARTIAL_SUBMISSIONS,
                PERM_VALIDATE_SUBMISSIONS,
                PERM_VIEW_ASSET,
                PERM_VIEW_SUBMISSIONS,
            ]
        )

    def test_contradict_implied_asset_deny_permissions(self):
        """
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
                PERM_ADD_SUBMISSIONS,
                PERM_CHANGE_ASSET,
                PERM_CHANGE_SUBMISSIONS,
                PERM_DELETE_SUBMISSIONS,
                PERM_MANAGE_ASSET,
                PERM_PARTIAL_SUBMISSIONS,
                PERM_VALIDATE_SUBMISSIONS,
                PERM_VIEW_ASSET,
                PERM_VIEW_SUBMISSIONS
            ]
        )

        # Assign `change_submissions`, which contradicts denial of
        # `view_asset`, `change_asset`, and `view_submissions`
        asset.assign_perm(grantee, PERM_CHANGE_SUBMISSIONS)

        resulting_perms = list(
            asset.permissions.filter(user=grantee).values_list(
            'permission__codename', 'deny').order_by('permission__codename')
        )
        expected_perms = [
            # codename, deny
            (PERM_ADD_SUBMISSIONS, False),
            (PERM_CHANGE_ASSET, True),
            (PERM_CHANGE_SUBMISSIONS, False),
            (PERM_DELETE_SUBMISSIONS, True),
            (PERM_MANAGE_ASSET, True),
            (PERM_VALIDATE_SUBMISSIONS, True),
            (PERM_VIEW_ASSET, False),
            (PERM_VIEW_SUBMISSIONS, False)
        ]
        self.assertListEqual(resulting_perms, expected_perms)

    def test_implied_collection_permissions(self):
        grantee = self.someuser
        collection = self.admin_collection

        self.assertListEqual(list(collection.get_perms(grantee)), [])
        collection.assign_perm(grantee, PERM_CHANGE_ASSET)
        self.assertListEqual(
            sorted(collection.get_perms(grantee)), [
                PERM_CHANGE_ASSET,
                PERM_VIEW_ASSET,
            ]
        )
        # Now deny view and make sure change is revoked as well
        collection.assign_perm(grantee, PERM_VIEW_ASSET, deny=True)
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
        asset = Asset.objects.create(
            owner=self.someuser, asset_type=ASSET_TYPE_SURVEY
        )
        collection = Asset.objects.create(
            owner=self.someuser, asset_type=ASSET_TYPE_COLLECTION
        )
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
        editor_permissions = [
            PERM_CHANGE_ASSET,
            PERM_VIEW_ASSET
        ]
        asset.assign_perm(grantee, PERM_CHANGE_ASSET)
        self.assertListEqual(
            sorted(asset.get_perms(grantee)), editor_permissions)
        collection.assign_perm(grantee, PERM_CHANGE_ASSET)
        self.assertListEqual(
            sorted(collection.get_perms(grantee)),
            editor_permissions
        )

    def test_calculated_submission_editor_permissions(self):
        grantee = self.someuser
        asset = self.admin_asset
        submission_editor_permissions = [
            PERM_ADD_SUBMISSIONS,
            PERM_CHANGE_SUBMISSIONS,
            PERM_VIEW_ASSET,
            PERM_VIEW_SUBMISSIONS,
        ]
        asset.assign_perm(grantee, PERM_CHANGE_SUBMISSIONS)
        self.assertListEqual(
            sorted(asset.get_perms(grantee)), submission_editor_permissions)

    def test_get_objects_for_user(self):
        admin_assets = get_all_objects_for_user(self.admin, Asset)
        admin_collections = get_all_objects_for_user(
            self.admin, Asset
        ).filter(asset_type=ASSET_TYPE_COLLECTION)
        someuser_assets = get_all_objects_for_user(self.someuser, Asset)
        someuser_collections = get_all_objects_for_user(
            self.someuser, Asset
        ).filter(asset_type=ASSET_TYPE_COLLECTION)
        self.assertIn(self.admin_asset, admin_assets)
        self.assertIn(self.admin_collection, admin_collections)
        self.assertNotIn(self.admin_asset, someuser_assets)
        self.assertNotIn(self.admin_collection, someuser_collections)

    def test_copy_permissions_between_objects_same_owner(self):

        asset1 = Asset.objects.create(content={'survey': [
            {'type': 'text', 'label': 'Question 3', 'name': 'q3', 'kuid': 'ghi'},
            {'type': 'text', 'label': 'Question 4', 'name': 'q4', 'kuid': 'ijk'},
        ]}, owner=self.admin)

        asset2 = Asset.objects.create(content={'survey': [
            {'type': 'text', 'label': 'Question 5', 'name': 'q5', 'kuid': 'lmn'},
            {'type': 'text', 'label': 'Question 6', 'name': 'q6', 'kuid': 'opq'},
        ]}, owner=self.admin)

        assigned_someuser_perms = [
            PERM_CHANGE_ASSET,
            PERM_VIEW_ASSET
        ]

        # Assign permissions to 1st asset.
        for assigned_someuser_perm in assigned_someuser_perms:
            if (
                assigned_someuser_perm
                in asset1.get_assignable_permissions(with_partial=False)
            ):
                asset1.assign_perm(self.someuser, assigned_someuser_perm)

        # Assign permissions to 2nd asset.
        asset2.assign_perm(self.someuser, PERM_VIEW_ASSET)
        asset2.assign_perm(self.someuser, PERM_VIEW_SUBMISSIONS)
        asset2.assign_perm(self.someuser, PERM_CHANGE_SUBMISSIONS)

        # Copy permissions from 1st to 2nd asset.
        asset2.copy_permissions_from(asset1)

        asset2_perms = asset2.get_users_with_perms(attach_perms=True)
        asset1_perms = asset1.get_users_with_perms(attach_perms=True)
        for user_, perms_ in asset2_perms.items():
            self.assertListEqual(
                sorted(perms_), sorted(asset1_perms[user_]))
        self.assertTrue(len(list(asset1_perms)) == len(list(asset2_perms)))

    def test_copy_permissions_between_objects_different_owner(self):

        another_user_asset = Asset.objects.create(content={'survey': [
            {'type': 'text', 'label': 'Question 3', 'name': 'q3', 'kuid': 'ghi'},
            {'type': 'text', 'label': 'Question 4', 'name': 'q4', 'kuid': 'ijk'},
        ]}, owner=self.anotheruser)

        someuser_asset = Asset.objects.create(content={'survey': [
            {'type': 'text', 'label': 'Question 5', 'name': 'q5', 'kuid': 'lmn'},
            {'type': 'text', 'label': 'Question 6', 'name': 'q6', 'kuid': 'opq'},
        ]}, owner=self.someuser)

        assigned_someuser_perms = [
            PERM_CHANGE_ASSET,
            PERM_VIEW_ASSET
        ]

        # Assign permissions to 1st asset.
        for assigned_someuser_perm in assigned_someuser_perms:
            if (
                assigned_someuser_perm
                in another_user_asset.get_assignable_permissions(
                    with_partial=False
                )
            ):
                another_user_asset.assign_perm(self.someuser, assigned_someuser_perm)

        # Assign permissions to 2nd asset.
        someuser_asset.assign_perm(self.anotheruser, PERM_VIEW_ASSET)
        someuser_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        someuser_asset.assign_perm(self.anotheruser, PERM_CHANGE_SUBMISSIONS)

        # Copy permissions from 1st to 2nd asset.
        someuser_asset.copy_permissions_from(another_user_asset)

        someuser_asset_perms = someuser_asset.get_users_with_perms(attach_perms=True)
        another_user_asset_perms = another_user_asset.get_users_with_perms(attach_perms=True)
        expected_anotheruser_perms = [
            PERM_ADD_SUBMISSIONS,
            PERM_CHANGE_ASSET,
            PERM_CHANGE_SUBMISSIONS,
            PERM_DELETE_SUBMISSIONS,
            PERM_MANAGE_ASSET,
            PERM_VALIDATE_SUBMISSIONS,
            PERM_VIEW_ASSET,
            PERM_VIEW_SUBMISSIONS
        ]

        # Ensure `self.someuser` is still the owner
        self.assertTrue(someuser_asset.owner == self.someuser)

        # Ensure permissions for `self.someuser` have not changed
        self.assertListEqual(
            sorted(someuser_asset_perms[self.someuser]),
            sorted(someuser_asset.get_perms(someuser_asset.owner)))

        # Ensure `self.anotheruser` has all (assignable) permissions
        self.assertListEqual(
            sorted(someuser_asset_perms[self.anotheruser]), expected_anotheruser_perms)

        self.assertTrue(len(list(another_user_asset_perms)) == len(list(someuser_asset_perms)))

    def test_add_partial_submission_permission_to_owner(self):
        """
        Owner can't receive `PERM_PARTIAL_SUBMISSIONS permission.
        """
        asset = self.admin_asset
        grantee = asset.owner
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{
                '_submitted_by': {'$in': [
                    self.someuser.username,
                    self.anotheruser.username
                ]}
            }]
        }
        codename = PERM_PARTIAL_SUBMISSIONS
        self.assertRaises(BadPermissionsException, asset.assign_perm, grantee,
                          codename, partial_perms=partial_perms)

    def test_mandatory_partial_perms_with_partial_submissions_permission(self):
        """
        If partial permissions are omitted when assigning
        `partial_submissions` permission, it should raise an error
        """
        asset = self.admin_asset
        grantee = self.someuser
        codename = PERM_PARTIAL_SUBMISSIONS
        self.assertRaises(BadPermissionsException, asset.assign_perm, grantee,
                          codename)

    def test_add_partial_submission_permission(self):
        asset = self.admin_asset
        grantee = self.someuser
        codename = PERM_PARTIAL_SUBMISSIONS
        self.assertFalse(grantee.has_perm(codename, asset))
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{
                '_submitted_by': self.anotheruser.username
            }]
        }
        # Asset doesn't have any relations with the Many-To-Many table
        self.assertTrue(asset.asset_partial_permissions.count() == 0)
        asset.assign_perm(grantee, codename, partial_perms=partial_perms)
        self.assertTrue(grantee.has_perm(codename, asset))
        self.assertTrue(asset.get_partial_perms(grantee.id, with_filters=True),
                        partial_perms)
        # Asset should have 1 relation with the Many-To-Many table
        self.assertTrue(asset.asset_partial_permissions.count() == 1)

    def test_update_partial_submission_permission(self):
        asset = self.admin_asset
        grantee = self.someuser
        self.test_add_partial_submission_permission()
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{
                '_submitted_by': {'$in': [
                    self.someuser.username,
                    self.anotheruser.username
                ]}
            }]
        }
        asset.assign_perm(grantee, PERM_PARTIAL_SUBMISSIONS,
                          partial_perms=partial_perms)
        self.assertEqual(asset.get_partial_perms(grantee.id, with_filters=True),
                         partial_perms)

    def test_add_contradict_partial_submission_permission(self):
        """
        `partial_submissions` is mutually exclusive with other submissions
        permissions.
        When `partial_submissions` is assigned to a user, this user should
        lose any other submissions permissions that were previously assigned.
        Likewise, if a user already has `partial_submissions` and is then
        assigned another submissions permission (e.g. `view_submissions`),
        then `partial_submissions` should be removed.
        """
        asset = self.admin_asset
        grantee = self.someuser
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{
                '_submitted_by': self.anotheruser.username
            }]
        }
        # User should not have any permissions on the asset.
        self.assertFalse(grantee.has_perm(PERM_VIEW_SUBMISSIONS, asset))
        self.assertFalse(grantee.has_perm(PERM_PARTIAL_SUBMISSIONS, asset))

        # Assign `view_submissions` to the user and make sure they do not
        # receive anything else.
        asset.assign_perm(grantee, PERM_VIEW_SUBMISSIONS)
        self.assertTrue(grantee.has_perm(PERM_VIEW_SUBMISSIONS, asset))
        self.assertFalse(grantee.has_perm(PERM_PARTIAL_SUBMISSIONS, asset))

        # Assign `partial_submissions` and make sure that `view_submissions`
        # has been revoked.
        asset.assign_perm(grantee, PERM_PARTIAL_SUBMISSIONS,
                          partial_perms=partial_perms)
        self.assertFalse(grantee.has_perm(PERM_VIEW_SUBMISSIONS, asset))
        self.assertTrue(grantee.has_perm(PERM_PARTIAL_SUBMISSIONS, asset))

    def test_remove_partial_submission_permission(self):
        asset = self.admin_asset
        grantee = self.someuser
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{
                '_submitted_by': self.anotheruser.username
            }]
        }
        # Assign `partial_submissions` permission.
        asset.assign_perm(grantee, PERM_PARTIAL_SUBMISSIONS,
                          partial_perms=partial_perms)
        self.assertTrue(grantee.has_perm(PERM_PARTIAL_SUBMISSIONS, asset))
        self.assertTrue(asset.asset_partial_permissions.count() == 1)

        # Then remove it
        asset.remove_perm(grantee, PERM_PARTIAL_SUBMISSIONS)
        self.assertFalse(grantee.has_perm(PERM_PARTIAL_SUBMISSIONS, asset))
        self.assertTrue(asset.asset_partial_permissions.count() == 0)

    @unittest.skip(reason='Skip until this branch is merged within '
                          '`3115-allowed-write-actions-with-partial-perm`')
    def test_implied_partial_submission_permission(self):
        asset = self.admin_asset
        grantee = self.someuser
        partial_perms = {
            PERM_CHANGE_SUBMISSIONS: [
                {
                    '_submitted_by': {
                        '$in': [
                            self.anotheruser.username,
                            self.someuser.username,
                        ]
                    }
                }
            ]
        }
        expected_partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{
                '_submitted_by': {
                    '$in': [
                        self.anotheruser.username,
                        self.someuser.username,
                    ]
                }
            }],
            PERM_CHANGE_SUBMISSIONS: [{
                '_submitted_by': {
                    '$in': [
                        self.anotheruser.username,
                        self.someuser.username,
                    ]
                }
            }]
        }
        asset.assign_perm(grantee, PERM_PARTIAL_SUBMISSIONS,
                          partial_perms=partial_perms)

        partial_perms = asset.get_partial_perms(grantee.id, with_filters=True)
        self.assertDictEqual(expected_partial_perms, partial_perms)

    def test_merged_implied_partial_submission_permission(self):
        asset = self.admin_asset
        grantee = self.someuser
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [
                {'_submitted_by': {'$in': [self.admin.username]}}
            ],
            PERM_CHANGE_SUBMISSIONS: [
                {'_submitted_by': {'$in': [self.anotheruser.username]}}
            ],
            PERM_DELETE_SUBMISSIONS: [
                {'_submitted_by': {'$in': [self.someuser.username]}}
            ]
        }
        expected_partial_perms = {
            PERM_VIEW_SUBMISSIONS: [
                {
                    '_submitted_by': {
                        '$in': [
                            self.admin.username,
                            self.someuser.username,
                            self.anotheruser.username,
                        ]
                    }
                },
            ],
            PERM_CHANGE_SUBMISSIONS: [
                {'_submitted_by': {'$in': [self.anotheruser.username]}}
            ],
            PERM_DELETE_SUBMISSIONS: [
                {'_submitted_by': {'$in': [self.someuser.username]}}
            ]
        }
        asset.assign_perm(grantee, PERM_PARTIAL_SUBMISSIONS,
                          partial_perms=partial_perms)

        partial_perms = asset.get_partial_perms(grantee.id, with_filters=True)

        for partial_perm, filters in expected_partial_perms.items():
            self.assertEqual(
                sorted(filters[0]['_submitted_by']['$in']),
                sorted(partial_perms[partial_perm][0]['_submitted_by']['$in']),
            )

    def test_implied_partial_submission_permission_with_different_filters(self):
        asset = self.admin_asset
        grantee = self.someuser
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [
                {'_submitted_by': self.someuser.username},
            ],
            PERM_DELETE_SUBMISSIONS: [
                {'_submission_date': {'$lte': '2021-01-01'}},
                {'_submission_date': {'$gte': '2020-01-01'}},
            ]
        }
        expected_partial_perms = {
            PERM_VIEW_SUBMISSIONS: [
                [
                    {'_submission_date': {'$lte': '2021-01-01'}},
                    {'_submission_date': {'$gte': '2020-01-01'}},
                ],
                [
                    {'_submitted_by': self.someuser.username},
                ],
            ],
            PERM_DELETE_SUBMISSIONS: [
                {'_submission_date': {'$lte': '2021-01-01'}},
                {'_submission_date': {'$gte': '2020-01-01'}},
            ]
        }
        asset.assign_perm(grantee, PERM_PARTIAL_SUBMISSIONS,
                          partial_perms=partial_perms)

        partial_perms = asset.get_partial_perms(grantee.id, with_filters=True)

        self.assertDictEqual(expected_partial_perms, partial_perms)

    def test_user_without_perms_get_anonymous_perms(self):

        asset = self.admin_asset
        grantee = self.someuser
        anonymous_user = AnonymousUser()

        self.assertFalse(grantee.has_perm(PERM_VIEW_SUBMISSIONS, asset))
        self.assertFalse(anonymous_user.has_perm(PERM_VIEW_SUBMISSIONS, asset))
        asset.assign_perm(anonymous_user, PERM_VIEW_SUBMISSIONS)
        self.assertTrue(grantee.has_perm(PERM_VIEW_SUBMISSIONS, asset))
        self.assertTrue(list(asset.get_perms(grantee)),
                        list(asset.get_perms(anonymous_user)))
