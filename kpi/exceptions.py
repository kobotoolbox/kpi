# -*- coding: utf-8 -*-
from rest_framework import exceptions


class BadAssetTypeException(Exception):
    pass


class BadFormatException(Exception):
    pass


class ImportAssetException(Exception):
    pass


class KoboCatProfileException(Exception):
    pass


class KobocatDeploymentException(exceptions.APIException):
    def __init__(self, *args, **kwargs):
        if 'response' in kwargs:
            self.response = kwargs.pop('response')
        super(KobocatDeploymentException, self).__init__(*args, **kwargs)

    @property
    def invalid_form_id(self):
        # We recognize certain KC API responses as indications of an
        # invalid form id:
        invalid_form_id_responses = (
            'Form with this id or SMS-keyword already exists.',
            'In strict mode, the XForm ID must be a valid slug and '
            'contain no spaces.',
        )
        return self.detail in invalid_form_id_responses
