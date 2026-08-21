from copy import deepcopy

from django.core.cache import cache

from kobo.apps.subsequences.utils import get_form_language, get_survey_question_type
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

    def test_reads_question_type_and_form_language(self):
        assert get_survey_question_type(self.asset, 'settings_fixture_q1') == 'text'
        assert get_survey_question_type(self.asset, 'nonexistent') is None
        assert get_form_language(self.asset) is None

    def test_form_language_falls_back_to_the_default_translation(self):
        content = deepcopy(self.asset.content)
        content['settings'] = {}
        content['translations'] = ['Deutsch (de)']
        self.asset.content = content
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)

        assert get_form_language(Asset.objects.get(pk=self.asset.pk)) == 'Deutsch (de)'

    def test_undeployed_draft_edits_do_not_affect_a_deployed_form(self):
        # Submissions belong to the deployed version, so editing the draft must
        # not change how their supplemental data is processed
        xpath = 'settings_fixture_q1'
        assert get_survey_question_type(self.asset, xpath) == 'text'

        content = deepcopy(self.asset.content)
        for question in content['survey']:
            if question['name'] == xpath:
                question['type'] = 'audio'
        self.asset.content = content
        self.asset.save()

        edited_asset = Asset.objects.get(pk=self.asset.pk)
        assert get_survey_question_type(edited_asset, xpath) == 'text'

        edited_asset.deploy(backend='mock', active=True)
        redeployed_asset = Asset.objects.get(pk=self.asset.pk)
        assert get_survey_question_type(redeployed_asset, xpath) == 'audio'

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
            get_form_language(deferred_asset)
