from django.core.files.base import ContentFile
from django.test import TestCase, override_settings

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.long_running_migrations.models import LongRunningMigration
from kobo.apps.openrosa.apps.main.models import MetaData
from kobo.apps.project_ownership.models import Invite, Transfer
from kpi.models.asset import Asset, AssetFile


@override_settings(
    CACHES={
        'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}
    }
)
class LongRunningMigrationTestCase(TestCase):

    def test_0002_migration(self):
        bob = User.objects.create_user(username='bob', password='bob')
        alice = User.objects.create_user(username='alice', password='alice')
        asset = Asset.objects.create(
            content={
                'survey': [
                    {
                        'type': 'text',
                        'label': 'Question 1',
                        'name': 'q1',
                        '$kuid': 'abc',
                    },
                    {
                        'type': 'text',
                        'label': 'Question 2',
                        'name': 'q2',
                        '$kuid': 'def',
                    },
                ],
                'settings': {},
            },
            owner=bob,
            asset_type='survey',
        )
        AssetFile.objects.create(
            asset=asset, user=bob, content=ContentFile('foo', 'bar.txt')
        )
        asset.deploy(backend='mock')
        # metadata.data_file = 'bob/.../...'
        metadata = MetaData.objects.create(
            xform=asset.deployment.xform,
            data_file=ContentFile('foo', 'bar.txt')
        )

        # fake transfer
        invite = Invite.objects.create(sender=bob, recipient=alice)
        transfer = Transfer.objects.create(invite=invite, asset=asset)
        transfer.transfer_project()
        metadata.refresh_from_db()

        assert not str(metadata.data_file).startswith(metadata.xform.user.username)
        migration = LongRunningMigration.objects.get(name='0002_fix_project_ownership_transfer_with_media_files')
        migration.execute()
        metadata.refresh_from_db()
        assert str(metadata.data_file).startswith(metadata.xform.user.username)
