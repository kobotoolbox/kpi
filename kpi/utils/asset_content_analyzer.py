# coding: utf-8
import re

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

    def decide_name_quality(self, row):
        '''
        for any row from asset.content,
        this will return a string: 'good', ok', or 'bad'

        ideally, the front end will handle like so:
         - "bad" => force a fix before deploying
         - "ok"  => encourage a fix before deploying
        '''
        if 'name' in row and re.match(r'^[_\d]+$', row['name']):
            return 'bad'
        elif 'name' in row:
            return 'good'
        return 'ok'

    def compile_name_qualities(self, sorted_rows):
        '''
        given a dictionary of rows, sorted by 'status',
        this will return a 'name_quality' summary with these
        attributes:

            - ok: (int) number of ok rows
            - bad: (int) number of bad rows
            - good: (int) number of good rows
            - total: (int) good + bad + ok
            - firsts.bad: a record of the first row that qualified as "bad"
            - firsts.ok: a record of the first row that qualified as "ok"
        '''
        summary = {'firsts': {}}
        total = 0
        for qual in ['bad', 'ok']:
            count = len(sorted_rows[qual])
            total += count
            if count > 0:
                row = sorted_rows[qual][0]
                summary['firsts'][qual] = {
                    'name': row.get('$autoname'),
                    'index': row['index'],
                    'label': row.get('label'),
                }
            summary[qual] = count
        summary['good'] = len(sorted_rows['good'])
        summary['total'] = total + summary['good']
        return summary

    def get_summary(self):
        row_count = 0
        geo = False
        lock_all = False
        lock_any = False
        labels = []
        metas = set()
        types = set()
        summary_errors = []
        keys = OrderedDict()
        naming_conflicts = []
        if not self.survey:
            return {}

        locks = []

        names_by_quality = {'good': [], 'bad': [], 'ok': []};
        index = 0
        exclude_types = ['note', 'start', 'end', 'begin_group', 'end_group']
        for row in self.survey:
            if isinstance(row, dict):
                if '$given_name' in row:
                    naming_conflicts.append(row['$given_name'])
                _type = row.get('type')
                _label = row.get('label')
                if _type in GEO_TYPES:
                    geo = True

                locks.append(row.get(KOBO_LOCK_COLUMN, False))

                if not _type or isinstance(_type, dict) or _type.startswith('end'):
                    summary_errors.append(row)
                    continue
                if _type in META_TYPES:
                    metas.add(_type)
                    continue
                if _type in exclude_types:
                    continue
                else:
                    row_count += 1

                index += 1
                name_status = self.decide_name_quality(row)
                names_by_quality[name_status].append({**row, 'index': index})

                types.add(_type)
                if isinstance(_label, list) and len(_label) > 0:
                    labels.append(_label[0])
                elif isinstance(_label, str) and len(_label) > 0:
                    labels.append(_label)
                keys.update(OrderedDict.fromkeys(row.keys()))

        columns = [k for k in keys.keys() if not k.startswith('$')]

        # Display whether the survey or template is fully locked or has any
        # locks: if `kobo--lock_all` is `True` in the "settings" then the asset
        # is both fully locked (both `lock_all` and `lock_any` are `True`). if
        # a value for `kobo--locking-profile` is present in the "settings" or
        # the column name of `kobo--locking-profile` is present in the "survey"
        # and there is at least one locking profile assigned, then `lock_any`
        # is set to `True`
        if self.settings and isinstance(self.settings, dict):
            if self.settings.get(KOBO_LOCK_ALL, False):
                lock_all = True

            if (
                lock_all
                or (KOBO_LOCK_COLUMN in columns and any(locks))
                or self.settings.get(KOBO_LOCK_COLUMN, False)
            ):
                lock_any = True

        summary = {
            'row_count': row_count,
            'languages': self.translations,
            'default_translation': self.default_translation,
            'geo': geo,
            'lock_all': lock_all,
            'lock_any': lock_any,
            'labels': labels[0:5],
            'columns': columns,
            'name_quality': self.compile_name_qualities(names_by_quality),
        }

        if len(naming_conflicts) > 0:
            summary['naming_conflicts'] = naming_conflicts
        return summary
