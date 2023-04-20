from kpi.models import Asset
from pprint import pprint

EXAMPLE_TEXT_QUESTION = 'Any descriptors?'
EXAMPLE_YN_QUESTION = 'Do they describe the facility as being well maintained?'

def run():
    asset = Asset.objects.order_by('-date_created')[0]
    final_question_name = asset.content['survey'][-1]['$autoname']
    asset.advanced_features['qual'] = {
        'by_question': {
            final_question_name: {
                'survey': [
                    {
                        'type': 'text',
                        'label': {
                            'tx0': EXAMPLE_TEXT_QUESTION,
                        },
                        'name': 'q1',
                    },
                    {
                        'type': 'select_one',
                        'select_from_list_name': 'yesno',
                        'label': {
                            'tx0': EXAMPLE_YN_QUESTION,
                        },
                        'name': 'q2',
                    },
                ],
                'choices': {
                    'yesno': [
                        {
                            'label': {
                                'tx0': 'Yes',
                            },
                            'value': 'yes',
                        },
                        {
                            'label': {
                                'tx0': 'No',
                            },
                            'value': 'no',
                        },
                    ],
                },
            },
        },
    }
    asset.save()
    pprint(asset.advanced_features)
