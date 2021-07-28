# coding: utf-8
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status

from kpi.constants import ASSET_TYPE_COLLECTION
from kpi.models import Asset, ObjectPermission
# importing module instead of the class, avoid running the tests twice
from kpi.tests.api.v2 import test_api_permissions
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.utils.object_permission import get_anonymous_user


class ApiAnonymousPermissionsTestCase(test_api_permissions.ApiAnonymousPermissionsTestCase):
    URL_NAMESPACE = None


class ApiPermissionsPublicAssetTestCase(test_api_permissions.ApiPermissionsPublicAssetTestCase):
    URL_NAMESPACE = None


class ApiPermissionsTestCase(test_api_permissions.ApiPermissionsTestCase):
    URL_NAMESPACE = None


class ApiAssignedPermissionsTestCase(KpiTestCase):
    """
    An obnoxiously large amount of code to test that the endpoint for listing
    assigned permissions complies with the following rules:

        * Superusers see it all (thank goodness for pagination)
        * Anonymous users see nothing
        * Regular users see everything that concerns them, namely all
          their own permissions and all the owners' permissions for all objects
          to which they have been assigned any permission

    See also `kpi.filters.KpiAssignedObjectPermissionsFilter`
    """

    def setUp(self):
        super().setUp()
        self.anon = get_anonymous_user()
        self.super = User.objects.get(username='admin')
        self.super_password = 'pass'
        self.someuser = User.objects.get(username='someuser')
        self.someuser_password = 'someuser'
        self.anotheruser = User.objects.get(username='anotheruser')
        self.anotheruser_password = 'anotheruser'

        def create_object_with_specific_pk(model, pk, **kwargs):
            obj = model()
            obj.pk = pk
            for k, v in kwargs.items():
                setattr(obj, k, v)
            obj.save()
            return obj

        self.collection = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, owner=self.someuser
        )
        self.asset = Asset.objects.create(owner=self.someuser)

    def test_anon_cannot_list_permissions(self):
        self.asset.assign_perm(self.anon, 'view_asset')
        self.assertTrue(self.anon.has_perm('view_asset', self.asset))

        url = reverse('objectpermission-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertListEqual(response.data['results'], [])

        self.asset.remove_perm(self.anon, 'view_asset')
        self.assertFalse(self.anon.has_perm('view_asset', self.asset))

    def test_user_sees_relevant_permissions_on_assigned_objects(self):
        # A user with explicitly-assigned permissions should see their
        # own permissions and the owner's permissions, but not permissions
        # assigned to other users
        self.asset.assign_perm(self.anotheruser, 'view_asset')
        self.assertTrue(self.anotheruser.has_perm('view_asset', self.asset))

        irrelevant_user = User.objects.create(username='mindyourown')
        self.asset.assign_perm(irrelevant_user, 'view_asset')

        self.client.login(username=self.anotheruser.username,
                          password=self.anotheruser_password)

        url = reverse('objectpermission-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returned_uids = [r['uid'] for r in response.data['results']]
        all_obj_perms = self.asset.permissions.all()
        relevant_obj_perms = all_obj_perms.filter(
            user__in=(self.asset.owner, self.anotheruser),
            permission__codename__in=self.asset.ASSIGNABLE_PERMISSIONS_BY_TYPE[
                self.asset.asset_type
            ],
        )

        self.assertListEqual(
            sorted(returned_uids),
            sorted(relevant_obj_perms.values_list('uid', flat=True)),
        )

        self.asset.remove_perm(self.anotheruser, 'view_asset')
        self.assertFalse(self.anotheruser.has_perm('view_asset', self.asset))

    def test_user_cannot_see_permissions_on_unassigned_objects(self):
        self.asset.assign_perm(self.anotheruser, 'view_asset')
        self.assertTrue(self.anotheruser.has_perm('view_asset', self.asset))

        self.client.login(username=self.anotheruser.username,
                          password=self.anotheruser_password)

        url = reverse('objectpermission-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returned_uids = [r['uid'] for r in response.data['results']]
        other_obj_perms = self.collection.permissions.all()

        self.assertFalse(
            set(returned_uids).intersection(
                other_obj_perms.values_list('uid', flat=True)
            )
        )

        self.asset.remove_perm(self.anotheruser, 'view_asset')
        self.assertFalse(self.anotheruser.has_perm('view_asset', self.asset))

    def test_superuser_sees_all_permissions(self):
        self.asset.assign_perm(self.anotheruser, 'view_asset')
        self.assertTrue(self.anotheruser.has_perm('view_asset', self.asset))

        self.client.login(username=self.super.username,
                          password=self.super_password)

        url = reverse('objectpermission-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returned_uids = [r['uid'] for r in response.data['results']]
        self.assertListEqual(
            sorted(returned_uids),
            sorted(ObjectPermission.objects.values_list('uid', flat=True))
        )

        self.asset.remove_perm(self.anotheruser, 'view_asset')
        self.assertFalse(self.anotheruser.has_perm('view_asset', self.asset))
