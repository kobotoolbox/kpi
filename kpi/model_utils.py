import copy
import re
from .models import SurveyAsset
from .models import Collection

TAG_RE = r'tag:(.*)'

def _load_library_content(structure):
    content = structure.get('content', {})
    if 'library' not in content:
        raise Exception('to load a library, you must have a sheet called "library"')
    collection = Collection.objects.create(owner=structure['owner'], name=structure['name'])
    assets = []
    for row in content.get('library', []):
        sub_lib_asset = copy.deepcopy(content)
        del sub_lib_asset['library']
        row_tags = []
        for key, val in row.items():
            if str(val).lower() in ['false', '0', 'no', 'n', '', 'none']:
                continue
            if re.search(TAG_RE, key):
                row_tags.append(re.match(TAG_RE, key).groups()[0])
                del row[key]
        sub_lib_asset['survey'] = [row]
        sa = SurveyAsset.objects.create(content=sub_lib_asset, asset_type='survey_block',
                                    owner=structure['owner'], parent=collection)
        sa.tags.add(*row_tags)
    return collection

def create_assets(kls, structure, **options):
    if kls == "collection":
        obj = Collection.objects.create(**structure)
    elif kls == "asset":
        if 'library' in structure.get('content', {}):
            obj = _load_library_content(structure)
        else:
            obj = SurveyAsset.objects.create(**structure)
    return obj