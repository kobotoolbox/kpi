# coding: utf-8

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.viewer.models.data_dictionary import (
    DataDictionary,
    upload_to,
)
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)


class CloneXForm:
    def __init__(self, xform, username):
        self.xform = xform
        self.username = username

    @property
    def user(self):
        return User.objects.get(username=self.username)

    def save(self, **kwargs):
        user = User.objects.get(username=self.username)
        xls_file_path = upload_to(None, '%s%s.xls' % (
                                  self.xform.id_string,
                                  XForm.CLONED_SUFFIX),
                                  self.username)
        xls_data = default_storage.open(self.xform.xls.name)
        xls_file = default_storage.save(xls_file_path, xls_data)
        self.cloned_form = DataDictionary.objects.create(
            user=user,
            xls=xls_file
        )
