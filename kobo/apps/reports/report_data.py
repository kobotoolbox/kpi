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


def _vnames(asset, cache=False):
    if not cache or not hasattr(asset, '_available_report_uids'):
        content = deepcopy(asset.content)
        survey = content.get('survey', [])
        asset._available_report_uids = [
            row.get('$kuid') for row in survey
        ]
    return asset._available_report_uids


def data_by_identifiers(asset, field_names=None, submission_stream=None,
                        report_styles=None, lang=None, fields=None,
                        split_by=None):
    if submission_stream is None:
        _userform_id = asset.deployment.mongo_userform_id
        submission_stream = get_instances_for_userform_id(_userform_id)
    schemas = [v.to_formpack_schema() for v in asset.deployed_versions]

    _version_id = schemas[0]['version']
    _version_id_key = schemas[0].get('version_id_key', '__version__')

    def _inject_version_id(result):
        if _version_id_key not in result:
            result[_version_id_key] = _version_id
        return result
    submission_stream = (_inject_version_id(result)
                         for result in submission_stream)
    pack = FormPack(versions=schemas, id_string=asset.uid)
    _all_versions = pack.versions.keys()
    report = pack.autoreport(versions=_all_versions)
    if field_names is None:
        field_names = [field.name for field in
                       pack.get_fields_for_versions(versions=_all_versions)]
    if report_styles is None:
        report_styles = asset.report_styles
    specified_styles = report_styles.get('specified', {})
    kuids = report_styles.get('kuid_names', {})

    def _package_stat(field, label_or_name, stat):
        identifier = kuids.get(field.name)
        freq = stat.pop('frequency', [])
        if len(freq) > 0:
            prcntg = stat.pop('percentage')
            responses, frequencies = zip(*freq)
            responses_percentage, percentages = zip(*prcntg)
            if responses != responses_percentage:
                raise ValueError('Frequency and percentage response lists mismatch.')
            stat.update({'responses': responses,
                         'frequencies': frequencies,
                         'percentages': percentages})
        return {
            'name': field.name,
            'data': stat,
            'kuid': identifier,
            'style': specified_styles.get(identifier, {}),
        }
    return [_package_stat(*stat_tup) for
            stat_tup in report.get_stats(submission_stream,
                                         fields=field_names,
                                         lang=lang,
                                         split_by=split_by)
    ]
