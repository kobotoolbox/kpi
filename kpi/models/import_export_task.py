import base64
from io import BytesIO
import re
import logging
from os.path import splitext
from collections import defaultdict
from django.db import models
from django.conf import settings
from django.core.urlresolvers import get_script_prefix, resolve
from django.utils.six.moves.urllib import parse as urlparse
from jsonfield import JSONField
import requests
from pyxform import xls2json_backends
from ..fields import KpiUidField
from ..models import Collection, Asset
from ..model_utils import create_assets, _load_library_content
from ..zip_importer import HttpContentParse
from rest_framework import exceptions


def _resolve_url_to_asset_or_collection(item_path):
    if item_path.startswith(('http', 'https')):
        item_path = urlparse.urlparse(item_path).path
        if settings.KPI_PREFIX and (settings.KPI_PREFIX != '/') and \
                item_path.startswith(settings.KPI_PREFIX):
            item_path = item_path.replace(settings.KPI_PREFIX, '', 1)
    match = resolve(item_path)
    uid = match.kwargs.get('uid')
    if match.url_name == 'asset-detail':
        return ('asset', Asset.objects.get(uid=uid))
    elif match.url_name == 'collection-detail':
        return ('collection', Collection.objects.get(uid=uid))


class ImportExportTask(models.Model):
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


class ImportTask(ImportExportTask):
    uid = KpiUidField(uid_prefix='i')
    '''
    someting that would be done after the file has uploaded
    ...although we probably would need to store the file in a blob
    '''

    def run(self):
        '''
        this could take a while.
        '''
        if self.status == self.COMPLETE:
            return

        _status = self.status
        msgs = defaultdict(list)
        try:
            if self.status != self.CREATED:
                # possibly a concurrent import?
                raise Exception('only recently created imports can be executed')
            self.status = self.PROCESSING
            self.save(update_fields=['status'])
            dest_item = dest_kls = has_necessary_perm = False

            if 'destination' in self.data and self.data['destination']:
                _d = self.data.get('destination')
                (dest_kls, dest_item) = _resolve_url_to_asset_or_collection(_d)
                necessary_perm = 'change_%s' % dest_kls
                if not dest_item.has_perm(self.user, necessary_perm):
                    raise exceptions.PermissionDenied('user cannot update %s' % kls)
                else:
                    has_necessary_perm = True

            if 'url' in self.data:
                self._load_assets_from_url(
                    messages=msgs,
                    url=self.data.get('url'),
                    destination=dest_item,
                    destination_kls=dest_kls,
                    has_necessary_perm=has_necessary_perm,
                )
            elif 'base64Encoded' in self.data:
                self._parse_b64_upload(
                    base64_encoded_upload=self.data['base64Encoded'],
                    filename=self.data.get('filename', None),
                    messages=msgs,
                    library=self.data.get('library', False),
                    destination=dest_item,
                    destination_kls=dest_kls,
                    has_necessary_perm=has_necessary_perm,
                )
            else:
                raise Exception(
                    'ImportTask data must contain `base64Encoded` or `url`'
                )
            _status = self.COMPLETE
        except Exception, err:
            msgs['error_type'] = type(err).__name__
            msgs['error'] = err.message
            _status = self.ERROR

        self.status = _status
        self.messages.update(msgs)
        try:
            self.save(update_fields=['status', 'messages'])
        except TypeError, e:
            self.status = ImportTask.ERROR
            logging.error('Failed to save import: %s' % repr(e),
                          exc_info=True)
            self.save(update_fields=['status'])

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
    Please move the function into the main module body to use migrations.  For
    more information, see
    https://docs.djangoproject.com/en/1.8/topics/migrations/#serializing-values
    '''
    return posixpath.join(self.user.username, 'exports', filename)


class ExportTask(ImportExportTask):
    uid = KpiUidField(uid_prefix='e')
    last_submission_timestamp = models.DateTimeField(null=True)
    result = models.FileField(upload_to=export_upload_to, max_length=380)


def _b64_xls_to_dict(base64_encoded_upload):
    decoded_str = base64.b64decode(base64_encoded_upload)
    survey_dict = xls2json_backends.xls_to_dict(BytesIO(decoded_str))
    return _strip_header_keys(survey_dict)

def _strip_header_keys(survey_dict):
    for sheet_name, sheet in survey_dict.items():
        if re.search(r'_header$', sheet_name):
            del survey_dict[sheet_name]
    return survey_dict
