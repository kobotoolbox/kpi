# coding: utf-8
from __future__ import unicode_literals

from django.conf import settings
from formpack import FormPack

from .constants import (SPECIFIC_REPORTS_KEY, DEFAULT_REPORTS_KEY
                        )

from copy import deepcopy


def get_instances_for_userform_id(userform_id, submission=None):
    query = {'_userform_id': userform_id, '_deleted_at': {'$exists': False}}
    if submission:
        query['_id'] = submission
    return settings.MONGO_DB.instances.find(query)


def _kuids(asset, cache=False):
    if not cache or not hasattr(asset, '_available_report_uids'):
        content = deepcopy(asset.content)
        survey = content.get('survey', [])
        asset._available_report_uids = [
            row.get('$kuid') for row in survey
        ]
    return asset._available_report_uids


def get_kuid_to_variable_name_map(asset):
    '''
    Retrieve a mapping from "kuids", which :py:mod:`formpack` is not aware of,
    to the corresponding XLSForm variable name.

    :param Asset asset: The asset to make mappings for.
    :rtype: dict[basesting, basestring]
    '''

    survey_dict = asset.content.get('survey', [])
    kuid_to_variable_name_map = {row.get('$kuid'): row.get('name') for row in survey_dict}
    return kuid_to_variable_name_map


def data(asset, kuids, lang=None, fields=None, split_by=None):
    schema = {
        "id_string": asset.deployment.xform_id_string,
        "version": 'v1',
        "content": asset.valid_xlsform_content(),
    }

    pack = FormPack([schema])
    report = pack.autoreport()
    fields = fields or [field.name for field in pack.get_fields_for_versions()]
    translations = pack.available_translations
    lang = lang or next(iter(translations), None)

    _data = [("v1", get_instances_for_userform_id(asset.deployment.mongo_userform_id))]
    stats = list(report.get_stats(_data, fields, lang, split_by).stats)
    report_data_by_variable_name = dict()
    for s in stats:
        form_field = s[0]
        label = s[1]
        stats_dict = s[2]

        variable_name = form_field.name
        field_type = form_field.data_type

        # Modify `stats_dict` so it's more amenable to quick use with Chart.js.
        freq = stats_dict.pop('frequency', None)
        if freq:
            prcntg = stats_dict.pop('percentage')
            responses, frequencies = zip(*freq)
            responses_percentage, percentages = zip(*prcntg)
            if responses != responses_percentage:
                raise ValueError('Frequency and percentage response lists mismatch.')

            stats_dict.update({'responses': responses, 'frequencies': frequencies,
                               'percentages': percentages})

        stats_dict.update({'variable_name': variable_name, 'label': label,
                          'field_type': field_type})
        report_data_by_variable_name[variable_name] = stats_dict

    available_kuids = set(_kuids(asset))
    if kuids:
        available_kuids &= set(kuids)
    kuid_to_variable_name_map = get_kuid_to_variable_name_map(asset)

    data_by_kuid = dict()
    for kuid in available_kuids:
        data_by_kuid[kuid] = report_data_by_variable_name[kuid_to_variable_name_map[kuid]]

    if not asset.report_styles:
        asset._populate_report_styles()
    default_style = asset.report_styles[DEFAULT_REPORTS_KEY]
    specified = asset.report_styles[SPECIFIC_REPORTS_KEY]
    report_styles = {kuid: specified[kuid] for kuid in available_kuids if specified.get(kuid)}

    return [
        {
            'data': data_by_kuid[kuid],
            'style': report_styles.get(kuid, default_style),
            'row': asset._get_row_by_kuid(kuid),
            'kuid': kuid,
        } for kuid in available_kuids
    ]
