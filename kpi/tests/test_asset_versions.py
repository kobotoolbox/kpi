import json
from copy import deepcopy
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone

from formpack.utils.expand_content import SCHEMA_VERSION
from kobo.apps.kobo_auth.shortcuts import User
from kpi.exceptions import BadAssetTypeException
from kpi.serializers.v2.asset_version import AssetVersionListSerializer
from kpi.utils.hash import calculate_hash
from ..models import Asset, AssetVersion


class AssetVersionTestCase(TestCase):
    def test_init_asset_version(self):
        av_count = AssetVersion.objects.count()
        _content = {
                'survey': [
                    {'type': 'note',
                     'label': 'Read me',
                     'name': 'n1'}
                ],
            }
        new_asset = Asset.objects.create(asset_type='survey', content=_content)
        _vc = deepcopy(new_asset.latest_version.version_content)
        pop_atts = [
            '$kuid',
            '$autoname',
            '$prev',
            '$xpath',
        ]
        for row in _vc['survey']:
            for att in pop_atts:
                row.pop(att, None)
        self.assertEqual(_vc, {
                'survey': [
                    {'type': 'note',
                     'label': ['Read me'],
                     'name': 'n1'},
                ],
                'schema': SCHEMA_VERSION,
                'translated': ['label'],
                'translations': [None],
                'settings': {},
            })
        self.assertEqual(av_count + 1, AssetVersion.objects.count())
        new_asset.content['survey'].append({'type': 'note',
                                            'label': 'Read me 2',
                                            'name': 'n2'})
        new_asset.save()
        self.assertEqual(av_count + 2, AssetVersion.objects.count())

    def test_asset_deployment(self):
        bob = User.objects.create(username='bob')
        self.asset = Asset.objects.create(
            asset_type='survey',
            content={'survey': [{'type': 'note', 'label': ['Read me'], 'name': 'n1'}]},
            owner=bob,
        )
        self.assertEqual(self.asset.asset_versions.count(), 1)
        self.assertEqual(self.asset.latest_version.deployed, False)

        self.asset.content['survey'].append(
            {'type': 'note', 'label': ['Read me 2'], 'name': 'n2'}
        )
        self.asset.save()
        self.assertEqual(self.asset.asset_versions.count(), 2)
        v2 = self.asset.latest_version
        self.assertEqual(self.asset.latest_version.deployed, False)

        self.asset.deploy(backend='mock', active=True)
        self.asset.save(adjust_content=False)
        # version did not increment
        self.assertEqual(self.asset.asset_versions.count(), 2)

        # v2 now has 'deployed=True'
        v2_ = AssetVersion.objects.get(uid=v2.uid)
        self.assertEqual(v2_.deployed, True)

    def test_template_asset_deployment(self):
        self.template_asset = Asset.objects.create(asset_type='template')
        self.assertEqual(self.template_asset.asset_versions.count(), 1)
        self.assertEqual(self.template_asset.latest_version.deployed, False)
        self.template_asset.save()
        self.assertEqual(self.template_asset.asset_versions.count(), 1)
        self.assertEqual(self.template_asset.latest_version.deployed, False)

        def _bad_deployment():
            self.template_asset.deploy(backend='mock', active=True)

        self.assertRaises(BadAssetTypeException, _bad_deployment)

    def test_version_content_hash(self):
        _content = {
            'survey': [
                {'type': 'note',
                 'label': 'Read me',
                 'name': 'n1'}
            ],
        }
        new_asset = Asset.objects.create(asset_type='survey', content=_content)
        expected_hash = calculate_hash(
            json.dumps(new_asset.content, sort_keys=True), 'sha1'
        )
        self.assertEqual(new_asset.latest_version.content_hash, expected_hash)
        return new_asset

    def test_version_content_hash_same_after_non_content_change(self):
        new_asset = self.test_version_content_hash()
        expected_hash = new_asset.latest_version.content_hash
        new_asset.settings['description'] = 'Loco el que lee'
        new_asset.save()
        self.assertEqual(new_asset.latest_version.content_hash, expected_hash)

    def test_content_hash_persisted_to_db_on_save(self):
        content = {'survey': [{'type': 'note', 'label': 'Read me', 'name': 'n1'}]}
        asset = Asset.objects.create(asset_type='survey', content=content)
        version = AssetVersion.objects.get(pk=asset.latest_version.pk)
        assert version._content_hash is not None

    def test_content_hash_matches_db_value(self):
        content = {'survey': [{'type': 'note', 'label': 'Read me', 'name': 'n1'}]}
        asset = Asset.objects.create(asset_type='survey', content=content)
        version = asset.latest_version
        expected_hash = calculate_hash(
            json.dumps(version.version_content, sort_keys=True), 'sha1'
        )
        db_version = AssetVersion.objects.get(pk=version.pk)
        assert db_version._content_hash == expected_hash

    def test_content_hash_included_when_update_fields_used(self):
        content = {'survey': [{'type': 'note', 'label': 'Read me', 'name': 'n1'}]}
        asset = Asset.objects.create(asset_type='survey', content=content)
        version = asset.latest_version

        # Clear hash and resave with update_fields not including _content_hash
        AssetVersion.objects.filter(pk=version.pk).update(_content_hash=None)
        version.refresh_from_db()
        assert version._content_hash is None

        version.name = 'updated'
        version.save(update_fields=['name'])

        version.refresh_from_db()
        assert version._content_hash is not None

    def _make_versions(self, asset, sequence, base_date, tied=False):
        """
        Create versions from a list of (deployed?, expected_label) tuples and
        return `{version_uid: expected_label}`. When `tied` is True every
        version shares `base_date`; otherwise `date_modified` increases by a
        minute per row (creation/`id` order still breaks ties)
        """
        expected_by_uid = {}
        for index, (deployed, expected) in enumerate(sequence):
            version = AssetVersion.objects.create(
                asset=asset, version_content={'survey': []}, deployed=deployed
            )
            date_modified = base_date if tied else (
                base_date + timedelta(minutes=index)
            )
            # `date_modified` is auto-set, so force our controlled value
            AssetVersion.objects.filter(pk=version.pk).update(
                date_modified=date_modified
            )
            expected_by_uid[version.uid] = expected
        return expected_by_uid

    def test_version_number(self):
        """
        `get_version_number()` returns the correct major/minor label ("1",
        "2.1", "3", ...) for a realistic sequence of deployed and undeployed
        versions: deployments get a running major number, drafts get a minor
        number that resets after each deployment, and drafts before the first
        deployment fall under major "0"

        Also asserts that serializing a whole page costs exactly one query (the
        memoized full-history label map), i.e. there is no N+1 per version.
        """
        asset = Asset.objects.create(asset_type='survey')
        # Remove the version created alongside the asset so we fully control
        # the sequence below
        asset.asset_versions.all().delete()

        base_date = datetime(2022, 1, 1, 0, 0, 0, tzinfo=ZoneInfo('UTC'))
        expected_by_uid = self._make_versions(
            asset,
            [
                (False, '0.1'),  # undeployed change before any deployment
                (True, '1'),     # first deployment
                (True, '2'),     # second deployment
                (False, '2.1'),  # form change after the 2nd deployment
                (False, '2.2'),
                (True, '3'),     # third deployment
                (False, '3.1'),
            ],
            base_date,
        )

        # A single serializer instance memoizes the label map per asset, so a
        # whole page resolves in exactly one query - no per-row N+1
        serializer = AssetVersionListSerializer()
        rows = list(asset.asset_versions.all())
        with self.assertNumQueries(1):
            computed_by_uid = {
                version.uid: serializer.get_version_number(version)
                for version in rows
            }
        self.assertEqual(computed_by_uid, expected_by_uid)

    def test_version_number_with_deployed_filter(self):
        """
        The label is derived from the asset's full history, so it stays correct
        even when the page is filtered with `?deployed=`: a draft keeps the
        major of the deployment that precedes it (e.g. "2.1", not "0.1")
        """
        asset = Asset.objects.create(asset_type='survey')
        asset.asset_versions.all().delete()
        base_date = datetime(2022, 1, 1, 0, 0, 0, tzinfo=ZoneInfo('UTC'))
        self._make_versions(
            asset,
            [
                (False, '0.1'),
                (True, '1'),
                (True, '2'),
                (False, '2.1'),
                (False, '2.2'),
                (True, '3'),
                (False, '3.1'),
            ],
            base_date,
        )

        serializer = AssetVersionListSerializer()

        def numbers_for(deployed):
            # Mirror `get_queryset()` for a `?deployed=` request: the page is
            # filtered, but the label map still spans the full history
            queryset = AssetVersion.objects.filter(
                asset_id=asset.id, deployed=deployed
            ).order_by('date_modified', 'id')
            return [serializer.get_version_number(v) for v in queryset]

        self.assertEqual(numbers_for(False), ['0.1', '2.1', '2.2', '3.1'])
        self.assertEqual(numbers_for(True), ['1', '2', '3'])

    def test_version_number_with_tied_timestamps(self):
        """
        Versions are ordered by `(date_modified, id)`, so even when several
        share `date_modified` the numbering respects id (creation) order: a
        draft ordered before a same-timestamp deployment stays under the
        pre-deployment major and must not inflate the minor of the draft that
        comes after the deployment
        """
        asset = Asset.objects.create(asset_type='survey')
        asset.asset_versions.all().delete()
        tied = datetime(2022, 1, 1, 0, 0, 0, tzinfo=ZoneInfo('UTC'))
        # All three share one timestamp; id order decides:
        # draft-before, deployment, draft-after
        expected_by_uid = self._make_versions(
            asset,
            [
                (False, '0.1'),  # draft before the deployment
                (True, '1'),     # deployment
                (False, '1.1'),  # draft after the deployment (not "1.2")
            ],
            tied,
            tied=True,
        )

        serializer = AssetVersionListSerializer()
        numbers = {
            version.uid: serializer.get_version_number(version)
            for version in asset.asset_versions.all()
        }
        self.assertEqual(numbers, expected_by_uid)

    def test_version_date_modified(self):
        date_forced = datetime(2022, 1, 1, 0, 0, 0, tzinfo=ZoneInfo('UTC'))
        content = {
            'survey': [{'type': 'note', 'label': 'Read me', 'name': 'n1'}],
        }
        new_asset = Asset.objects.create(
            asset_type='survey',
            content=content,
            date_created=date_forced,
            date_modified=date_forced,
        )
        AssetVersion.objects.filter(uid=new_asset.latest_version.uid).update(
            date_modified=date_forced
        )
        new_asset.refresh_from_db()
        assert new_asset.latest_version.date_modified == date_forced
        now = timezone.now()
        new_asset.latest_version.save()
        assert new_asset.latest_version.date_modified != date_forced
        assert new_asset.latest_version.date_modified >= now
