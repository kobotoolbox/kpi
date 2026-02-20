# coding: utf-8
from collections import OrderedDict
from copy import deepcopy

from django.utils.translation import gettext as t
from rest_framework import serializers

from formpack import FormPack
from kpi.utils.bugfix import repair_file_column_content_and_save
from kpi.utils.log import logging
from kpi.utils.versions import find_matching_version_uid
from .constants import INFERRED_VERSION_ID_KEY


def build_formpack(asset, submission_stream=None, use_all_form_versions=True):
    """
    Return a tuple containing a `FormPack` instance and the iterable stream of
    submissions for the given `asset`. If `use_all_form_versions` is `False`,
    then only the newest version of the form is considered, and all submissions
    are assumed to have been collected with that version of the form.
    """

    # Cope with kobotoolbox/formpack#322, which wrote invalid content into the
    # database
    repair_file_column_content_and_save(asset)

    if asset.has_deployment:
        if use_all_form_versions:
            _versions = asset.deployed_versions
        else:
            _versions = [asset.deployed_versions.first()]
    else:
        # Use the newest version only if the asset was never deployed
        _versions = [asset.asset_versions.first()]

    schemas = []
    version_ids_newest_first = []
    _alias_to_primary = {}
    for v in _versions:
        try:
            fp_schema = v.to_formpack_schema()
        # FIXME: should FormPack validation errors have their own
        # exception class?
        except TypeError as e:
            # https://github.com/kobotoolbox/kpi/issues/1361
            logging.error(
                f'Failed to get formpack schema for version: {repr(e)}',
                exc_info=True
            )
        else:
            fp_schema['version_id_key'] = INFERRED_VERSION_ID_KEY
            schemas.append(fp_schema)
            version_ids_newest_first.append(v.uid)
            if v.uid_aliases:
                version_ids_newest_first.extend(v.uid_aliases)
                for alias in v.uid_aliases:
                    _alias_to_primary[alias] = v.uid

    if not schemas:
        raise Exception('Cannot build formpack without any schemas')

    # FormPack() expects the versions to be ordered from oldest to newest
    pack = FormPack(versions=reversed(schemas), title=asset.name, id_string=asset.uid)

    # Find the AssetVersion UID for each deprecated reversion ID
    _reversion_ids = dict([
        (str(v._reversion_version), v.uid)
        for v in _versions if v._reversion_version
    ])

    def _infer_version_id(submission):
        if not use_all_form_versions:
            submission[INFERRED_VERSION_ID_KEY] = version_ids_newest_first[0]
            return submission

        inferred = find_matching_version_uid(
            submission,
            version_ids_newest_first,
            _reversion_ids,
            _alias_to_primary,
        )
        submission[INFERRED_VERSION_ID_KEY] = (
            # Fall back on the latest version
            # TODO: log a warning?
            inferred
            or version_ids_newest_first[0]
        )
        return submission

    if submission_stream is None:
        submission_stream = asset.deployment.get_submissions(user=asset.owner)

    submission_stream = (
        _infer_version_id(submission) for submission in submission_stream
    )

    return pack, submission_stream


# TODO validate if this function is still in used.
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
        raise serializers.ValidationError(
            {'split_by': t('`{}` not found.').format(split_by)}
        )
    if split_by and (fields_by_name[split_by].data_type != 'select_one'):
        raise serializers.ValidationError(
            {'split_by': t('`{}` is not a select one question.').format(split_by)}
        )
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

    return [
        _package_stat(*stat_tup, split_by=split_by) for
        stat_tup in report.get_stats(submission_stream,
                                     fields=field_names,
                                     lang=lang,
                                     split_by=split_by)
    ]
