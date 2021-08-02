# coding: utf-8
import os
import re
import zipfile
from io import BytesIO

from xlrd import open_workbook

from kpi.exceptions import ImportAssetException


class ImportFile:
    """
    iterates through a zipfile and rebuilds a hierarchy which can then be
    parsed and used to create nested collections and assets.

    importable_structure = ImportFile(readable_content, name=name)
    importable_structure.parse()
    print json.dumps(
            importable_structure.to_dict(),
            indent=4
            )
    """
    def __init__(self, readable=False, name=None, root=False, parent=False):
        self._readable = readable
        self.parent = parent
        self.name = name
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

        (self._name_base, self._name_ext) = os.path.splitext(self.own_name)

        if self.own_path not in self.root.files_by_path:
            self.root.files_by_path[self.own_path] = self
        self.root._parsed.append(self)

    def __str__(self):
        return "<%s(type=%s) '%s'>" % (self.__class__.__name__, self._type, self.own_path,)

    def warn(self, message):
        self.root.warnings.append(message)

    @property
    def is_root(self):
        return self is self.root

    @property
    def readable(self):
        return self._readable

    def _ancestors(self, include_self=False):
        items = []
        item = self
        if include_self:
            items.append(item)
        while not item.is_root:
            if item in items:
                raise ImportAssetException("invalid link to parent causing loop")
            item = item.parent
            items.append(item)
        return list(reversed(items))

    def parse(self):
        """
        opens up the file, and parses the subfiles in a zip, creating "children" ImportFile
        objects.
        """
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
                self.store()
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
                if zipfile.is_zipfile(self.readable):
                    with zipfile.ZipFile(self.readable) as tmp_zf:
                        has_xlsx_contentfile = '[Content_Types].xml' in tmp_zf.namelist()
                    self.readable.seek(0)
                    self._is_xls = has_xlsx_contentfile
                    return self._is_xls
                self.wb = open_workbook(file_contents=self.readable.read())
                self.readable.seek(0)
                self._is_xls = True
            # FIXME
            except Exception as e:
                self._is_xls = False
        return self._is_xls

    def is_zip(self):
        if not hasattr(self, '_is_zip'):
            if isinstance(self._readable, zipfile.ZipInfo):
                self._is_zip = False
            else:
                self._is_zip = zipfile.is_zipfile(self._readable)
                self._readable.seek(0)
                self._is_zip = self._is_zip and not self.is_xls()
        return self._is_zip

    def is_dir(self):
        if not hasattr(self, '_is_dir'):
            if isinstance(self._readable, zipfile.ZipInfo):
                self._is_dir = self._readable.file_size == 0 and self._readable.filename.endswith('/')
            else:
                self._is_dir = False
        return self._is_dir


class ImportZipSubfile(ImportFile):
    def __init__(self, *args, **kwargs):
        self.zfile = kwargs['zfile']
        del kwargs['zfile']
        super().__init__(*args, **kwargs)

    @property
    def readable(self):
        if hasattr(self, '_bytesio'):
            return self._bytesio
        else:
            return self.zfile.open(self._readable)

    def store(self):
        self._bytesio = BytesIO(self.readable.read())


class RootFileImport(ImportFile):
    def __init__(self, *args, **kwargs):
        self.warnings = kwargs.get('warnings', [])
        if 'warnings' in kwargs:
            del kwargs['warnings']

        self.files_by_path = {'': self}
        self._parsed = []
        super().__init__(*args, **kwargs)

    def store(self):
        for item in self._parsed:
            if item != self:
                item.store()

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
        super().__init__(*args, **kwargs)

