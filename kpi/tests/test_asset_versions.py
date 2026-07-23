import json
from copy import deepcopy
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.test import RequestFactory, TestCase
from django.utils import timezone

from rest_framework.request import Request

from formpack.utils.expand_content import SCHEMA_VERSION
from kobo.apps.kobo_auth.shortcuts import User
from kpi.exceptions import BadAssetTypeException
from kpi.serializers.v2.asset_version import AssetVersionListSerializer
from kpi.views.v2.asset_version import AssetVersionViewSet
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

    def test_version_number(self):
        """
        Test that `AssetVersionListSerializer.get_version_number()` returns the
        correct major/minor version label ("1", "2.1", "3", etc.) for a realistic
        chronological sequence of deployed and undeployed versions

        This covers two separate concerns:
        1. Correctness of the numbering logic itself, via the fallback path (no
        window annotations) - deployed versions get a running major number,
        undeployed versions get a minor number that resets after each
        deployment, and versions created before the first deployment are
        correctly numbered under major "0".

        2. That the production `list` endpoint path (`get_queryset()` +
        `annotate_version_numbers()`) computes identical numbers via window
        function annotations, and that reading those annotations during
        serialization fires zero additional queries - i.e. the version numbers
        for a full page are resolved without any N+1 query per version, which
        is the whole reason this was implemented as an annotated queryset
        rather than per-object lookups.
        """
        asset = Asset.objects.create(asset_type='survey')
        # Remove the version created alongside the asset so we fully control
        # the sequence below
        asset.asset_versions.all().delete()

        base_date = datetime(2022, 1, 1, 0, 0, 0, tzinfo=ZoneInfo('UTC'))

        # A chronological sequence of (deployed?, expected version_number)
        sequence = [
            (False, '0.1'),  # undeployed change before any deployment
            (True, '1'),     # first deployment
            (True, '2'),     # second deployment
            (False, '2.1'),  # form change after the 2nd deployment
            (False, '2.2'),
            (True, '3'),     # third deployment
            (False, '3.1'),
        ]

        expected_by_uid = {}
        for index, (deployed, expected) in enumerate(sequence):
            version = AssetVersion.objects.create(
                asset=asset,
                version_content={'survey': []},
                deployed=deployed,
            )
            # `date_modified` is auto-set, so force a strictly increasing value
            AssetVersion.objects.filter(pk=version.pk).update(
                date_modified=base_date + timedelta(minutes=index)
            )
            expected_by_uid[version.uid] = expected

        # The endpoint returns versions newest-first, and the version number
        # must not depend on which page a version lands on
        serializer = AssetVersionListSerializer()

        # Fallback path (e.g. the `retrieve` action): no `_version_major`
        # annotation, so the major number is computed with a count query
        computed_by_uid = {
            version.uid: serializer.get_version_number(version)
            for version in asset.asset_versions.all()
        }
        self.assertEqual(computed_by_uid, expected_by_uid)

        # Production `list` path: both numbers arrive as window annotations, so
        # serializing the whole page must not fire a single extra query (no
        # N+1). One query fetches + computes the windows; serialization adds 0
        view = AssetVersionViewSet()
        view.action = 'list'
        view.request = Request(RequestFactory().get('/'))
        view._asset_uid = asset.uid
        rows = list(view.get_queryset())
        with self.assertNumQueries(0):
            annotated_by_uid = {
                version.uid: serializer.get_version_number(version)
                for version in rows
            }
        self.assertEqual(annotated_by_uid, expected_by_uid)

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
