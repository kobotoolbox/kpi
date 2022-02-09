# coding: utf-8
from os.path import split
from typing import List, Dict, Optional, Tuple, Generator

import formpack
from formpack.constants import EXPORT_SETTING_INCLUDE_ANALYSIS_FIELDS
from formpack.schema.fields import (
    IdCopyField,
    NotesCopyField,
    SubmissionTimeCopyField,
    TagsCopyField,
    ValidationStatusCopyField,
)
from rest_framework import exceptions

from kobo.apps.reports.report_data import build_formpack
from kobo.apps.subsequences.utils import stream_with_extras
from kpi.constants import (
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models import Asset
from kpi.utils.models import resolve_url_to_asset


class ExportObjectMixin:
    COPY_FIELDS = (
        IdCopyField,
        '_uuid',
        SubmissionTimeCopyField,
        ValidationStatusCopyField,
        NotesCopyField,
        # '_status' is always 'submitted_via_web' unless the submission was
        # made via KoBoCAT's bulk-submission-form; in that case, it's 'zip':
        # https://github.com/kobotoolbox/kobocat/blob/78133d519f7b7674636c871e3ba5670cd64a7227/onadata/apps/logger/import_tools.py#L67
        '_status',
        '_submitted_by',
        TagsCopyField,
    )

    # It's not very nice to ask our API users to submit `null` or `false`,
    # so replace friendlier language strings with the constants that formpack
    # expects
    API_LANGUAGE_TO_FORMPACK_LANGUAGE = {
        '_default': formpack.constants.UNTRANSLATED,
        '_xml': formpack.constants.UNSPECIFIED_TRANSLATION,
    }

    TIMESTAMP_KEY = '_submission_time'
    # Above 244 seems to cause 'Download error' in Chrome 64/Linux
    MAXIMUM_FILENAME_LENGTH = 240

    def get_export_object(
        self, source: Optional[Asset] = None, _async: bool = True
    ) -> Tuple[formpack.reporting.Export, Generator]:
        """
        Get the formpack Export object and submission stream for processing.
        """

        fields = self.data.get('fields', [])
        query = self.data.get('query', {})
        submission_ids = self.data.get('submission_ids', [])

        if source is None:
            source_url = self.data.get('source', False)
            if not source_url:
                raise Exception('no source specified for the export')
            source = resolve_url_to_asset(source_url)

        source_perms = source.get_perms(self.user)
        if (
            PERM_VIEW_SUBMISSIONS not in source_perms
            and PERM_PARTIAL_SUBMISSIONS not in source_perms
        ):
            # Unsure if DRF exceptions make sense here since we're not
            # returning a HTTP response
            raise exceptions.PermissionDenied(
                '{user} cannot export {source}'.format(
                    user=self.user, source=source
                )
            )

        if not source.has_deployment:
            raise Exception('the source must be deployed prior to export')

        if _async:
            # Take this opportunity to do some housekeeping
            self.log_and_mark_stuck_as_errored(self.user, source_url)

        # Include the group name in `fields` for Mongo to correctly filter
        # for repeat groups
        fields = self._get_fields_and_groups(fields)
        submission_stream = source.deployment.get_submissions(
            user=self.user,
            fields=fields,
            submission_ids=submission_ids,
            query=query,
        )

        if source.has_advanced_features:
            extr = dict(source.submission_extras.values_list('uuid', 'content'))
            submission_stream = stream_with_extras(submission_stream, extr)

        pack, submission_stream = build_formpack(
            source, submission_stream, self._fields_from_all_versions
        )

        if source.has_advanced_features:
            pack.extend_survey(source.analysis_form_json())

        # Wrap the submission stream in a generator that records the most
        # recent timestamp
        if _async:
            submission_stream = self._record_last_submission_time(
                submission_stream
            )

        options = self._build_export_options(pack)
        return pack.export(**options), submission_stream

    def _build_export_options(self, pack: formpack.FormPack) -> Dict:
        """
        Internal method to build formpack `Export` constructor arguments based
        on the options set in `self.data`
        """
        group_sep = self.data.get('group_sep', '/')
        multiple_select = self.data.get('multiple_select', 'both')
        translations = pack.available_translations
        lang = self.data.get('lang', None) or next(iter(translations), None)
        fields = self.data.get('fields', [])
        xls_types_as_text = self.data.get('xls_types_as_text', True)
        include_media_url = self.data.get('include_media_url', False)
        include_analysis_fields = self.data.get(
            EXPORT_SETTING_INCLUDE_ANALYSIS_FIELDS, False
        )
        force_index = True if not fields or '_index' in fields else False
        try:
            # If applicable, substitute the constants that formpack expects for
            # friendlier language strings used by the API
            lang = self.API_LANGUAGE_TO_FORMPACK_LANGUAGE[lang]
        except KeyError:
            pass
        tag_cols_for_header = self.data.get('tag_cols_for_header', ['hxl'])

        return {
            'versions': pack.versions.keys(),
            'group_sep': group_sep,
            'multiple_select': multiple_select,
            'lang': lang,
            'hierarchy_in_labels': self._hierarchy_in_labels,
            'copy_fields': self.COPY_FIELDS,
            'force_index': force_index,
            'tag_cols_for_header': tag_cols_for_header,
            'filter_fields': fields,
            'xls_types_as_text': xls_types_as_text,
            'include_media_url': include_media_url,
            EXPORT_SETTING_INCLUDE_ANALYSIS_FIELDS: include_analysis_fields,
        }

    @property
    def _fields_from_all_versions(self) -> bool:
        fields_from_versions = self.data.get('fields_from_all_versions', True)
        # v1 exports expects a string
        if isinstance(fields_from_versions, str):
            return fields_from_versions.lower() == 'true'
        return fields_from_versions

    @staticmethod
    def _get_fields_and_groups(fields: List[str]) -> List[str]:
        """
        Ensure repeat groups are included when filtering for specific fields by
        appending the path items. For example, a field with path of
        `group1/group2/field` will be added to the list as:
        ['group1/group2/field', 'group1/group2', 'group1']
        """
        if not fields:
            return []

        # Some fields are attached to the submission and must be included in
        # addition to the user-selected fields
        additional_fields = ['_attachments', '_supplementalDetails']

        field_groups = set()
        for field in fields:
            if '/' not in field:
                continue
            items = []
            while field:
                _path = split(field)[0]
                if _path:
                    items.append(_path)
                field = _path
            field_groups.update(items)
        fields += list(field_groups) + additional_fields
        return fields

    @property
    def _hierarchy_in_labels(self) -> bool:
        hierarchy_in_labels = self.data.get('hierarchy_in_labels', False)
        # v1 exports expects a string
        if isinstance(hierarchy_in_labels, str):
            return hierarchy_in_labels.lower() == 'true'
        return hierarchy_in_labels
