# coding: utf-8
from collections import OrderedDict

from formpack.constants import KOBO_LOCK_ALL, KOBO_LOCK_COLUMN
from formpack.utils.replace_aliases import META_TYPES, GEO_TYPES


class AssetContentAnalyzer:
    def __init__(self, *args, **kwargs):
        self.survey = kwargs.get('survey')
        self.settings = kwargs.get('settings', False)
        self.choices = kwargs.get('choices', [])
        self.translations = kwargs.get('translations', [])
        self.default_translation = False
        if len(self.translations) > 0:
            self.default_translation = self.translations[0]
        self.summary = self.get_summary()

    def get_summary(self):
        row_count = 0
        geo = False
        locked = False
        labels = []
        metas = set()
        types = set()
        summary_errors = []
        keys = OrderedDict()
        naming_conflicts = []
        if not self.survey:
            return {}

        for row in self.survey:
            if isinstance(row, dict):
                if '$given_name' in row:
                    naming_conflicts.append(row['$given_name'])
                _type = row.get('type')
                _label = row.get('label')
                if _type in GEO_TYPES:
                    geo = True

                if not _type or isinstance(_type, dict) or _type.startswith('end'):
                    summary_errors.append(row)
                    continue
                if _type in META_TYPES:
                    metas.add(_type)
                    continue
                row_count += 1
                types.add(_type)
                if isinstance(_label, list) and len(_label) > 0:
                    labels.append(_label[0])
                elif isinstance(_label, str) and len(_label) > 0:
                    labels.append(_label)
                keys.update(OrderedDict.fromkeys(row.keys()))

        columns = [k for k in keys.keys() if not k.startswith('$')]

        # Display whether the survey or template is locked: if `kobo--lock_all`
        # is `True` in the "settings" or the column name of
        # `kobo--locking-profile` is present in the "survey" or the "settings",
        # `locked` is set to `True`
        if (
            self.settings.get(KOBO_LOCK_ALL, False)
            or KOBO_LOCK_COLUMN in columns
            or KOBO_LOCK_COLUMN in self.settings
        ):
            locked = True

        summary = {
            'row_count': row_count,
            'languages': self.translations,
            'default_translation': self.default_translation,
            'geo': geo,
            'locked': locked,
            'labels': labels[0:5],
            'columns': columns,
        }
        if len(naming_conflicts) > 0:
            summary['naming_conflicts'] = naming_conflicts
        return summary
