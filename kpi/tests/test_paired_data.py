# coding: utf-8
from django.contrib.auth.models import User
from django.test import TestCase

from kpi.constants import PERM_VIEW_SUBMISSIONS
from kpi.models.asset import Asset
from kpi.models.paired_data import PairedData


class PairedDataTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        someuser = User.objects.get(username='someuser')
        anotheruser = User.objects.get(username='anotheruser')
        paired_data_uid = 'pd6uw9bdGuiW7YBe22uWtwM'
        self.source_asset = Asset.objects.create(
            owner=someuser,
            name='Source case management project',
            asset_type='survey',
            content={
                'survey': [
                    {
                        'name': 'group_restaurant',
                        'type': 'begin_group',
                        "label": "Restaurant"
                    },
                    {
                        'name': 'favourite_restaurant',
                        'type': 'text',
                        'label': 'What is your favourite restaurant?',
                    },
                    {
                        'name': 'tables_count',
                        'type': 'integer',
                        'label': 'What is the number of tables?',
                    },
                    {
                        'type': 'end_group',
                    },
                    {
                        'name': 'city_name',
                        'type': 'text',
                        'label': 'Where is it located?',
                    }
                ],
            },
            data_sharing={
                'enabled': True,
                'fields': [],
            }
        )
        self.source_asset.deploy(backend='mock', active=True)
        self.source_asset.save()
        destination_asset = Asset.objects.create(
            owner=anotheruser,
            name='Destination case management project',
            asset_type='survey',
            content={
                'survey': [
                    {
                        'name': 'favourite_restaurant',
                        'type': 'text',
                        'label': 'What is your favourite restaurant?',
                    },
                ],
            },
            paired_data={
                self.source_asset.uid: {
                    'fields': [],
                    'filename': 'embed_xml.xml',
                    'paired_data_uid': paired_data_uid,
                }
            },
        )
        self.source_asset.assign_perm(destination_asset.owner, PERM_VIEW_SUBMISSIONS)
        self.paired_data = PairedData.objects(asset=destination_asset).get(
            paired_data_uid
        )

    def test_allowed_fields_with_no_specific_fields(self):
        # An empty list is equal to include all fields
        expected_fields = []
        self.assertEqual(self.paired_data.allowed_fields, expected_fields)

    def test_allowed_fields_with_specific_source_fields(self):
        # No fields provided on the destination asset,
        # only source fields should be returned then.
        self.source_asset.data_sharing['fields'] = ['city_name']
        self.source_asset.save()
        expected_fields = [
            'city_name',
        ]
        self.assertEqual(self.paired_data.allowed_fields, expected_fields)

    def test_allowed_fields_with_specific_destination_fields(self):
        # No fields provided on the source asset,
        # only destination fields should be returned.
        expected_fields = [
            'group_restaurant/favourite_restaurant',
        ]
        self.paired_data.fields = expected_fields
        self.paired_data.save()
        self.assertEqual(self.paired_data.allowed_fields, expected_fields)

    def test_allowed_fields_with_specific_source_and_destination_fields(self):
        self.source_asset.data_sharing['fields'] = [
            'city_name',
            'group_restaurant/tables_count',
        ]
        self.source_asset.save()
        self.paired_data.fields = [
            'group_restaurant/favourite_restaurant',
            'group_restaurant/tables_count',
        ]
        self.paired_data.save()

        # Fields are provided on the source asset,
        # only fields present in source AND destination should be returned.
        expected_fields = ['group_restaurant/tables_count']
        self.assertEqual(self.paired_data.allowed_fields, expected_fields)

    def test_cannot_retrieve_source_if_source_stop_data_sharing(self):
        source = self.paired_data.get_source()
        self.assertEqual(source, self.source_asset)
        self.source_asset.data_sharing['enabled'] = False
        self.source_asset.save()
        source = self.paired_data.get_source()
        self.assertEqual(source, None)

    def test_cannot_retrieve_source_if_source_remove_perm(self):
        source = self.paired_data.get_source()
        self.assertEqual(source, self.source_asset)
        self.source_asset.remove_perm(
            self.paired_data.asset.owner, PERM_VIEW_SUBMISSIONS
        )
        source = self.paired_data.get_source()
        self.assertEqual(source, None)
