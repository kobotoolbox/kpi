# FIXME: clean up these imports!
import base64
import datetime
import logging
import posixpath
import re
import tempfile
from collections import defaultdict
from io import BytesIO
from os.path import splitext

import dateutil.parser
import pytz
import requests

import formpack.constants
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.urlresolvers import Resolver404, resolve
from django.db import models, transaction
from django.utils.six.moves.urllib import parse as urlparse
from jsonfield import JSONField
from kobo.apps.reports.report_data import build_formpack
from private_storage.fields import PrivateFileField
from pyxform import xls2json_backends
from rest_framework import exceptions

from ..fields import KpiUidField
from ..model_utils import _load_library_content, create_assets
from ..models import Asset, Collection
from ..zip_importer import HttpContentParse


def _resolve_url_to_asset_or_collection(item_path):
    if item_path.startswith(('http', 'https')):
        item_path = urlparse.urlparse(item_path).path
    try:
        match = resolve(item_path)
    except Resolver404:
        # in case the app is mounted in uwsgi under a path (settings.KPI_PREFIX), we try to remove the prefix so
        # item_path can be resolved
        match = resolve(item_path.replace(settings.KPI_PREFIX, '', 1))

    uid = match.kwargs.get('uid')
    if match.url_name == 'asset-detail':
        return ('asset', Asset.objects.get(uid=uid))
    elif match.url_name == 'collection-detail':
        return ('collection', Collection.objects.get(uid=uid))


class ImportExportTask(models.Model):
    '''
    A common base model for asynchronous import and exports. Must be
    subclassed to be useful. Subclasses must implement the `_run_task()` method
    '''

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

    user = models.ForeignKey('auth.User')
    data = JSONField()
    messages = JSONField(default={})
    status = models.CharField(choices=STATUS_CHOICES, max_length=32,
                              default=CREATED)
    date_created = models.DateTimeField(auto_now_add=True)
    # date_expired = models.DateTimeField(null=True)

    def run(self):
        '''
        Starts the import/export job by calling the subclass' `_run_task()`
        method. Catches all exceptions!  Suitable to be called by an
        asynchronous task runner (Celery)
        '''
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
        except Exception, err:
            msgs['error_type'] = type(err).__name__
            msgs['error'] = err.message
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
        except TypeError, e:
            self.status = self.ERROR
            logging.error('Failed to save %s: %s' % (self._meta.model_name,
                                                   repr(e)),
                          exc_info=True)
            self.save(update_fields=['status'])


class ImportTask(ImportExportTask):
    uid = KpiUidField(uid_prefix='i')
    '''
    someting that would be done after the file has uploaded
    ...although we probably would need to store the file in a blob
    '''

    def _run_task(self, messages):
        self.status = self.PROCESSING
        self.save(update_fields=['status'])
        dest_item = dest_kls = has_necessary_perm = False

        if 'destination' in self.data and self.data['destination']:
            _d = self.data.get('destination')
            (dest_kls, dest_item) = _resolve_url_to_asset_or_collection(_d)
            necessary_perm = 'change_%s' % dest_kls
            if not dest_item.has_perm(self.user, necessary_perm):
                raise exceptions.PermissionDenied('user cannot update %s' % dest_kls)
            else:
                has_necessary_perm = True

        if 'url' in self.data:
            self._load_assets_from_url(
                messages=messages,
                url=self.data.get('url'),
                destination=dest_item,
                destination_kls=dest_kls,
                has_necessary_perm=has_necessary_perm,
            )
        elif 'base64Encoded' in self.data:
            self._parse_b64_upload(
                base64_encoded_upload=self.data['base64Encoded'],
                filename=self.data.get('filename', None),
                messages=messages,
                library=self.data.get('library', False),
                destination=dest_item,
                destination_kls=dest_kls,
                has_necessary_perm=has_necessary_perm,
            )
        else:
            raise Exception(
                'ImportTask data must contain `base64Encoded` or `url`'
            )

    def _load_assets_from_url(self, url, messages, **kwargs):
        destination = kwargs.get('destination', False)
        destination_kls = kwargs.get('destination_kls', False)
        has_necessary_perm = kwargs.get('has_necessary_perm', False)
        req = requests.get(url, allow_redirects=True)
        fif = HttpContentParse(request=req).parse()
        fif.remove_invalid_assets()
        fif.remove_empty_collections()

        destination_collection = destination \
                if (destination_kls == 'collection') else False

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
                item._orm = create_assets(item.get_type(), extra_args)
            elif item.get_type() == 'asset':
                kontent = xls2json_backends.xls_to_dict(item.readable)
                extra_args['content'] = _strip_header_keys(kontent)
                item._orm = create_assets(item.get_type(), extra_args)
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
        filename = splitext(kwargs.get('filename', ''))[0]
        library = kwargs.get('library')
        survey_dict = _b64_xls_to_dict(base64_encoded_upload)
        survey_dict_keys = survey_dict.keys()

        destination = kwargs.get('destination', False)
        destination_kls = kwargs.get('destination_kls', False)
        has_necessary_perm = kwargs.get('has_necessary_perm', False)

        if destination and not has_necessary_perm:
            # redundant check
            raise exceptions.PermissionDenied('user cannot update item')

        if destination_kls == 'collection':
            raise NotImplementedError('cannot import into a collection at this'
                                      ' time')

        if 'library' in survey_dict_keys:
            if not library:
                raise ValueError('a library cannot be imported into the'
                                 ' form list')
            if 'survey' in survey_dict_keys:
                raise ValueError('An import cannot have both "survey" and'
                                 ' "library" sheets.')
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
                if library and len(survey_dict.get('survey')) > 1:
                    asset_type = 'block'
                elif library:
                    asset_type = 'question'
                else:
                    asset_type = 'survey'
                asset = Asset.objects.create(
                    owner=self.user,
                    content=survey_dict,
                    asset_type=asset_type,
                    summary={'filename': filename},
                )
                msg_key = 'created'
            else:
                asset = destination
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
    '''
    Please note that due to Python 2 limitations, you cannot serialize unbound
    method functions (e.g. a method declared and used in the same class body).
    Please move the function into the main module body to use migrations. For
    more information, see
    https://docs.djangoproject.com/en/1.8/topics/migrations/#serializing-values
    '''
    return posixpath.join(self.user.username, 'exports', filename)


class ExportTask(ImportExportTask):
    '''
    An (asynchronous) submission data export job. The instantiator must set the
    `data` attribute to a dictionary with the following keys:
    * `type`: required; `xls` or `csv`
    * `source`: required; URL of a deployed `Asset`
    * `lang`: optional; `xml` for XML names or the name of the language to be
              used for labels. Leave unset, or use `_default` or `None`, for
              labels in the default language
    * `hierarchy_in_labels`: optional; when `true`, include the labels for all
                             ancestor groups in each field label, separated by
                             `group_sep`. Defaults to `False`
    * `group_sep`: optional; separator to use when labels contain group
                   hierarchy. Defaults to `/`
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
    '''

    uid = KpiUidField(uid_prefix='e')
    last_submission_time = models.DateTimeField(null=True)
    result = PrivateFileField(upload_to=export_upload_to, max_length=380)

    COPY_FIELDS = ('_id', '_uuid', '_submission_time')
    TIMESTAMP_KEY = '_submission_time'

    @staticmethod
    def _build_export_filename(export, extension):
        '''
        Internal method to build the export filename based on the export title
        (which should be set when calling the `FormPack()` constructor),
        the label language, the current date and time, and the given
        `extension`
        '''
        form_type = 'labels'
        if not export.lang:
            form_type = "values"
        elif export.lang != "_default":
            form_type = export.lang

        return u"{title} - {form_type} - {date:%Y-%m-%d-%H-%M}.{ext}".format(
            form_type=form_type,
            date=datetime.datetime.utcnow(),
            title=export.title,
            ext=extension
        )

    def _build_export_options(self, pack):
        '''
        Internal method to build formpack `Export` constructor arguments based
        on the options set in `self.data`
        '''
        hierarchy_in_labels = self.data.get(
            'hierarchy_in_labels', ''
        ).lower() == 'true'
        group_sep = self.data.get('group_sep', '/')
        translations = pack.available_translations
        lang = self.data.get('lang', None) or next(iter(translations), None)
        if lang == '_default':
            lang = formpack.constants.UNTRANSLATED
        tag_cols_for_header = self.data.get('tag_cols_for_header', ['hxl'])

        return {
            'versions': pack.versions.keys(),
            'group_sep': group_sep,
            'lang': lang,
            'hierarchy_in_labels': hierarchy_in_labels,
            'copy_fields': self.COPY_FIELDS,
            'force_index': True,
            'tag_cols_for_header': tag_cols_for_header,
        }

    def _record_last_submission_time(self, submission_stream):
        '''
        Internal generator that yields each submission in the given
        `submission_stream` while recording the most recent submission
        timestamp in `self.last_submission_time`
        '''
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
        '''
        Generate the export and store the result in the `self.result`
        `PrivateFileField`. Should be called by the `run()` method of the
        superclass. The `submission_stream` method is provided for testing
        '''
        source_url = self.data.get('source', False)
        if not source_url:
            raise Exception('no source specified for the export')
        source_type, source = _resolve_url_to_asset_or_collection(source_url)
        if source_type != 'asset':
            raise NotImplementedError(
                'only an `Asset` may be exported at this time')
        if not source.has_perm(self.user, 'view_submissions'):
            # Unsure if DRF exceptions make sense here since we're not
            # returning a HTTP response
            raise exceptions.PermissionDenied(
                u'{user} cannot export {source}'.format(
                    user=self.user, source=source)
            )
        if not source.has_deployment:
            raise Exception('the source must be deployed prior to export')
        export_type = self.data.get('type', '').lower()
        if export_type not in ('xls', 'csv'):
            raise NotImplementedError(
                'only `xls` and `csv` are valid export types')

        # Take this opportunity to do some housekeeping
        self.log_and_mark_stuck_as_errored(self.user, source_url)

        if hasattr(source.deployment, '_get_submissions'):
            # Currently used only for unit testing (`MockDeploymentBackend`)
            # TODO: Have the KC backend also implement `_get_submissions()`?
            submission_stream = source.deployment._get_submissions()
        else:
            submission_stream = None

        pack, submission_stream = build_formpack(source, submission_stream)
        # Wrap the submission stream in a generator that records the most
        # recent timestamp
        submission_stream = self._record_last_submission_time(
            submission_stream)
        options = self._build_export_options(pack)
        export = pack.export(**options)
        extension = 'xlsx' if export_type == 'xls' else export_type
        filename = self._build_export_filename(export, extension)
        self.result.save(filename, ContentFile(''))
        # FileField files are opened read-only by default and must be
        # closed and reopened to allow writing
        # https://code.djangoproject.com/ticket/13809
        self.result.close()
        self.result.file.close()
        with self.result.storage.open(self.result.name, 'wb') as output_file:
            if export_type == 'csv':
                for line in export.to_csv(submission_stream):
                    output_file.write((line + u"\r\n").encode('utf-8'))
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
                    '''
                    while True:
                        chunk = xlsx_output_file.read(5 * 1024 * 1024)
                        if chunk:
                            output_file.write(chunk)
                        else:
                            break
                    '''
                    output_file.write(xlsx_output_file.read())

        # Restore the FileField to its typical state
        self.result.open('rb')
        self.save(update_fields=['last_submission_time'])

        # Now that a new export has completed successfully, remove any old
        # exports in excess of the per-user, per-form limit
        self.remove_excess(self.user, source_url)

    @staticmethod
    def _filter_by_source_kludge(queryset, source):
        '''
        A disposable way to filter a queryset by source URL.
        TODO: make `data` a `JSONBField` and use proper filtering
        '''
        return queryset.filter(data__contains=source)

    @classmethod
    @transaction.atomic
    def log_and_mark_stuck_as_errored(cls, user, source):
        '''
        Set the status to ERROR and log a warning for any export that's been in
        an incomplete state for too long.

        `source` is the source URL as included in the `data` attribute.
        '''
        # How long can an export possibly run, not including time spent waiting
        # in the Celery queue?
        max_export_run_time = getattr(
            settings, 'CELERYD_TASK_TIME_LIMIT', 2100)
        # Allow a generous grace period
        max_allowed_export_age = datetime.timedelta(
            seconds=max_export_run_time * 4)
        this_moment = datetime.datetime.now(tz=pytz.UTC)
        oldest_allowed_timestamp = this_moment - max_allowed_export_age
        stuck_exports = cls.objects.filter(
            user=user,
            date_created__lt=oldest_allowed_timestamp
        ).exclude(status__in=(cls.COMPLETE, cls.ERROR))
        stuck_exports = cls._filter_by_source_kludge(stuck_exports, source)
        for stuck_export in stuck_exports:
            logging.warning(
                u'Stuck export {}: type {}, username {}, source {}, '
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
        '''
        Remove a user's oldest exports if they have more than
        settings.MAXIMUM_EXPORTS_PER_USER_PER_FORM exports for a particular
        form. Returns the number of exports removed.

        `source` is the source URL as included in the `data` attribute.
        '''
        user_source_exports = cls._filter_by_source_kludge(
            cls.objects.filter(user=user), source
        ).order_by('-date_created')
        excess_exports = user_source_exports[
            settings.MAXIMUM_EXPORTS_PER_USER_PER_FORM:
        ]
        for export in excess_exports:
            # The `result` file must be deleted manually
            export.result.delete()
            export.delete()


def _b64_xls_to_dict(base64_encoded_upload):
    decoded_str = base64.b64decode(base64_encoded_upload)
    survey_dict = xls2json_backends.xls_to_dict(BytesIO(decoded_str))
    return _strip_header_keys(survey_dict)


def _strip_header_keys(survey_dict):
    for sheet_name, sheet in survey_dict.items():
        if re.search(r'_header$', sheet_name):
            del survey_dict[sheet_name]
    return survey_dict
