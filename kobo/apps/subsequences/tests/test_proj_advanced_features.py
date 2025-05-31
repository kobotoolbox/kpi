from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from model_bakery import baker
from rest_framework import status

from kpi.models import Asset

TRANSLATED = 'translation'


class ProjectAdvancedFeaturesTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        user = baker.make(
            settings.AUTH_USER_MODEL,
            username='johndoe',
            date_joined=timezone.now(),
        )
        self.asset = Asset.objects.create(
            owner=user, content={'survey': [{'type': 'audio', 'name': 'q1'}]}
        )

    def sample_asset(self, advanced_features=None):
        if advanced_features is not None:
            self.asset.advanced_features = advanced_features
        return self.asset

    def test_schema_has_definitions(self):
        asset = self.sample_asset(advanced_features={
            'translation': {
                'values': ['q1'],
                'languages': ['tx1', 'tx2'],
            },
            'transcript': {
                'values': ['q1'],
            }
        })
        schema = asset.get_advanced_submission_schema(content=asset.content)
        assert 'definitions' in schema
        assert 'transcript' in schema['definitions']
        assert 'translation' in schema['definitions']

    def test_schema_does_not_have_extra_definitions(self):
        asset = self.sample_asset(advanced_features={
            'transcript': {
                'values': ['q1'],
            }
        })
        schema = asset.get_advanced_submission_schema(content=asset.content)
        assert 'definitions' in schema
        assert 'transcript' in schema['definitions']
        assert 'translation' not in schema['definitions']

        asset = self.sample_asset(advanced_features={
            'translation': {
                'languages': ['t1'],
            }
        })
        schema = asset.get_advanced_submission_schema(content=asset.content)
        assert 'definitions' in schema
        assert 'transcript' not in schema['definitions']
        assert 'translation' in schema['definitions']

    def test_details_for_transcript_export(self):
        asset = self.sample_asset(advanced_features={
            'transcript': {
                'values': ['q1'],
            },
        })
        asset.known_cols = ['q1:transcript:en']
        _afj = asset.analysis_form_json()
        engines = _afj['engines']
        addl_fields = _afj['additional_fields']
        assert len(addl_fields) == 1
        assert len(engines) == 1

    def test_details_for_translation_export(self):
        asset = self.sample_asset(advanced_features={
            'translation': {
                'values': ['q1'],
                'languages': ['en', 'fr']
            },
        })
        asset.known_cols = ['q1:translation:en', 'q1:translation:fr']
        _afj = asset.analysis_form_json()
        engines = _afj['engines']
        addl_fields = _afj['additional_fields']
        assert len(addl_fields) == 2
        assert len(engines) == 1

    def test_qpath_to_xpath_with_renamed_question(self):
        """
        Test that the analysis form JSON can handle a question that has been
        renamed or deleted from the survey, but is still referenced in advanced
        features or known columns.

        This ensures that the asset endpoint does not return a 500 error when
        processing legacy qpaths that no longer exist in the survey definition.
        """
        asset = self.sample_asset(advanced_features={
            'translation': {
                'values': ['q1'],
                'languages': ['en', 'fr']
            },
        })

        # Simulate known_cols with a legacy (renamed or deleted) question
        asset.known_cols = [
            'group_ia0id17-q1:translation:en',
            'group_ia0id17-q1:translation:fr'
        ]
        asset.save()

        self.client.force_login(asset.owner)
        resp = self.client.get(f'/api/v2/assets/{asset.uid}/')
        assert resp.status_code == status.HTTP_200_OK
