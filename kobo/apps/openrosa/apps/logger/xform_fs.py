# coding: utf-8
import os
import re


class XFormInstanceFS:
    def __init__(self, filepath):
        self.path = filepath
        self.directory, self.filename = os.path.split(self.path)
        self.xform_id = re.sub('.xml', '', self.filename)

    @property
    def attachments(self):
        if not hasattr(self, '_attachments'):
            dir = os.path.join(self.directory)
            self._attachments = [
                entry
                for entry in os.scandir(dir)
                if entry.is_file()
                and entry.path != self.path
            ]
        return self._attachments

    @property
    def metadata_directory(self):
        if not hasattr(self, '_metadata_directory'):
            instances_dir = os.path.join(self.directory, '..', '..', 'instances')
            metadata_directory = os.path.join(self.directory, '..', '..', 'metadata')
            if os.path.exists(instances_dir) and os.path.exists(metadata_directory):
                self._metadata_directory = os.path.abspath(metadata_directory)
            else:
                self._metadata_directory = False
        return self._metadata_directory

    @property
    def xml(self):
        if not hasattr(self, '_xml'):
            with open(self.path, 'r') as f:
                self._xml = f.read()
        return self._xml

    @classmethod
    def is_valid_instance(cls, filepath):
        if not filepath.endswith('.xml'):
            return False
        with open(filepath, 'r') as ff:
            fxml = ff.read().strip()
            if fxml.startswith('<?xml'):
                # <?xml version="1.0" ?>
                return True
            if 'http://opendatakit.org/submissions' in fxml:
                return True
        return False

    def __str__(self):
        return '<XForm XML: %s>' % self.xform_id
