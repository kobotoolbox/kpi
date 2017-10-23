# coding: utf-8
from __future__ import unicode_literals

from collections import OrderedDict
from copy import deepcopy

from django.conf import settings
from django.utils.translation import ugettext as _
from formpack import FormPack
from rest_framework import serializers

from .constants import (SPECIFIC_REPORTS_KEY, DEFAULT_REPORTS_KEY
                        )


def get_instances_for_userform_id(userform_id, submission=None):
    query = {'_userform_id': userform_id, '_deleted_at': {'$exists': False}}
    if submission:
        query['_id'] = submission
    return settings.MONGO_DB.instances.find(query)


def build_formpack(asset, submission_stream=None):
    '''
    Return a tuple containing a `FormPack` instance and the iterable stream of
    submissions for the given `asset`
    '''
    _versions = asset.deployed_versions
    schemas = []
    for v in asset.deployed_versions:
        try:
            schemas.append(v.to_formpack_schema())
        # FIXME: should FormPack validation errors have their own
        # exception class?
        except TypeError as e:
            # https://github.com/kobotoolbox/kpi/issues/1361
            logging.error(
                'Failed to get formpack schema for version: %s'
                    % repr(e),
                 exc_info=True
            )
    pack = FormPack(versions=schemas, title=asset.name, id_string=asset.uid)

    # Find the AssetVersion UID for each deprecated reversion ID
    _reversion_ids = dict([
        (str(v._reversion_version_id), v.uid)
            for v in _versions if v._reversion_version_id
    ])

    _version_id = schemas[0]['version'] # most recent version
    _version_id_key = schemas[0].get('version_id_key', '__version__')

    def _inject_version_id(result):
        if _version_id_key not in result:
            # this submission does not specify a version; assume the latest one
            result[_version_id_key] = _version_id
        elif result[_version_id_key] in _reversion_ids:
            # this submission has a deprecated reversion ID; replace it with
            # the UID of the corresponding AssetVersion
            result[_version_id_key] = _reversion_ids[result[_version_id_key]]
        return result

    if submission_stream is None:
        _userform_id = asset.deployment.mongo_userform_id
        if not _userform_id.startswith(asset.owner.username):
            raise Exception('asset has unexpected `mongo_userform_id`')
        submission_stream = get_instances_for_userform_id(_userform_id)

    submission_stream = (
        _inject_version_id(result) for result in submission_stream
    )

    return pack, submission_stream


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
    pack, submission_stream = build_formpack(asset, submission_stream)
    _all_versions = pack.versions.keys()
    report = pack.autoreport(versions=_all_versions)
    fields_by_name = OrderedDict([
            (field.name, field) for field in
                pack.get_fields_for_versions(versions=_all_versions)
        ])
    if field_names is None:
        field_names = fields_by_name.keys()
    if split_by and (split_by not in fields_by_name):
        raise serializers.ValidationError(_("`split_by` field '{}' not found.").format(split_by))
    if split_by and (fields_by_name[split_by].data_type != 'select_one'):
        raise serializers.ValidationError(_("`split_by` field '{}' is not a select one question.").
                                          format(split_by))
    if report_styles is None:
        report_styles = asset.report_styles
    specified_styles = report_styles.get('specified', {})
    kuids = report_styles.get('kuid_names', {})

    def _stat_dict_to_array(stat, field_name):
        freq = stat.pop('frequency', [])
        if len(freq) > 0:
            prcntg = stat.pop('percentage')
            responses, frequencies = zip(*freq)
            responses_percentage, percentages = zip(*prcntg)
            if responses != responses_percentage:
                raise ValueError("Frequency and percentage response lists for field '{}' mismatch."
                                 .format(field_name))
            stat.update({'responses': responses,
                         'frequencies': frequencies,
                         'percentages': percentages})

    def _package_stat(field, _, stat, split_by):
        identifier = kuids.get(field.name)
        if not split_by:
            _stat_dict_to_array(stat, field.name)
        elif 'values' in stat:
            for _, sub_stat in stat['values']:
                _stat_dict_to_array(sub_stat, field.name)
        return {
            'name': field.name,
            'row': {'type': fields_by_name.get(field.name).data_type},
            'data': stat,
            'kuid': identifier,
            'style': specified_styles.get(identifier, {}),
        }

    return [_package_stat(*stat_tup, split_by=split_by) for
            stat_tup in report.get_stats(submission_stream,
                                         fields=field_names,
                                         lang=lang,
                                         split_by=split_by)
    ]
