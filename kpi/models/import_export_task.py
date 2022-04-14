# coding: utf-8

import base64
import datetime
import dateutil.parser
import posixpath
import pytz
import re
import tempfile
import time
from collections import defaultdict
from io import BytesIO
from os.path import split, splitext
from typing import List, Dict, Optional, Tuple, Generator

import constance
import requests
from django.conf import settings
from django.contrib.postgres.fields import JSONField as JSONBField
from django.core.files.base import ContentFile
from django.db import models, transaction
from django.urls import reverse
from django.utils.translation import gettext as t
from openpyxl.utils.exceptions import InvalidFileException
from private_storage.fields import PrivateFileField
from pyxform.xls2json_backends import xls_to_dict, xlsx_to_dict
from rest_framework import exceptions
from werkzeug.http import parse_options_header

import formpack
from formpack.constants import KOBO_LOCK_SHEET
from formpack.schema.fields import (
    IdCopyField,
    NotesCopyField,
    SubmissionTimeCopyField,
    TagsCopyField,
    ValidationStatusCopyField,
)
from formpack.utils.kobo_locking import get_kobo_locking_profiles
from formpack.utils.string import ellipsize
from kobo.apps.reports.report_data import build_formpack
from kpi.constants import (
    ASSET_TYPE_COLLECTION,
    ASSET_TYPE_EMPTY,
    ASSET_TYPE_SURVEY,
    ASSET_TYPE_TEMPLATE,
    PERM_CHANGE_ASSET,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.exceptions import XlsFormatException
from kpi.fields import KpiUidField
from kpi.models import Asset
from kpi.utils.log import logging
from kpi.utils.models import (
    _load_library_content,
    create_assets,
    resolve_url_to_asset,
)
from kpi.utils.rename_xls_sheet import (
    rename_xls_sheet,
    rename_xlsx_sheet,
    NoFromSheetError,
    ConflictSheetError,
)
from kpi.utils.strings import to_str
from kpi.zip_importer import HttpContentParse


def utcnow(*args, **kwargs):
    """
    Stupid, and exists only to facilitate mocking during unit testing.
    If you know of a better way, please remove this.
    """
    return datetime.datetime.now(tz=pytz.UTC)


class ImportExportTask(models.Model):
    """
    A common base model for asynchronous import and exports. Must be
    subclassed to be useful. Subclasses must implement the `_run_task()` method
    """

    class Meta:
        abstract = True

    CREATED = 'created'
    PROCESSING = 'processing'
    COMPLETE = 'complete'
    ERROR = 'error'

    STATUS_CHOICES = (
        (CREATED, CREATED),
        (PROCESSING, PROCESSING),
        (ERROR, ERROR),
        (COMPLETE, COMPLETE),
    )

    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    data = JSONBField()
    messages = JSONBField(default=dict)
    status = models.CharField(choices=STATUS_CHOICES, max_length=32,
                              default=CREATED)
    date_created = models.DateTimeField(auto_now_add=True)
    # date_expired = models.DateTimeField(null=True)

    def run(self):
        """
        Starts the import/export job by calling the subclass' `_run_task()`
        method. Catches all exceptions!  Suitable to be called by an
        asynchronous task runner (Celery)
        """
        with transaction.atomic():
            _refetched_self = self._meta.model.objects.get(pk=self.pk)
            self.status = _refetched_self.status
            del _refetched_self
            if self.status == self.COMPLETE:
                return
            elif self.status != self.CREATED:
                # possibly a concurrent task?
                raise Exception(
                    'only recently created {}s can be executed'.format(
                        self._meta.model_name)
                )
            self.status = self.PROCESSING
            self.save(update_fields=['status'])

        msgs = defaultdict(list)
        try:
            # This method must be implemented by a subclass
            self._run_task(msgs)
            self.status = self.COMPLETE
        except ExportTaskBase.InaccessibleData as e:
            msgs['error_type'] = t('Cannot access data')
            msg['error'] = str(e)
            self.status = self.ERROR
        # TODO: continue to make more specific exceptions as above until this
        # catch-all can be removed entirely
        except Exception as err:
            msgs['error_type'] = type(err).__name__
            msgs['error'] = str(err)
            self.status = self.ERROR
            logging.error(
                'Failed to run %s: %s' % (self._meta.model_name, repr(err)),
                exc_info=True
            )

        self.messages.update(msgs)
        # Record the processing time for diagnostic purposes
        self.data['processing_time_seconds'] = (
            datetime.datetime.now(self.date_created.tzinfo) - self.date_created
        ).total_seconds()
        try:
            self.save(update_fields=['status', 'messages', 'data'])
        except TypeError as e:
            self.status = self.ERROR
            logging.error('Failed to save %s: %s' % (self._meta.model_name,
                                                     repr(e)),
                          exc_info=True)
            self.save(update_fields=['status'])


class ImportTask(ImportExportTask):
    uid = KpiUidField(uid_prefix='i')
    """
    Something that would be done after the file has uploaded
    ...although we probably would need to store the file in a blob
    """

    def _run_task(self, messages):
        self.status = self.PROCESSING
        self.save(update_fields=['status'])
        dest_item = has_necessary_perm = False

        if 'destination' in self.data and self.data['destination']:
            _d = self.data.get('destination')
            dest_item = resolve_url_to_asset(_d)
            if not dest_item.has_perm(self.user, PERM_CHANGE_ASSET):
                raise exceptions.PermissionDenied('user cannot update asset')
            else:
                has_necessary_perm = True

        if 'url' in self.data:
            # Retrieve file name from URL
            self._load_assets_from_url(
                messages=messages,
                url=self.data.get('url'),
                destination=dest_item,
                has_necessary_perm=has_necessary_perm,
            )
            return

        # Get filename
        try:
            filename = self.data['filename']
        except KeyError:
            filename = None

        if 'single_xls_url' in self.data:
            # Retrieve file name from URL
            # TODO: merge with `url` handling above; currently kept separate
            # because `_load_assets_from_url()` uses complex logic to deal with
            # multiple XLS files in a directory structure within a ZIP archive
            response = requests.get(self.data['single_xls_url'])
            response.raise_for_status()
            encoded_xls = to_str(base64.b64encode(response.content))

            # if filename is empty or None, try to retrieve
            # file name from the response headers
            if not filename:
                filename_from_header = parse_options_header(
                    response.headers['Content-Disposition']
                )
            
                try:
                    filename = filename_from_header[1]['filename']
                except (TypeError, IndexError, KeyError):
                    pass
            
            self.data['base64Encoded'] = encoded_xls

        if 'base64Encoded' in self.data:
            # When a file is uploaded as base64, 
            # no name is provided in the encoded string
            # We should rely on self.data.get(:filename:)

            self._parse_b64_upload(
                base64_encoded_upload=self.data['base64Encoded'],
                filename=filename,
                messages=messages,
                library=self.data.get('library', False),
                desired_type=self.data.get('desired_type', None),
                destination=dest_item,
                has_necessary_perm=has_necessary_perm,
            )
            return

        raise Exception(
            'ImportTask data must contain `base64Encoded`, `url`, or '
            '`single_xls_url`'
        )

    def _load_assets_from_url(self, url, messages, **kwargs):
        destination = kwargs.get('destination', False)
        has_necessary_perm = kwargs.get('has_necessary_perm', False)
        req = requests.get(url, allow_redirects=True)
        fif = HttpContentParse(request=req).parse()
        fif.remove_invalid_assets()
        fif.remove_empty_collections()

        destination_collection = destination \
            if destination.asset_type == ASSET_TYPE_COLLECTION else False

        if destination_collection and not has_necessary_perm:
            # redundant check
            raise exceptions.PermissionDenied('user cannot load assets into this collection')

        collections_to_assign = []
        for item in fif._parsed:
            extra_args = {
                'owner': self.user,
                'name': item._name_base,
            }

            if item.get_type() == 'collection':
                # FIXME: seems to allow importing nested collections, even
                # though uploading from a file does not (`_parse_b64_upload()`
                # raises `NotImplementedError`)
                item._orm = create_assets(item.get_type(), extra_args)
            elif item.get_type() == 'asset':
                try:
                    kontent = xlsx_to_dict(item.readable)
                except InvalidFileException:
                    kontent = xls_to_dict(item.readable)

                if not destination:
                    extra_args['content'] = _strip_header_keys(kontent)
                    item._orm = create_assets(item.get_type(), extra_args)
                else:
                    # The below is copied from `_parse_b64_upload` pretty much as is
                    # TODO: review and test carefully
                    asset = destination
                    asset.content = kontent
                    asset.save()
                    messages['updated'].append({
                            'uid': asset.uid,
                            'kind': 'asset',
                            'owner__username': self.user.username,
                        })

            if item.parent:
                collections_to_assign.append([
                    item._orm,
                    item.parent._orm,
                ])
            elif destination_collection:
                collections_to_assign.append([
                    item._orm,
                    destination_collection,
                ])

        for (orm_obj, parent_item) in collections_to_assign:
            orm_obj.parent = parent_item
            orm_obj.save()

    def _parse_b64_upload(self, base64_encoded_upload, messages, **kwargs):
        filename = kwargs.get('filename', False)
        desired_type = kwargs.get('desired_type')
        # don't try to splitext() on None, False, etc.
        if filename:
            filename = splitext(filename)[0]
        else:
            filename = ''
        library = kwargs.get('library')
        survey_dict = _b64_xls_to_dict(base64_encoded_upload)
        survey_dict_keys = survey_dict.keys()

        destination = kwargs.get('destination', False)
        has_necessary_perm = kwargs.get('has_necessary_perm', False)

        if destination and not has_necessary_perm:
            # redundant check
            raise exceptions.PermissionDenied('user cannot update item')

        if destination and destination.asset_type == ASSET_TYPE_COLLECTION:
            raise NotImplementedError('cannot import into a collection at this'
                                      ' time')

        if 'library' in survey_dict_keys:
            if not library:
                raise ValueError('a library cannot be imported into the'
                                 ' form list')
            if destination:
                raise SyntaxError('libraries cannot be imported into assets')
            collection = _load_library_content({
                'content': survey_dict,
                'owner': self.user,
                'name': filename
            })
            messages['created'].append({
                'uid': collection.uid,
                'kind': 'collection',
                'owner__username': self.user.username,
            })
        elif 'survey' in survey_dict_keys:

            if not destination:
                if desired_type:
                    asset_type = desired_type
                elif library and len(survey_dict.get('survey')) > 1:
                    asset_type = 'block'
                elif library:
                    asset_type = 'question'
                else:
                    asset_type = 'survey'

                if asset_type in [ASSET_TYPE_SURVEY, ASSET_TYPE_TEMPLATE]:
                    _append_kobo_locking_profiles(
                        base64_encoded_upload, survey_dict
                    )
                asset = Asset.objects.create(
                    owner=self.user,
                    content=survey_dict,
                    asset_type=asset_type,
                    summary={'filename': filename},
                )
                msg_key = 'created'
            else:
                asset = destination
                if not asset.name:
                    asset.name = filename
                if asset.asset_type == ASSET_TYPE_EMPTY:
                    asset.asset_type = ASSET_TYPE_SURVEY
                if asset.asset_type in [ASSET_TYPE_SURVEY, ASSET_TYPE_TEMPLATE]:
                    _append_kobo_locking_profiles(
                        base64_encoded_upload, survey_dict
                    )
                asset.content = survey_dict
                asset.save()
                msg_key = 'updated'

            messages[msg_key].append({
                'uid': asset.uid,
                'summary': asset.summary,
                'kind': 'asset',
                'owner__username': self.user.username,
            })
        else:
            raise SyntaxError('xls upload must have one of these sheets: {}'
                              .format('survey, library'))


def export_upload_to(self, filename):
    """
    Please note that due to Python 2 limitations, you cannot serialize unbound
    method functions (e.g. a method declared and used in the same class body).
    Please move the function into the main module body to use migrations. For
    more information, see
    https://docs.djangoproject.com/en/1.8/topics/migrations/#serializing-values
    """
    return posixpath.join(self.user.username, 'exports', filename)


class ExportTaskBase(ImportExportTask):
    """
    An (asynchronous) submission data export job. The instantiator must set the
    `data` attribute to a dictionary with the following keys:
    * `type`: required; `xls`, `csv`, or `spss_labels`
    * `source`: required; URL of a deployed `Asset`
    * `lang`: optional; the name of the translation to be used for headers and
              response values. Specify `_xml` to use question and choice names
              instead of labels. Leave unset, or use `_default` for labels in
              the default language
    * `hierarchy_in_labels`: optional; when `true`, include the labels for all
                             ancestor groups in each field label, separated by
                             `group_sep`. Defaults to `False`
    * `group_sep`: optional; separator to use when labels contain group
                   hierarchy. Defaults to `/`
    * `fields_from_all_versions`: optional; defaults to `True`. When `False`,
                                  only fields from the latest deployed version
                                  are included
    * `tag_cols_for_header`: optional; a list of tag columns in the form
        definition to include as header rows in the export. For example, given
        the following form definition:

             | type    | name      | label                   | hxl       |
             |---------|-----------|-------------------------|-----------|
             | integer | displaced | How many are displaced? | #affected |

        an export with `tag_cols_for_header = ['hxl']` might look like:

             | How many persons are displaced? |
             | #affected                       |
             |---------------------------------|
             | 123                             |

        The default is `['hxl']`
    """

    uid = KpiUidField(uid_prefix='e')
    last_submission_time = models.DateTimeField(null=True)
    result = PrivateFileField(upload_to=export_upload_to, max_length=380)

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

    class InaccessibleData(Exception):
        def __str__(self):
            return t('This data does not exist or you do not have access to it')

    class Meta:
        abstract = True
        ordering = ['-date_created']

    def _build_export_filename(self, export, export_type):
        """
        Internal method to build the export filename based on the export title
        (which should be set when calling the `FormPack()` constructor),
        whether the latest or all versions are included, the label language,
        the current date and time, and the appropriate extension for the given
        `export_type`
        """

        if export_type == 'xls':
            extension = 'xlsx'
        elif export_type == 'spss_labels':
            extension = 'zip'
        else:
            extension = export_type

        if export_type == 'spss_labels':
            lang = 'SPSS Labels'
        elif export.lang == formpack.constants.UNTRANSLATED:
            lang = 'labels'
        else:
            lang = export.lang

        # TODO: translate this? Would we have to delegate to the front end?
        if self._fields_from_all_versions:
            version = 'all versions'
        else:
            version = 'latest version'

        filename_template = (
            '{{title}} - {version} - {{lang}} - {date:%Y-%m-%d-%H-%M-%S}'
            '.{ext}'.format(
                version=version,
                date=utcnow(),
                ext=extension
            )
        )
        title = export.title
        filename = filename_template.format(title=title, lang=lang)
        overrun = len(filename) - self.MAXIMUM_FILENAME_LENGTH
        if overrun <= 0:
            return filename
        # TODO: trim the title in a right-to-left-friendly way
        # TODO: deal with excessively long language names
        title = ellipsize(title, len(title) - overrun)
        filename = filename_template.format(title=title, lang=lang)
        return filename

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
        additional_fields = ['_attachments']

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

    def _record_last_submission_time(self, submission_stream):
        """
        Internal generator that yields each submission in the given
        `submission_stream` while recording the most recent submission
        timestamp in `self.last_submission_time`
        """
        # FIXME: Mongo has only per-second resolution. Brutal.
        for submission in submission_stream:
            try:
                timestamp = submission[self.TIMESTAMP_KEY]
            except KeyError:
                pass
            else:
                timestamp = dateutil.parser.parse(timestamp)
                # Mongo timestamps are UTC, but their string representation
                # does not indicate that
                timestamp = timestamp.replace(tzinfo=pytz.UTC)
                if (
                        self.last_submission_time is None or
                        timestamp > self.last_submission_time
                ):
                    self.last_submission_time = timestamp
            yield submission

    def _run_task(self, messages):
        """
        Generate the export and store the result in the `self.result`
        `PrivateFileField`. Should be called by the `run()` method of the
        superclass. The `submission_stream` method is provided for testing
        """
        source_url = self.data.get('source', False)
        flatten = self.data.get('flatten', True)
        export_type = self.data.get('type', '').lower()
        if export_type == 'xlsx':
            # Excel exports are always returned in XLSX format, but they're
            # referred to internally as `xls`
            export_type = 'xls'
        if export_type not in ('xls', 'csv', 'geojson', 'spss_labels'):
            raise NotImplementedError(
                'only `xls`, `csv`, `geojson`, and `spss_labels` '
                'are valid export types'
            )

        export, submission_stream = self.get_export_object()
        filename = self._build_export_filename(export, export_type)
        self.result.save(filename, ContentFile(''))
        # FileField files are opened read-only by default and must be
        # closed and reopened to allow writing
        # https://code.djangoproject.com/ticket/13809
        self.result.close()
        self.result.file.close()

        with self.result.storage.open(self.result.name, 'wb') as output_file:
            if export_type == 'csv':
                for line in export.to_csv(submission_stream):
                    output_file.write((line + "\r\n").encode('utf-8'))
            elif export_type == 'geojson':
                for line in export.to_geojson(
                    submission_stream, flatten=flatten
                ):
                    output_file.write(line.encode('utf-8'))
            elif export_type == 'xls':
                # XLSX export actually requires a filename (limitation of
                # pyexcelerate?)
                with tempfile.NamedTemporaryFile(
                        prefix='export_xlsx', mode='rb'
                ) as xlsx_output_file:
                    export.to_xlsx(xlsx_output_file.name, submission_stream)
                    # TODO: chunk again once
                    # https://github.com/jschneier/django-storages/issues/449
                    # is fixed
                    # TODO: Check if monkey-patch (line 57) can restore writing
                    # by chunk
                    """
                    while True:
                        chunk = xlsx_output_file.read(5 * 1024 * 1024)
                        if chunk:
                            output_file.write(chunk)
                        else:
                            break
                    """
                    output_file.write(xlsx_output_file.read())
            elif export_type == 'spss_labels':
                export.to_spss_labels(output_file)

        # Restore the FileField to its typical state
        self.result.open('rb')
        self.save(update_fields=['last_submission_time'])

    def delete(self, *args, **kwargs):
        # removing exported file from storage
        self.result.delete(save=False)
        super().delete(*args, **kwargs)

    def get_export_object(
        self, source: Optional[Asset] = None
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
            try:
                source = resolve_url_to_asset(source_url)
            except Asset.DoesNotExist:
                raise self.InaccessibleData

        source_perms = source.get_perms(self.user)
        if (
            PERM_VIEW_SUBMISSIONS not in source_perms
            and PERM_PARTIAL_SUBMISSIONS not in source_perms
        ):
            raise self.InaccessibleData

        if not source.has_deployment:
            raise Exception('the source must be deployed prior to export')

        # Include the group name in `fields` for Mongo to correctly filter
        # for repeat groups
        fields = self._get_fields_and_groups(fields)
        submission_stream = source.deployment.get_submissions(
            user=self.user,
            fields=fields,
            submission_ids=submission_ids,
            query=query,
        )

        pack, submission_stream = build_formpack(
            source, submission_stream, self._fields_from_all_versions
        )

        # Wrap the submission stream in a generator that records the most
        # recent timestamp
        submission_stream = self._record_last_submission_time(
            submission_stream
        )

        options = self._build_export_options(pack)
        return pack.export(**options), submission_stream

    @classmethod
    @transaction.atomic
    def log_and_mark_stuck_as_errored(cls, user, source):
        """
        Set the status to ERROR and log a warning for any export that's been in
        an incomplete state for too long.

        `source` is the source URL as included in the `data` attribute.
        """
        # How long can an export possibly run, not including time spent waiting
        # in the Celery queue?
        max_export_run_time = getattr(
            settings, 'CELERY_TASK_TIME_LIMIT', 2100)
        # Allow a generous grace period
        max_allowed_export_age = datetime.timedelta(
            seconds=max_export_run_time * 4)
        this_moment = datetime.datetime.now(tz=pytz.UTC)
        oldest_allowed_timestamp = this_moment - max_allowed_export_age
        stuck_exports = cls.objects.filter(
            user=user,
            date_created__lt=oldest_allowed_timestamp,
            data__source=source,
        ).exclude(status__in=(cls.COMPLETE, cls.ERROR))
        for stuck_export in stuck_exports:
            logging.warning(
                'Stuck export {}: type {}, username {}, source {}, '
                'age {}'.format(
                    stuck_export.uid,
                    stuck_export.data.get('type'),
                    stuck_export.user.username,
                    stuck_export.data.get('source'),
                    this_moment - stuck_export.date_created,
                )
            )
            stuck_export.status = cls.ERROR
            stuck_export.save()

    @classmethod
    @transaction.atomic
    def remove_excess(cls, user, source):
        """
        Remove a user's oldest exports if they have more than
        settings.MAXIMUM_EXPORTS_PER_USER_PER_FORM exports for a particular
        form. Returns the number of exports removed.

        `source` is the source URL as included in the `data` attribute.
        """
        user_source_exports = cls.objects.filter(
            user=user, data__source=source
        ).order_by('-date_created')
        excess_exports = user_source_exports[
            settings.MAXIMUM_EXPORTS_PER_USER_PER_FORM:
        ]
        for export in excess_exports:
            export.delete()



class ExportTask(ExportTaskBase):
    """
    An asynchronous export task, to be run with Celery
    """
    def _run_task(self, messages):
        try:
            source_url = self.data['source']
        except KeyError:
            raise Exception('no source specified for the export')

        # Take this opportunity to do some housekeeping
        self.log_and_mark_stuck_as_errored(self.user, source_url)

        super()._run_task(messages)

        # Now that a new export has completed successfully, remove any old
        # exports in excess of the per-user, per-form limit
        self.remove_excess(self.user, source_url)


class SynchronousExport(ExportTaskBase):
    """
    A synchronous export, with significant limitations on processing time, but
    offered for user convenience
    """
    FORMAT_TYPE_CHOICES = (('csv', 'csv'), ('xlsx', 'xlsx'))
    # these fields duplicate information already in `data`, but a
    # `unique_together` cannot reference things inside a json object
    asset_export_settings = models.ForeignKey(
        'kpi.AssetExportSettings', on_delete=models.CASCADE
    )
    format_type = models.CharField(choices=FORMAT_TYPE_CHOICES, max_length=32)

    class Meta:
        unique_together = (('user', 'asset_export_settings', 'format_type'),)

    @classmethod
    def generate_or_return_existing(cls, user, asset_export_settings):
        age_cutoff = utcnow() - datetime.timedelta(
            seconds=constance.config.SYNCHRONOUS_EXPORT_CACHE_MAX_AGE
        )
        format_type = asset_export_settings.export_settings['type']
        data = asset_export_settings.export_settings.copy()
        data['source'] = reverse(
            'asset-detail', args=[asset_export_settings.asset.uid]
        )
        criteria = {
            'user': user,
            'asset_export_settings': asset_export_settings,
            'format_type': format_type,
        }

        # An object (a row) must be created (inserted) before it can be locked
        cls.objects.get_or_create(**criteria, defaults={'data': data})

        with transaction.atomic():
            # Lock the object (and block until a lock can be obtained) to
            # prevent the same export from running concurrently
            export = cls.objects.select_for_update().get(**criteria)

            if (
                export.status == cls.COMPLETE
                and export.date_created >= age_cutoff
            ):
                return export

            export.data = data
            export.status = cls.CREATED
            export.date_created = utcnow()
            export.result.delete(save=False)
            export.save()
            export.run()
            return export


def _get_xls_format(decoded_str):
    first_bytes = decoded_str[:2]
    if first_bytes == b'PK':
        return 'xlsx'
    elif first_bytes == b'\xd0\xcf':
        return 'xls'
    else:
        raise XlsFormatException('Unsupported format, or corrupt file')


def _get_xls_sheet_renamer(decoded_str):
    return (
        rename_xlsx_sheet
        if _get_xls_format(decoded_str) == 'xlsx'
        else rename_xls_sheet
    )


def _get_xls_to_dict(decoded_str):
    return (
        xlsx_to_dict if _get_xls_format(decoded_str) == 'xlsx' else xls_to_dict
    )


def _b64_xls_to_dict(base64_encoded_upload):
    decoded_str = base64.b64decode(base64_encoded_upload)
    _xls_sheet_renamer = _get_xls_sheet_renamer(decoded_str)
    _xls_to_dict = _get_xls_to_dict(decoded_str)
    try:
        xls_with_renamed_sheet = _xls_sheet_renamer(
            BytesIO(decoded_str), from_sheet='library', to_sheet='survey'
        )
    except ConflictSheetError:
        raise ValueError(
            'An import cannot have both "survey" and' ' "library" sheets.'
        )
    except NoFromSheetError:
        # library did not exist in the xls file
        survey_dict = _xls_to_dict(BytesIO(decoded_str))
    else:
        survey_dict = _xls_to_dict(xls_with_renamed_sheet)
        survey_dict['library'] = survey_dict.pop('survey')

    return _strip_header_keys(survey_dict)


def _append_kobo_locking_profiles(
    base64_encoded_upload: BytesIO, survey_dict: dict
) -> None:
    decoded_bytes = base64.b64decode(base64_encoded_upload)
    kobo_locks = get_kobo_locking_profiles(BytesIO(decoded_bytes))
    if kobo_locks:
        survey_dict[KOBO_LOCK_SHEET] = kobo_locks


def _strip_header_keys(survey_dict):
    survey_dict_copy = dict(survey_dict)
    for sheet_name, sheet in survey_dict_copy.items():
        if re.search(r'_header$', sheet_name):
            del survey_dict[sheet_name]
    return survey_dict
