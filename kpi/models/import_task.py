from django.db import models
from shortuuid import ShortUUID
from jsonfield import JSONField
from xlrd import open_workbook, XLRDError
import zipfile
from io import BytesIO
import requests
import json
import re
from pyxform import xls2json_backends
from ipdb import set_trace as debug
from kpi.models import SurveyAsset
from kpi.models import Collection
import os

UID_LENGTH = 22

class ImportTask(models.Model):
    '''
    someting that would be done after the file has uploaded
    ...although we probably would need to store the file in a blob
    '''

    CREATED=    'created'
    PROCESSING= 'processing'
    COMPLETE=   'complete'
 
    STATUS_CHOICES = (
        (CREATED, CREATED),
        (PROCESSING, PROCESSING),
        (COMPLETE, COMPLETE),
    )
 
    user = models.ForeignKey('auth.User')
    data = JSONField()
    status = models.CharField(choices=STATUS_CHOICES, max_length=32, default=CREATED)
    uid = models.CharField(max_length=UID_LENGTH, default='')
    date_created = models.DateTimeField(auto_now_add=True)
    # date_expired = models.DateTimeField(null=True)

    def save(self, *args, **kwargs):
        if self.uid == '':
            self.uid = 'i'+ShortUUID().random(UID_LENGTH-1)
        super(ImportTask, self).save(*args, **kwargs)

    def run(self):
        '''
        this is a synchronous operation that could take a while.
        '''
        if self.data['url']:
            self._load_assets_from_url(self.data['url'])

    def _load_assets_from_url(self, url):
        print 'Loading from url: ', url
        req = requests.get(url, allow_redirects=True)
        fif = HttpContentParse(request=req).parse()
        fif.remove_invalid_assets()
        fif.remove_empty_collections()
        # print fif.warnings
        fif.print_names()
        collections_to_assign = []
        for item in fif._parsed:
            kwargs = {
                'owner': self.user,
                'name': item.own_name,
            }
            if item.get_type() == 'collection':
                item._orm = Collection.objects.create(**kwargs)
            elif item.get_type() == 'asset':
                item._orm = SurveyAsset.objects.create(**kwargs)
            if item.parent:
                collections_to_assign.append([
                    item._orm,
                    item.parent,
                ])
        for (orm_obj, parent_item) in collections_to_assign:
            # print item.parent._orm.uid
            if hasattr(orm_obj, 'parent'):
                orm_obj.parent = parent_item._orm
            else:
                orm_obj.collection = parent_item._orm
            orm_obj.save()

    def _load_zipfile(self, req, messages):
        with zipfile.ZipFile(BytesIO(req.content)) as zfile:
            if '[Content_Types].xml' in zfile.namelist():
                # file is likely an xlsx file...
                return self._load_xls_workbook(open_workbook(zfile))
            nonempty_files = [
                zf for zf in zfile.filelist if zf.file_size > 0
            ]
            for zipinfo in zfile.filelist:
                try:
                    zf = zfile.open(zipinfo)
                    wb = open_workbook(file_contents=self.read())
                    zf = zfile.open(zipinfo)
                    content = self._load_xls_workbook(zf)
                    settings = content.get('settings')[0]
                    additional_sheets = {
                        'choices': content.get('choices', [])
                    }
                    SurveyAsset.objects.create(content=content['survey'],
                            settings=settings,
                            additional_sheets=additional_sheets,
                            owner=self.user)
                except XLRDError as e:
                    messages.append({
                        'error': 'could not load %s as an xls' % zipinfo.filename
                        })
        print messages

    def _load_xls_workbook(self, ff, parent_collection=None):
        import time
        time.sleep(1)
        return xls2json_backends.xls_to_dict(ff)


class ImportFile(object):
    '''
    iterates through a zipfile and rebuilds a hierarchy which can then be
    parsed and used to create nested collections and assets.

    importable_structure = ImportFile(readable_content, name=name)
    importable_structure.parse()
    print json.dumps(
            importable_structure.to_dict(),
            indent=4
            )
    '''
    def __init__(self, readable=False, name=None, root=False, parent=False):
        self.readable = readable
        self.parent = parent
        self.name = name
        # self.zfile = zfile
        name_without_trailing_slash = re.sub(r'/$', '', self.name)

        name_split = name_without_trailing_slash.split('/')
        self.own_name = name_split[-1]

        if root is False:
            self.root = self
        else:
            self.root = root

        self.dirname = os.path.dirname(name_without_trailing_slash)
        if self.dirname == '':
            self.own_path = self.own_name
        else:
            self.own_path = self.dirname + '/' + self.own_name
        if self.own_path not in self.root.files_by_path:
            self.root.files_by_path[self.own_path] = self
        self.root._parsed.append(self)

    def directory_structure(self):
        return self.root._parsed

    # def get_full_path(self):
    #     return '/'.join([
    #         a.own_name for a in self._ancestors(include_self=True)
    #         ])

    def __str__(self):
        return "<%s(type=%s) '%s'>" % (self.__class__.__name__, self._type, self.own_path,)

    def _ancestors(self, include_self=False):
        items = []
        item = self
        if include_self:
            items.append(item)
        while not item.is_root:
            item = item.parent
            items.append(item)
        return list(reversed(items))

    @property
    def is_root(self):
        return self is self.root

    def read(self):
        return self.readable.read()

    def parse(self):
        '''
        opens up the file, and parses the subfiles in a zip, creating "children" ImportFile
        objects.
        '''
        if self.is_zip():
            self._type = 'collection'
            with zipfile.ZipFile(self.readable) as zfile:
                infs = []
                for fileinfo in zfile.infolist():
                    basename = os.path.basename(fileinfo.filename)
                    if basename.startswith('.') or basename.startswith('#'):
                        continue
                    infs.append(ImportZipSubfile(readable=fileinfo, name=fileinfo.filename, zfile=zfile, root=self.root, parent=self))
                for inf in infs:
                    inf.parse()
                # self._remove_empty_collections()
        else:
            if self.is_dir():
                self._type = 'collection'
            elif self.is_xls():
                self._type = 'asset'
            else:
                self._type = 'unk'

            # if parent is still set to the default parent (root) then re-check to see if
            # a better match exists in the 'files_by_path' dict
            if self.parent is self.root and not self.is_root:
                if self.dirname in self.root.files_by_path:
                    self.parent = self.root.files_by_path[self.dirname]
        return self

    def get_type(self):
        if not hasattr(self, '_type'):
            raise RuntimeError("cannot get type of item that has not been parsed")
        return self._type

    def get_children(self):
        if not self.is_dir():
            return []
        return [
            item for item in self.root._parsed if item.parent is self
        ]

    def is_xls(self):
        if not hasattr(self, '_is_xls'):
            try:
                if zipfile.is_zipfile(self._readable):
                    with zipfile.ZipFile(self._readable) as tmp_zf:
                        has_xlsx_contentfile = '[Content_Types].xml' in tmp_zf.namelist()
                    self._is_xls = has_xlsx_contentfile
                    return self._is_xls
                self.wb = open_workbook(file_contents=self._readable.read())
                self._is_xls = True
            except Exception as e:
                self._is_xls = False
        return self._is_xls

    def warn(self, message):
        self.root.warnings.append(message)

    def is_zip(self):
        if not hasattr(self, '_is_zip'):
            if isinstance(self.readable, zipfile.ZipInfo):
                self._is_zip = False
            else:
                self._is_zip = zipfile.is_zipfile(self.readable) and not self.is_xls()
        return self._is_zip

    @property
    def _readable(self):
        return self.readable

    def is_dir(self):
        if not hasattr(self, '_is_dir'):
            if isinstance(self.readable, zipfile.ZipInfo):
                self._is_dir = self.readable.file_size == 0 and self.readable.filename.endswith('/')
            else:
                self._is_dir = False
        return self._is_dir

class ImportZipSubfile(ImportFile):
    def __init__(self, *args, **kwargs):
        self.zfile = kwargs['zfile']
        del kwargs['zfile']
        super( ImportZipSubfile, self ).__init__(*args, **kwargs)

    @property
    def _readable(self):
        return self.zfile.open(self.readable)

    def read(self):
        return self.zfile.open(self.readable).read()

class RootFileImport(ImportFile):
    def __init__(self, *args, **kwargs):
        self.warnings = kwargs.get('warnings', [])
        if 'warnings' in kwargs:
            del kwargs['warnings']

        self.files_by_path = {'': self}
        self._parsed = []
        super( RootFileImport, self ).__init__(*args, **kwargs)

    def print_names(self):
        for fif in self._parsed:
            print str(fif)

    def remove_empty_collections(self):
        while self._remove_empty_collections():
            pass

    def _remove_empty_collections(self):
        colls_with_no_children = []
        for item in self._parsed:
            if item.is_dir() and len(item.get_children()) == 0:
                colls_with_no_children.append(item)
        for empty_coll in colls_with_no_children:
            self.warnings.append({
                    'message': 'ignoring empty directory',
                    'detail': empty_coll.name
                })
            self._parsed.remove(empty_coll)
        return len(colls_with_no_children) > 0

    def remove_invalid_assets(self):
        queued_for_removal = []
        for item in self._parsed:
            if item.get_type() == 'unk':
                queued_for_removal.append(item)
        for item in queued_for_removal:
            self._parsed.remove(item)

class HttpContentParse(RootFileImport):
    def __init__(self, *args, **kwargs):
        self.request = kwargs['request']
        del kwargs['request']

        # fail if 404 file not found
        self.request.raise_for_status()

        kwargs['readable'] = BytesIO(self.request.content)
        if 'name' not in kwargs:
            kwargs['name'] = os.path.basename(self.request.url)
        super( HttpContentParse, self ).__init__(*args, **kwargs)

