from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError
from django.test import TestCase

from kpi.models.extra_project_metadata_field import (
    ExtraProjectMetadataField,
    ExtraProjectMetadataFieldType,
)


class ExtraProjectMetadataFieldTests(TestCase):

    def test_create_text_field_success(self):
        field = ExtraProjectMetadataField.objects.create(
            name='project_internal_id',
            type=ExtraProjectMetadataFieldType.TEXT,
            label={'default': 'Internal ID'},
        )
        self.assertEqual(field.name, 'project_internal_id')

    def test_duplicate_name_fails(self):
        ExtraProjectMetadataField.objects.create(
            name='duplicate_key', type=ExtraProjectMetadataFieldType.TEXT
        )
        with self.assertRaises(IntegrityError):
            ExtraProjectMetadataField.objects.create(
                name='duplicate_key', type=ExtraProjectMetadataFieldType.TEXT
            )

    def test_select_field_without_options_fails(self):
        field = ExtraProjectMetadataField(
            name='donor', type=ExtraProjectMetadataFieldType.SINGLE_SELECT, options=[]
        )
        with self.assertRaises(ValidationError) as cm:
            field.full_clean()
        self.assertIn('options', cm.exception.message_dict)

    def test_malformed_options_structure_fails(self):
        field = ExtraProjectMetadataField(
            name='sector_list',
            type=ExtraProjectMetadataFieldType.MULTI_SELECT,
            options=[
                {'name': 'health', 'label': {'default': 'Health'}},
                {'invalid_key': 'bad_data'},  # Missing name and label
            ],
        )
        with self.assertRaises(ValidationError) as cm:
            field.full_clean()

        # Ensures specific error message for this structure is raised
        self.assertTrue(
            any(
                "Each option must be a dictionary containing 'name' and 'label'" in msg
                for msg in cm.exception.message_dict['options']
            )
        )

    def test_valid_select_field_passes(self):
        valid_options = [
            {'name': 'NGO', 'label': {'default': 'Non-Governmental'}},
            {'name': 'GOV', 'label': {'default': 'Government'}},
        ]
        field = ExtraProjectMetadataField(
            name='organization_type',
            type=ExtraProjectMetadataFieldType.SINGLE_SELECT,
            options=valid_options,
        )
        field.full_clean()
        field.save()
        self.assertEqual(ExtraProjectMetadataField.objects.count(), 1)
