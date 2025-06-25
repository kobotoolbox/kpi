from unittest.mock import patch

import pytest
import tablib
from django.test import TestCase
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.admin.organization_user import OrgUserResource
from kobo.apps.organizations.models import OrganizationOwner, OrganizationUser
from kpi.tests.utils.transaction import immediate_on_commit


class TestOrganizationUserImportTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        mmo_admin = User.objects.create_user(username='mmo_admin')
        self.mmo_admin = mmo_admin
        self.mmo_admin_organization_user = OrganizationUser.objects.get(
            user=self.mmo_admin
        )
        self.mmo_admin_organization_owner = OrganizationOwner.objects.get(
            organization_user=self.mmo_admin_organization_user
        )
        mmo = mmo_admin.organization
        mmo.mmo_override = True
        mmo.save()
        self.mmo = mmo
        assert self.mmo.is_mmo
        self.dataset_headers = [
            'id',
            'created',
            'modified',
            'is_admin',
            'user',
            'organization',
            'organization_id',
        ]
        self.org_user = OrganizationUser.objects.get(user__username='someuser')

    def _import_organization_user(self, org_user, org, org_id=None, org_name=None):
        resource = OrgUserResource()
        dataset = tablib.Dataset(headers=self.dataset_headers)
        dataset.append(
            (
                org_user.pk,
                timezone.now(),
                timezone.now(),
                False,
                org_user.user.username,
                org_name or org.name,
                org_id or org.id,
            )
        )
        # this is how the admin importer calls import_data after the preview
        # is confirmed
        return resource.import_data(
            dataset, dry_run=False, retain_instance_in_row_result=True
        )

    def test_add_user_to_mmo(self):
        # org_user should have a corresponding owner object
        assert self.org_user.organizationowner
        with immediate_on_commit():
            results = self._import_organization_user(self.org_user, self.mmo)

        assert not results.has_errors()
        assert self.org_user.user.organization == self.mmo
        self.org_user.refresh_from_db()
        # org_user should no longer have an owner object
        with pytest.raises(
            OrganizationUser.organizationowner.RelatedObjectDoesNotExist
        ):
            self.org_user.organizationowner

    def test_cannot_move_user_between_mmos(self):
        user_org = self.org_user.user.organization
        user_org.mmo_override = True
        user_org.save()
        assert user_org.is_mmo
        results = self._import_organization_user(self.org_user, self.mmo)

        assert results.has_errors()
        error = results.error_rows[0].errors[0].error
        assert isinstance(error, ValueError)
        assert str(error) == 'User someuser is already a member of an mmo'

    def test_cannot_move_user_to_non_mmo(self):
        anotheruser = User.objects.get(username='anotheruser')
        another_organization = anotheruser.organization
        results = self._import_organization_user(self.org_user, another_organization)

        assert results.has_errors()
        error = results.error_rows[0].errors[0].error
        assert isinstance(error, ValueError)
        assert (
            str(error)
            == f'Organization {another_organization.name} is not multi-member'
        )

    def test_cannot_move_user_to_nonexistent_org(self):
        results = self._import_organization_user(
            self.org_user, None, org_name='Non-existent', org_id=123
        )
        assert results.has_errors()
        error = results.error_rows[0].errors[0].error
        assert isinstance(error, ValueError)
        assert str(error) == 'Organization Non-existent does not exist'

    @patch(
        'kobo.apps.organizations.admin.organization_user.transfer_member_data_ownership_to_org.delay'  # noqa: E501
    )
    def test_assets_are_transferred(self, mock_task):
        with immediate_on_commit():
            results = self._import_organization_user(self.org_user, self.mmo)

        assert not results.has_errors()
        mock_task.assert_called_with(self.org_user.user.id)
