from pprint import pprint

from kpi.models import Asset

import sys

def run(langs=""):
    print(langs)
    asset = Asset.objects.order_by('date_created').last()
    languages = langs.split(',')
    if len(languages) == 1 and languages[0] == '':
        languages = []
    if len(languages) == 0:
        languages = ['en']

    lang_str = ', '.join(languages)

    asset.advanced_features = {
        'transcript': {},
        'translation': {
            'languages': languages
        }
    }
    asset.save()
    asset_name = asset.name
    features = [
        'transcripts',
        f'translations in [{lang_str}]'
    ]
    features = '\n'.join(features)
    cmd = 'activate_advanced_features_for_newest_asset'
    print(f'''
submissions to your form: '{asset_name}'

http://kf.kobo.local/api/v2/assets/{asset.uid}/

can now store:
 - transcripts
 - translations in [{lang_str}]

to specify different translations, run script with args:

> manage.py runscript {cmd} --script-args=en,pl
''')
    # pprint(asset.get_advanced_submission_schema())
