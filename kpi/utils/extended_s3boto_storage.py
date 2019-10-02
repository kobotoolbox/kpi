# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from storages.backends.s3boto import S3BotoStorage


class ExtendedS3BotoStorage(S3BotoStorage):

    def delete_all(self, name):
        """
        Delete the key object and all its versions
        :param name: str. S3 key (i.e. path to the file)
        """
        name = self._normalize_name(self._clean_name(name))
        self.bucket.delete_key(self._encode_name(name))

        # Delete all previous versions
        for versioned_key in self.bucket.list_versions(prefix=name):
            self.bucket.delete_key(versioned_key.name, version_id=versioned_key.version_id)
