from unittest.mock import patch

from django.test import TestCase

from kobo.apps.data_collectors.models import DataCollector, DataCollectorGroup
from kobo.apps.kobo_auth.shortcuts import User
from kpi.models import Asset


class TestDataCollector(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        someuser = User.objects.get(username='someuser')
        asset = Asset.objects.filter(owner=someuser).first()
        self.data_collector_group = DataCollectorGroup.objects.create(
            name='DCG', owner=someuser
        )
        self.data_collector_group.assets.add(asset)

    def test_token_created_on_save(self):
        data_collector = DataCollector.objects.create(
            name='DC0', group=self.data_collector_group
        )
        assert data_collector.token is not None

    @patch('kobo.apps.data_collectors.signals.rename_data_collector_enketo_links')
    def test_rotate_token(self, _):
        data_collector_0 = DataCollector.objects.create(
            name='DC0', group=self.data_collector_group
        )
        initial_token = data_collector_0.token
        data_collector_0.rotate_token()
        assert not data_collector_0.token == initial_token

    # plumbing tests, actual utils tested elsewhere
    @patch('kobo.apps.data_collectors.signals.rename_data_collector_enketo_links')
    def test_rotate_token_updates_enketo_links(self, patched_rename):
        data_collector_0 = DataCollector.objects.create(
            name='DC0', group=self.data_collector_group
        )
        initial_token = data_collector_0.token
        data_collector_0.rotate_token()
        new_token = data_collector_0.token
        patched_rename.assert_called_once_with(initial_token, new_token)

    @patch('kobo.apps.data_collectors.signals.remove_data_collector_enketo_links')
    def test_remove_group_removes_enketo_links(self, patched_remove):
        data_collector_0 = DataCollector.objects.create(
            name='DC0', group=self.data_collector_group
        )
        data_collector_0.group = None
        data_collector_0.save()
        token = data_collector_0.token
        patched_remove.assert_called_once_with(token)

    @patch('kobo.apps.data_collectors.signals.remove_data_collector_enketo_links')
    @patch('kobo.apps.data_collectors.signals.set_data_collector_enketo_links')
    def test_change_group_removes_old_enketo_links_and_adds_new_ones(
        self, patched_set, patched_remove
    ):
        someuser = User.objects.get(username='someuser')
        asset = Asset.objects.filter(owner=someuser).last()
        data_collector_0 = DataCollector.objects.create(
            name='DC0', group=self.data_collector_group
        )
        another_group = DataCollectorGroup.objects.create(
            name='DCG1', owner=User.objects.get(username='someuser')
        )
        another_group.assets.add(asset)
        patched_set.reset_mock()

        data_collector_0.group = another_group
        data_collector_0.save()
        patched_remove.assert_called_once_with(data_collector_0.token)
        patched_set.assert_called_once_with([data_collector_0.token], [asset.uid])

    @patch('kobo.apps.data_collectors.signals.remove_data_collector_enketo_links')
    @patch('kobo.apps.data_collectors.signals.set_data_collector_enketo_links')
    def test_change_group_and_token_removes_and_sets_correct_links(
        self, patched_set, patched_remove
    ):
        someuser = User.objects.get(username='someuser')
        asset = Asset.objects.filter(owner=someuser).last()
        data_collector_0 = DataCollector.objects.create(
            name='DC0', group=self.data_collector_group
        )
        another_group = DataCollectorGroup.objects.create(
            name='DCG1', owner=User.objects.get(username='someuser')
        )
        another_group.assets.add(asset)
        patched_set.reset_mock()

        old_token = data_collector_0.token
        data_collector_0.group = another_group
        data_collector_0.token = 'new_token'
        data_collector_0.save()
        patched_remove.assert_called_once_with(old_token)
        patched_set.assert_called_once_with(['new_token'], [asset.uid])
