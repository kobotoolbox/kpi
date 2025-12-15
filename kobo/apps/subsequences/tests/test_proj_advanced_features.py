from django.conf import settings
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from model_bakery import baker
from rest_framework import status

from kpi.models import Asset


class ProjectAdvancedFeaturesRefactoredTestCase(TestCase):

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

    def test_qpath_to_xpath_with_renamed_question(self):
        asset = self.sample_asset(
            advanced_features={
                '_version': 'v1',
                'translation': {
                    'languages': ['en', 'fr'],
                },
            }
        )

        # Simulate known_cols with a legacy (renamed or deleted) question
        asset.known_cols = [
            'group_ia0id17-q1:translation:en',
            'group_ia0id17-q1:translation:fr',
        ]
        asset.save()

        self.client.force_login(asset.owner)
        asset_detail_url = reverse('asset-detail', kwargs={'uid_asset': asset.uid})
        response = self.client.get(asset_detail_url)
        assert response.status_code == status.HTTP_200_OK
