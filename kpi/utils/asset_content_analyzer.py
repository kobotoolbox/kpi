import re
import json

import pyxform

# possibly pull these aliases from pyxform
GEO_TYPES = ['gps', 'geopoint', 'geoshape', 'geotrace',]
_unlisted_meta_types = ['username']
META_QUESTION_TYPES = pyxform.constants.XLSFORM_METADATA_TYPES | set(_unlisted_meta_types)

class AssetContentAnalyzer(object):
    def __init__(self, *args, **kwargs):
        self.survey = kwargs.get('survey')
        self.settings = kwargs.get('settings', False)
        self.choices = kwargs.get('choices', [])
        self.summary = self.get_summary()

    def _get_languages_from_column_names(self, cols):
        langs = set()
        for col in cols:
            media_mtch = re.match('^media\:', col)
            mtch = re.match('.*\:\:?(.+)', col)
            if mtch and not media_mtch:
                langs.add(mtch.groups()[0])
        return list(langs)

    def get_summary(self):
        row_count = 0
        languages = set()
        geo = False
        labels = []
        metas = set()
        types = set()
        summary_errors = []
        keys = set()
        if not self.survey:
            return {}

        for row in self.survey:
            if type(row) == dict:
                _type = row.get('type')
                _label = row.get('label')
                if _type in GEO_TYPES:
                    geo = True
                if isinstance(_type, dict):
                    summary_errors.append(['invalidtype', str(_type)])
                    _type = _type.keys()[0]

                if not _type:
                    summary_errors.append(row)
                    continue
                if re.match('^end', _type):
                    continue
                if _type in META_QUESTION_TYPES:
                    metas.add(_type)
                    continue
                row_count += 1
                types.add(_type)
                if _label != None and len(_label) > 0:
                    labels.append(_label)
                keys = keys | set(row.keys())

        summary = {
            'row_count': row_count,
            'languages': self._get_languages_from_column_names(keys),
            'geo': geo,
            'labels': labels[0:5],
            'columns': list(keys),
        }
        return summary
