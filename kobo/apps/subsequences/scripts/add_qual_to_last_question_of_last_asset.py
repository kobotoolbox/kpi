import json
from kpi.models import Asset
from jsonschema import validate
from pprint import pprint

EXAMPLE_TEXT_QUESTION = 'Any descriptors?'
EXAMPLE_YN_QUESTION = 'Do they describe the facility as being well maintained?'
UUIDS = [
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
]

def run():
    asset = Asset.objects.order_by('-date_created')[0]
    final_question_qpath = None
    for row in reversed(asset.content['survey']):
        if row['type'] in ('audio', 'video'):
            final_question_qpath = row['$qpath']
    if not final_question_qpath:
        raise RuntimeError(
            'Survey does not contain any audio or video question'
        )
    asset.advanced_features['qual'] = {
        'by_question': {
            final_question_qpath: {
                'survey': [
                    {
                        'uuid': UUIDS[0],
                        'type': 'text',
                        'labels': {
                            '_default': EXAMPLE_TEXT_QUESTION,
                        },
                    },
                    {
                        'uuid': UUIDS[1],
                        'type': 'select_one',
                        'labels': {
                            '_default': EXAMPLE_YN_QUESTION,
                        },
                        'choices': [
                            {
                                'uuid': UUIDS[2],
                                'labels': {
                                    '_default': 'Yes',
                                },
                            },
                            {
                                'uuid': UUIDS[3],
                                'labels': {
                                    '_default': 'No',
                                },
                            },
                        ],
                    },
                ],
            },
        },
    }
    asset.save()
    pprint(asset.advanced_features)

    if asset.submission_extras.count() > 0:
        subex = asset.submission_extras.last()
        subex_content_schema = asset.get_advanced_submission_schema()
        subex.content[final_question_qpath] = {
            'qual': {
                UUIDS[0]:     # text question
                    'Good',   # text response
                UUIDS[1]:     # select_one question
                    UUIDS[2]  # selected choice ('Yes')
            }
        }
        validate(
            {'submission': subex.submission_uuid, **subex.content},
            subex_content_schema,
        )
        subex.save()
