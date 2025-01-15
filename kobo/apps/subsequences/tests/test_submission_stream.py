from copy import deepcopy
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from kobo.apps.openrosa.apps.logger.exceptions import ConflictingSubmissionUUIDError
from kobo.apps.subsequences.models import SubmissionExtras
from kobo.apps.subsequences.utils import stream_with_extras
from kpi.models import Asset


class TestSubmissionStream(TestCase):
    """
    TODO: These tests need to be built out substantially, and test data should
    move to fixtures (and be expanded with more realistic examples)
    """

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
                'qual': {
                    'qual_survey': [
                        {
                            'type': 'qual_integer',
                            'uuid': '1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a',
                            'xpath': 'Tell_me_a_story',
                            'scope': 'by_question#survey',
                            'labels': {'_default': 'When was this recorded?'},
                        },
                        {
                            'type': 'qual_select_one',
                            'uuid': '1a8b748b-f470-4c40-bc09-ce2b1197f503',
                            'xpath': 'Tell_me_a_story',
                            'scope': 'by_question#survey',
                            'labels': {
                                '_default': "What's the source of this story?"
                            },
                            'choices': [
                                {
                                    'uuid': (
                                        '3c7aacdc-8971-482a-9528-68e64730fc99'
                                    ),
                                    'labels': {
                                        '_default': 'Private conversation'
                                    },
                                },
                                {
                                    'uuid': (
                                        '7e31c6a5-5eac-464c-970c-62c383546a94'
                                    ),
                                    'labels': {'_default': 'Public event'},
                                },
                            ],
                        },
                    ]
                },
                'transcript': {'languages': ['en']},
                'translation': {'languages': []},
            },
        )
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

    def _create_mock_submissions(self):
        self.asset.deployment.mock_submissions(
            [
                {
                    'What_s_your_name': 'Ed',
                    'Tell_me_a_story': 'ed-18_6_34.ogg',
                    'meta/instanceID': (
                        'uuid:1c05898e-b43c-491d-814c-79595eb84e81'
                    ),
                    '_uuid': '1c05898e-b43c-491d-814c-79595eb84e81',
                },
            ]
        )

    def _create_submission_extras(self):
        subexes = [
            {
                'submission_uuid': '1c05898e-b43c-491d-814c-79595eb84e81',
                'content': {
                    'Tell_me_a_story': {
                        'qual': [
                            {
                                'val': 2017,
                                'type': 'qual_integer',
                                'uuid': '1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a',
                            },
                            {
                                'val': ['7e31c6a5-5eac-464c-970c-62c383546a94'],
                                'type': 'qual_select_one',
                                'uuid': '1a8b748b-f470-4c40-bc09-ce2b1197f503',
                            },
                        ],
                        # Credit: https://f4dc.org/nevermind-guaranteed-income-we-want-the-cow/
                        'transcript': {
                            'value': (
                                'I’m reminded of a story that I was told by'
                                ' Rev. Bugani Finca who was involved in South'
                                ' Africa’s Truth and Reconciliation work. A'
                                ' black South African, Tabo, confronted a white'
                                ' man, Mr. Smith, who had disrespected him and'
                                ' stolen his prize cow. With the prospect of'
                                ' amnesty for telling the truth, the white man'
                                ' admitted to having done what he was accused'
                                ' of, recognized how horribly wrong it was and'
                                ' asked for forgiveness, saying that he was'
                                ' truly sorry. Tabo was visibly relieved for'
                                ' having an opportunity to confront his'
                                ' oppressor and get an apology. They shook'
                                ' hands and embraced. As Mr. Smith, stood to'
                                ' leave, free, with his amnesty, the black man'
                                ' called out to stop him. The white man turned'
                                ' back with a questioning look on his face, not'
                                ' sure why he was being stopped, Tabo, the'
                                ' black South African, asked him: “But what'
                                ' about the cow?” Mr. Smith was visibly angry:'
                                ' “You are ruining our Reconciliation,” he'
                                ' shouted, “This has nothing to do with a cow.”'
                            ),
                            'revisions': [],
                            'dateCreated': '2024-04-29 22:08:40',
                            'dateModified': '2024-04-29 22:08:40',
                            'languageCode': 'en',
                        },
                    }
                },
                'asset': self.asset,
            },
        ]
        for subex in subexes:
            SubmissionExtras.objects.create(**subex)

    def setUp(self):
        self._create_asset()
        self._create_mock_submissions()
        self._create_submission_extras()

    def test_submission_stream_does_not_mutate_advanced_features(self):
        original_schema = deepcopy(self.asset.advanced_features)
        _ = list(
            stream_with_extras(
                self.asset.deployment.get_submissions(user=self.asset.owner),
                self.asset,
            )
        )
        # Validation failure is what exposed the bug that prompted this test;
        # reproduce that failure here
        self.asset.validate_advanced_features()
        assert self.asset.advanced_features == original_schema

    def test_submission_stream_is_flat(self):
        def mock_submission_stream():
            yield {'_uuid': 'aaa'}
            yield {'_uuid': 'bbb'}

        asset = Asset.objects.create()

        SubmissionExtras.objects.create(
            asset=asset,
            submission_uuid='aaa',
            content={
                'QQ': {
                    'transcript': {
                        'value': 'New transcript',
                        'revisions': [
                            {
                                'value': 'Here is the audio transcript',
                                'dateModified': '2021-12-27 22:51:23',
                                'languageCode': 'en',
                            }
                        ],
                        'dateCreated': '2022-01-19 23:06:55',
                        'dateModified': '2022-01-19 23:06:55',
                    },
                    'translation': {
                        'en': {'value': 'new translation'},
                        'revisions': [
                            {
                                'en': {'value': 'le translation'},
                                'dateModified': '2022-01-19 23:10:04',
                            }
                        ],
                        'dateCreated': '2022-01-19 23:14:15',
                        'dateModified': '2022-01-19 23:14:15',
                    },
                }
            },
        )
        SubmissionExtras.objects.create(
            asset=asset,
            submission_uuid='bbb',
            content={
                'QQ': {
                    'transcript': {
                        'value': 'New transcript',
                        'revisions': [],
                        'dateCreated': '2022-01-19 23:16:51',
                        'dateModified': '2022-01-19 23:16:51',
                    },
                    'translation': {
                        'en': {'value': 'new translation'},
                        'revisions': [],
                        'dateCreated': '2022-01-19 23:16:51',
                        'dateModified': '2022-01-19 23:16:51',
                    },
                }
            },
        )
        output = []
        for i in stream_with_extras(mock_submission_stream(), asset):
            output.append(i)
        assert '_supplementalDetails' in output[0]
        assert '_supplementalDetails' in output[1]
        # test other things?

    def test_stream_with_extras_handles_duplicated_submission_uuids(self):
        # Define submission data with duplicated UUIDs
        submissions = [
            {
                'What_s_your_name': 'Ed',
                'Tell_me_a_story': 'ed-18_6_24.ogg',
                'meta/instanceID': 'uuid:1c05898e-b43c-491d-814c-79595eb84e81',
                '_uuid': '1c05898e-b43c-491d-814c-79595eb84e81',
            },
            {
                'What_s_your_name': 'Ed',
                'Tell_me_a_story': 'ed-18_6_44.ogg',
                'meta/instanceID': 'uuid:1c05898e-b43c-491d-814c-79595eb84e81',
                '_uuid': '1c05898e-b43c-491d-814c-79595eb84e81',
            },
        ]

        # Mock the get_submissions method to return the test submissions
        with patch.object(
            self.asset.deployment,
            'get_submissions',
            return_value=submissions,
        ):
            # Expect a ConflictingSubmissionUUIDError due to duplicated UUIDs
            with self.assertRaises(ConflictingSubmissionUUIDError):
                self.asset.deployment.mock_submissions(submissions)

            # Process submissions with extras
            output = list(
                stream_with_extras(
                    self.asset.deployment.get_submissions(user=self.asset.owner),
                    self.asset,
                )
            )

            # Make sure that uuid values for single or multiple choice qualitative
            # analysis questions are kept as strings and not mutated
            for submission in output:
                supplemental_details = submission['_supplementalDetails']
                for qual_response in supplemental_details['Tell_me_a_story']['qual']:
                    if qual_response['type'] not in [
                        'qual_select_one',
                        'qual_select_multiple',
                    ]:
                        # question is not a single or multiple choice one
                        continue

                    for v in qual_response['val']:
                        assert isinstance(v['uuid'], str)

    def test_stream_with_extras_ignores_empty_qual_responses(self):
        # Modify submission extras 'val' to be an empty string
        submission_extras = SubmissionExtras.objects.get(
            submission_uuid='1c05898e-b43c-491d-814c-79595eb84e81'
        )
        content = submission_extras.content
        content['Tell_me_a_story']['qual'][1]['val'] = ''
        submission_extras.content = content
        submission_extras.save()

        # Process submissions with extras
        output = list(
            stream_with_extras(
                self.asset.deployment.get_submissions(user=self.asset.owner),
                self.asset,
            )
        )

        # Ensure that the empty 'val' fields are skipped and not processed
        for submission in output:
            supplemental_details = submission.get('_supplementalDetails', {})
            for key, details in supplemental_details.items():
                qual_responses = details.get('qual', [])
                for qual_response in qual_responses:
                    if qual_response['type'] in [
                        'qual_select_one',
                        'qual_select_multiple',
                    ]:
                        val = qual_response['val']

                        if isinstance(val, list):
                            for v in val:
                                self.assertEqual(v, '')
                        else:
                            self.assertEqual(val, '')
