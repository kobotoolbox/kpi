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

    def test_0003_migration(self):
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
        AssetFile.objects.create(asset=asset, user=bob)
        asset.deploy(backend='mock')

        # Testing 003 involves checking if Bob's assets' data are owned by
        # Alice's MMO
        # - give bob an asset with data
        # - make alice an owner of an MMO
        # - invite bob to alice's MMO
        # - assert that bob's assets' data are not owned by alice's MMO
        # - run migration 003
        # - assert that bob's assets' data are owned by alice's MMO

    def test_0004_migration(self):
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
        AssetFile.objects.create(asset=asset, user=bob)
        asset.deploy(backend='mock')

        # Testing 004 involves checking if Bob's assets' search fields are
        # labled with alice's organization
        # asset.search_field
        # remove search_field
        # run migration
        # assert search_field is correct

        Asset.objects.filter(pk = asset.pk).update(search_field = {})
        breakpoint()
        assert asset.search_field == {}
        #migration = LongRunningMigration.objects.get(name='0004_back_fill_asset_search_field_for_owner_label')
        #migration.execute()
        #assert 
