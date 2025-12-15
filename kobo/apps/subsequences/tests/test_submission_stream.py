import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from kobo.apps.openrosa.apps.logger.exceptions import ConflictingSubmissionUUIDError
from kobo.apps.subsequences.constants import SUPPLEMENT_KEY
from kobo.apps.subsequences.models import SubmissionSupplement, QuestionAdvancedFeature
from kobo.apps.subsequences.utils.supplement_data import stream_with_supplements
from kpi.models import Asset


class TestSubmissionStream(TestCase):
    def setUp(self):
        self._create_asset()
        self._create_submission_extras()

    def test_stream_with_supplements_handles_duplicated_submission_uuids(self):
        submissions = self._create_submissions()
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='Tell_me_a_story',
            action='qual',
            params=[
                {
                    'labels': {
                        '_default': "What is the quality score?"
                    },
                    'type': 'qualText',
                    'uuid': '4dcf9c9f-e503-4e5c-81f5-74250b295001'
                }
            ]
        )

        with patch.object(
            self.asset.deployment,
            'get_submissions',
            return_value=iter(submissions),
        ):
            with self.assertRaises(ConflictingSubmissionUUIDError):
                self.asset.deployment.mock_submissions(submissions)

            output = list(
                stream_with_supplements(
                    asset=self.asset,
                    submission_stream=self.asset.deployment.get_submissions(
                        user=self.asset.owner
                    ),
                    for_output=False,
                )
            )

            self.assertEqual(len(output), 2)
            for submission in output:
                self.assertIn(SUPPLEMENT_KEY, submission)

                supplemental_details = submission[SUPPLEMENT_KEY]
                self.assertIn('Tell_me_a_story', supplemental_details)

                qual_data = supplemental_details.get('Tell_me_a_story').get('qual')
                if '_versions' in qual_data:
                    for version_entry in qual_data['_versions']:
                        uuid_field = version_entry.get('_uuid')
                        self.assertIsInstance(uuid_field, str)

    def test_stream_with_extras_ignores_empty_qual_responses(self):
        submission_extras = SubmissionSupplement.objects.get(
            submission_uuid='1c05898e-b43c-491d-814c-79595eb84e81'
        )
        content = submission_extras.content
        content['Tell_me_a_story']['qual'] = {}
        submission_extras.content = content
        submission_extras.save()

        output = list(
            stream_with_supplements(
                asset=self.asset,
                submission_stream=self.asset.deployment.get_submissions(
                    user=self.asset.owner
                ),
                for_output=False,
            )
        )

        for submission in output:
            self.assertIn(SUPPLEMENT_KEY, submission)

            supplemental_details = submission[SUPPLEMENT_KEY]
            self.assertIn('Tell_me_a_story', supplemental_details)

            qual_data = supplemental_details.get('Tell_me_a_story').get('qual')
            self.assertEqual(qual_data, {})

    def _create_asset(self):
        owner = get_user_model().objects.create(username='nlp_owner')

        self.asset = Asset.objects.create(
            owner=owner,
            content={
                'schema': '1',
                'survey': [
                    {
                        'type': 'text',
                        '$kuid': 'rc9ak31',
                        'label': ["What's your name?"],
                        '$xpath': 'What_s_your_name',
                        'required': False,
                        '$autoname': 'What_s_your_name',
                    },
                    {
                        'type': 'audio',
                        '$kuid': 'ff6ek09',
                        'label': ['Tell me a story!'],
                        '$xpath': 'Tell_me_a_story',
                        'required': False,
                        '$autoname': 'Tell_me_a_story',
                    },
                ],
                'settings': {},
            },
            advanced_features={
                '_version': 'v1',
                'qual': {
                    'questions': [
                        {
                            'uuid': '4dcf9c9f-e503-4e5c-81f5-74250b295001',
                            'type': 'qualInteger',
                            'labels': {'_default': 'Quality Score'},
                        }
                    ]
                },
            },
        )
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

    def _create_submission_extras(self):
        qual_action_data = {
            '_dateCreated': '2024-04-08T15:27:00Z',
            '_dateModified': '2024-04-08T15:27:00Z',
            '_versions': [
                {
                    '_data': {
                        'uuid': '4dcf9c9f-e503-4e5c-81f5-74250b295001',
                        'value': 'What is the quality score?',
                    },
                    '_uuid': str(uuid.uuid4()),
                    '_dateCreated': '2024-04-08T15:27:00Z',
                    '_dateAccepted': '2024-04-08T15:29:00Z',
                }
            ],
        }
        SubmissionSupplement.objects.create(
            submission_uuid='1c05898e-b43c-491d-814c-79595eb84e81',
            asset=self.asset,
            content={
                '_version': '20250820',
                'Tell_me_a_story': {
                    'qual': qual_action_data,
                }
            },
        )
        SubmissionSupplement.objects.create(
            submission_uuid='1c05898e-b43c-491d-814c-79595eb84e82',
            asset=self.asset,
            content={
                '_version': '20250820',
                'Tell_me_a_story': {
                    'qual': qual_action_data,
                }
            },
        )

    def _create_submissions(self):
        return [
            {
                'What_s_your_name': 'Ed',
                'Tell_me_a_story': 'ed-18_6_24.ogg',
                'meta/rootUuid': 'uuid:1c05898e-b43c-491d-814c-79595eb84e81',
                '_uuid': '1c05898e-b43c-491d-814c-79595eb84e81',
            },
            {
                'What_s_your_name': 'Ed',
                'Tell_me_a_story': 'ed-18_6_44.ogg',
                'meta/rootUuid': 'uuid:1c05898e-b43c-491d-814c-79595eb84e82',
                '_uuid': '1c05898e-b43c-491d-814c-79595eb84e81',
            },
        ]
