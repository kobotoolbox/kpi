import json
from kpi.models import Asset
from jsonschema import validate
from pprint import pprint


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
    asset.advanced_features.update(
        {
            'transcript': {'languages': ['ar']},
            'translation': {'languages': ['en']},
        }
    )
    asset.advanced_features['keyword_search'] = {'by_response': [
        {
            # Slash-delimited paths because that's the RFC6901 JSON Pointer
            # convention used by JSON Schema
            'source': f'{final_question_qpath}/transcript',
            'keywords': ['I wish'],
        },
        {
            'source': f'{final_question_qpath}/translation/en',
            'keywords': ['community', 'decision'],
        },
        {
            'source': f'{final_question_qpath}/translation/en',
            'keywords': ['Jeffersonian'],
        },
    ]}
    asset.save()
    pprint(asset.advanced_features)

    if asset.submission_extras.count() > 0:
        subex = asset.submission_extras.last()
        subex_content_schema = asset.get_advanced_submission_schema()
        subex_content_for_question = subex.content.setdefault(
            final_question_qpath, {}
        )
        subex_content_for_question.update(
            {
                'transcript': {
                    'value': 'I wish I knew Arabic!',
                    'revisions': [],
                    'dateCreated': '2023-05-17 21:20:55',
                    'dateModified': '2023-05-17 21:20:55',
                    'languageCode': 'ar',
                },
                'translation': {
                    'en': {
                        'value': 'But who exactly is “the community”? How can we assess the claims of those who purport to represent it? These questions are seldom raised, much less answered. A strain of Jeffersonian romanticism obscures them among the left, for whom community implies an organic entity animated by a collective mind and will. From that perspective we don’t need to ask how the community makes its decisions, how it forms its will, because it reflects an immediate, almost mystical identity of interest and common feeling. In the Jeffersonian fantasy world, it is possible to imagine that formalistic democracy —that burdensome and imperfect apparatus— springs from the desire to approximate the informal, automatic popularity and transparent authenticity of the community’s decision making. This idea of community is a mystification, however, and an antidemocratic one at that. All social units are comprised of discrete individuals whose perspectives and interests and alliances differ, and every unit’s members are bound together through a combination of negotiation and coercion. The less attention is paid to cultivating and protecting the sphere of negotiation, the more the balance shifts to coercion. The rhetoric of community is impatient with the former, and its myth of authenticity rationalizes the latter.',
                        'revisions': [],
                        'dateCreated': '2023-05-17T21:21:15Z',
                        'dateModified': '2023-05-17T21:21:15Z',
                        'languageCode': 'en',
                    }
                },
            }
        )
        validate(
            {'submission': subex.submission_uuid, **subex.content},
            subex_content_schema,
        )
        subex.save()
        pprint(subex.content)
