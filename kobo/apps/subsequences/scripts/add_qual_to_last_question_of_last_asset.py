import json

from jsonschema import validate

from kpi.models import Asset

EXAMPLES = [
    {
        'labels': {'_default': 'Any descriptors?'},
        'xpath': '<XPATH>',
        'scope': 'by_question#survey',
        'type': 'qual_tags',
        'uuid': '00000000-0000-0000-0000-000000000000',
    },
    {
        'labels': {'_default': 'Short summary (one sentence)'},
        'xpath': '<XPATH>',
        'scope': 'by_question#survey',
        'type': 'qual_text',
        'uuid': '11111111-1111-1111-1111-111111111111',
    },
    {
        'labels': {
            '_default': 'How many people are heard speaking in this ' 'response?'
        },
        'xpath': '<XPATH>',
        'scope': 'by_question#survey',
        'type': 'qual_integer',
        'uuid': '22222222-2222-2222-2222-222222222222',
    },
    {
        'choices': [
            {
                'labels': {'_default': 'Yes'},
                'uuid': '44444444-4444-4444-4444-444444444444',
            },
            {
                'labels': {'_default': 'No'},
                'uuid': '55555555-5555-5555-5555-555555555555',
            },
        ],
        'labels': {
            '_default': 'Do they describe the facility as being well ' 'maintained?'
        },
        'xpath': '<XPATH>',
        'scope': 'by_question#survey',
        'type': 'qual_select_one',
        'uuid': '33333333-3333-3333-3333-333333333333',
    },
    {
        'choices': [
            {
                'labels': {'_default': 'Lighting'},
                'uuid': '77777777-7777-7777-7777-777777777777',
            },
            {
                'labels': {'_default': 'Ventilation'},
                'uuid': '88888888-8888-8888-8888-888888888888',
            },
            {
                'labels': {'_default': 'Security'},
                'uuid': '99999999-9999-9999-9999-999999999999',
            },
        ],
        'labels': {'_default': 'Select any mentioned areas of concern'},
        'xpath': '<XPATH>',
        'scope': 'by_question#survey',
        'type': 'qual_select_multiple',
        'uuid': '66666666-6666-6666-6666-666666666666',
    },
    {
        'labels': {
            '_default': 'Please respect the confidentiality of our ' 'respondents.'
        },
        'xpath': '<XPATH>',
        'scope': 'by_question#survey',
        'type': 'qual_note',
        'uuid': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    },
]

EXAMPLE_QUAL_SURVEY_JSON = json.dumps({'qual_survey': EXAMPLES})


def run():
    asset = Asset.objects.order_by('-date_created')[0]
    final_question_xpath = None
    for row in reversed(asset.content['survey']):
        if row['type'] in ('audio', 'video'):
            final_question_xpath = row['$xpath']
    if not final_question_xpath:
        raise RuntimeError(
            'Survey does not contain any audio or video question'
        )
    asset.advanced_features['qual'] = json.loads(
        EXAMPLE_QUAL_SURVEY_JSON.replace('<XPATH>', final_question_xpath)
    )
    asset.save()

    if asset.submission_extras.count() == 0:
        print(
            'If a submission_extras model exists, this script will populate '
            'it with sample data'
        )
    else:
        subex = asset.submission_extras.last()
        subex_content_schema = asset.get_advanced_submission_schema()
        subex.content[final_question_xpath] = {
            'qual': [
                {
                    'uuid': '00000000-0000-0000-0000-000000000000',
                    'type': 'qual_tags',
                    'val': ['no taggity', 'no doubt'],
                },
                {
                    'uuid': '11111111-1111-1111-1111-111111111111',
                    'type': 'qual_text',
                    'val': 'wow. to summarize, this response is amazing.',
                },
                {
                    'uuid': '22222222-2222-2222-2222-222222222222',
                    'type': 'qual_integer',
                    'val': 69,
                },
                {
                    'uuid': '33333333-3333-3333-3333-333333333333',
                    'type': 'qual_select_one',
                    'val': '44444444-4444-4444-4444-444444444444',
                },
                {
                    'uuid': '66666666-6666-6666-6666-666666666666',
                    'type': 'qual_select_multiple',
                    'val': [
                        '77777777-7777-7777-7777-777777777777',
                        '99999999-9999-9999-9999-999999999999',
                    ],
                },
            ],
        }
        validate(
            {'submission': subex.submission_uuid, **subex.content},
            subex_content_schema,
        )
        subex.save()
