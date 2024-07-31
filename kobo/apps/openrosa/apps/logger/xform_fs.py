# coding: utf-8
import os
import glob
import re


class XFormInstanceFS:
    def __init__(self, filepath):
        self.path = filepath
        self.directory, self.filename = os.path.split(self.path)
        self.xform_id = re.sub(".xml", "", self.filename)

    @property
    def photos(self):
        if not hasattr(self, '_photos'):
            available_photos = glob.glob(os.path.join(self.directory, "*.jpg"))
            self._photos = []
            for photo_path in available_photos:
                _pdir, photo = os.path.split(photo_path)
                if self.xml.find(photo) > 0:
                    self._photos.append(photo_path)
        return self._photos

    @property
    def metadata_directory(self):
        if not hasattr(self, '_metadata_directory'):
            instances_dir = os.path.join(
                self.directory, "..", "..", "instances")
            metadata_directory = os.path.join(
                self.directory, "..", "..", "metadata")
            if os.path.exists(instances_dir) and os.path.exists(
                    metadata_directory):
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
        if not filepath.endswith(".xml"):
            return False
        with open(filepath, 'r') as ff:
            fxml = ff.read().strip()
            if fxml.startswith('<?xml'):
                return True
            if 'http://opendatakit.org/submissions' in fxml:
                return True
        return False

    def __str__(self):
        return "<XForm XML: %s>" % self.xform_id
