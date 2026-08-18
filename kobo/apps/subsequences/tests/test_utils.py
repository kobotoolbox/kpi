from django.core.cache import cache

from kobo.apps.subsequences.utils import get_default_language, get_survey_question_type
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase


class SurveyMetadataTestCase(BaseTestCase):
    fixtures = ['test_data', 'asset_with_settings_and_qa']

    def setUp(self):
        super().setUp()
        cache.clear()
        self.asset = Asset.objects.get(uid='aNp9yMt4zKpUtTeZUnozYG')
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)

    def test_reads_question_type_and_default_language(self):
        assert get_survey_question_type(self.asset, 'settings_fixture_q1') == 'text'
        assert get_survey_question_type(self.asset, 'nonexistent') is None
        assert get_default_language(self.asset) == (
            self.asset.content['settings'].get('default_language')
        )

    def test_deployed_asset_content_is_read_only_once(self):
        # This runs on every supplemental revision, including one celery task
        # per submission for bulk actions, so it must not refetch the deferred
        # `content` field every time
        xpath = 'settings_fixture_q1'
        get_survey_question_type(self.asset, xpath)

        deferred_asset = Asset.objects.only('pk', 'uid').get(pk=self.asset.pk)
        with self.assertNumQueries(1):
            # The single query resolves the deployed version for the cache key
            question_type = get_survey_question_type(deferred_asset, xpath)
            assert question_type == 'text'
            get_default_language(deferred_asset)
