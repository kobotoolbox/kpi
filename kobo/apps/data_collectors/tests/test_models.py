from unittest.mock import patch

from django.urls import reverse

from kobo.apps.data_collectors.models import DataCollector, DataCollectorGroup
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import PERM_MANAGE_ASSET
from kpi.deployment_backends.mock_backend import MockDeploymentBackend
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase


class TestDataCollector(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        someuser = User.objects.get(username='someuser')
        self.asset = Asset.objects.filter(owner=someuser).first()
        self.data_collector_group = DataCollectorGroup.objects.create(
            name='DCG', owner=someuser
        )
        self.data_collector_group.assets.add(self.asset)
        with patch('kobo.apps.data_collectors.signals.set_data_collector_enketo_links'):
            self.data_collector = DataCollector.objects.create(
                name='DC0', group=self.data_collector_group
            )

    def test_token_created_on_save(self):
        data_collector = DataCollector.objects.create(name='DC')
        assert data_collector.token is not None

    @patch('kobo.apps.data_collectors.signals.rename_data_collector_enketo_links')
    def test_rotate_token(self, _):
        initial_token = self.data_collector.token
        self.data_collector.rotate_token()
        assert not self.data_collector.token == initial_token

    # plumbing tests, actual utils tested elsewhere
    def test_create_data_collector_with_group_creates_links(self):
        self.asset.save()
        self.asset.deploy(backend='mock')
        with patch(
            'kobo.apps.data_collectors.signals.set_data_collector_enketo_links'
        ) as patched_set:
            dc = DataCollector.objects.create(
                name='DC2', group=self.data_collector_group
            )
        patched_set.assert_called_once_with(
            dc.token, [self.asset.deployment.xform.id_string]
        )

    @patch('kobo.apps.data_collectors.signals.rename_data_collector_enketo_links')
    def test_rotate_token_updates_enketo_links(self, patched_rename):
        xform_id_string = self._deploy(self.asset)
        initial_token = self.data_collector.token
        self.data_collector.rotate_token()
        new_token = self.data_collector.token
        patched_rename.assert_called_once_with(
            initial_token, new_token, [xform_id_string]
        )

    @patch('kobo.apps.data_collectors.signals.remove_data_collector_enketo_links')
    def test_remove_group_removes_enketo_links(self, patched_remove):
        xform_id_string = self._deploy(self.asset)
        self.data_collector.group = None
        self.data_collector.save()
        token = self.data_collector.token
        patched_remove.assert_called_once_with(token, [xform_id_string])

    @patch('kobo.apps.data_collectors.signals.remove_data_collector_enketo_links')
    @patch('kobo.apps.data_collectors.signals.set_data_collector_enketo_links')
    def test_change_group_removes_old_enketo_links_and_adds_new_ones(
        self, patched_set, patched_remove
    ):
        old_xform_id_string = self._deploy(self.asset)
        someuser = User.objects.get(username='someuser')
        asset = Asset.objects.filter(owner=someuser).last()
        asset.save()
        asset.deploy(backend='mock')
        another_group = DataCollectorGroup.objects.create(
            name='DCG1', owner=User.objects.get(username='someuser')
        )
        another_group.assets.add(asset)

        self.data_collector.group = another_group
        self.data_collector.save()
        patched_remove.assert_called_once_with(
            self.data_collector.token, [old_xform_id_string]
        )
        patched_set.assert_called_once_with(
            self.data_collector.token, [asset.deployment.xform.id_string]
        )

    @patch('kobo.apps.data_collectors.signals.remove_data_collector_enketo_links')
    @patch('kobo.apps.data_collectors.signals.set_data_collector_enketo_links')
    def test_change_group_and_token_removes_and_sets_correct_links(
        self, patched_set, patched_remove
    ):
        old_xform_id_string = self._deploy(self.asset)
        someuser = User.objects.get(username='someuser')
        asset = Asset.objects.filter(owner=someuser).last()
        asset.save()
        asset.deploy(backend='mock')
        another_group = DataCollectorGroup.objects.create(
            name='DCG1', owner=User.objects.get(username='someuser')
        )
        another_group.assets.add(asset)

        old_token = self.data_collector.token
        self.data_collector.group = another_group
        self.data_collector.token = 'new_token'
        self.data_collector.save()
        patched_remove.assert_called_once_with(old_token, [old_xform_id_string])
        patched_set.assert_called_once_with(
            'new_token', [asset.deployment.xform.id_string]
        )

    def test_remove_owner_permission_removes_assets(self):
        self.data_collector_group.assets.clear()
        someuser = User.objects.get(username='someuser')
        anotheruser = User.objects.get(username='anotheruser')
        asset = Asset.objects.filter(owner=someuser).first()

        # Give anotheruser manage_asset permission so they can assign the asset
        # to a DCG
        asset.assign_perm(anotheruser, PERM_MANAGE_ASSET)
        another_group = DataCollectorGroup.objects.create(
            name='DCG_2', owner=anotheruser
        )
        asset.data_collector_group = another_group
        asset.save()
        asset.deploy(backend='mock')
        with patch('kobo.apps.data_collectors.signals.set_data_collector_enketo_links'):
            data_collector = DataCollector.objects.create(
                name='DC', group=another_group
            )
        with patch.object(
            asset.deployment, 'remove_enketo_links_for_single_data_collector'
        ) as patched_remove_links:
            asset.remove_perm(anotheruser, PERM_MANAGE_ASSET)
        assert asset.data_collector_group is None
        patched_remove_links.assert_called_once_with(data_collector.token)

    def test_bulk_remove_owner_permissions_removes_assets(self):
        self.data_collector_group.assets.clear()
        someuser = User.objects.get(username='someuser')
        anotheruser = User.objects.get(username='anotheruser')
        asset = Asset.objects.filter(owner=someuser).first()

        # Give anotheruser manage_asset permission so they can assign the asset
        # to a DCG
        asset.assign_perm(anotheruser, PERM_MANAGE_ASSET)
        another_group = DataCollectorGroup.objects.create(
            name='DCG_2', owner=anotheruser
        )
        asset.data_collector_group = another_group
        asset.save()
        asset.deploy(backend='mock')
        with patch('kobo.apps.data_collectors.signals.set_data_collector_enketo_links'):
            data_collector = DataCollector.objects.create(
                name='DC', group=another_group
            )
        self.client.force_login(user=someuser)
        with patch.object(
            MockDeploymentBackend, 'remove_enketo_links_for_single_data_collector'
        ) as patched_remove_links:
            url = reverse(
                'api_v2:asset-permission-assignment-bulk-actions',
                kwargs={'uid_asset': asset.uid},
            )
            self.client.delete(url, data={'username': 'anotheruser'})
        asset.refresh_from_db()
        assert asset.data_collector_group is None
        patched_remove_links.assert_called_once_with(data_collector.token)

    @patch('kobo.apps.data_collectors.signals.remove_data_collector_enketo_links')
    def test_delete_data_collector_group_removes_enketo_links(self, patched_remove):
        xform_id_string = self._deploy(self.asset)
        self.data_collector_group.delete()
        patched_remove.assert_called_once_with(
            self.data_collector.token, [xform_id_string]
        )

    @patch('kobo.apps.data_collectors.signals.set_data_collector_enketo_links')
    def test_change_group_does_not_produce_new_version(self, *_):
        someuser = User.objects.get(username='someuser')
        asset = Asset.objects.filter(owner=someuser).last()
        initial_version_count = asset.asset_versions.count()
        group = DataCollectorGroup.objects.create(
            name='DCG1', owner=User.objects.get(username='someuser')
        )
        group.assets.add(asset)
        asset.refresh_from_db()
        assert asset.asset_versions.count() == initial_version_count

    def _deploy(self, asset):
        asset.save()
        asset.deploy(backend='mock')
        return asset.deployment.xform.id_string
