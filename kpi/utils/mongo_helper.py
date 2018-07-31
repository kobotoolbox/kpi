# -*- coding: utf-8 -*-
import re
import base64

class MongoDecodingHelper(object):
    '''
    Stripped-down version of KoBoCAT's
    onadata.apps.api.mongo_helper.MongoHelper for decoding only.
    '''

    KEY_WHITELIST = ['$or', '$and', '$exists', '$in', '$gt', '$gte',
                     '$lt', '$lte', '$regex', '$options', '$all']
    DECODING_SUBSTITUTIONS = [
        (re.compile(r'^' + base64.encodestring('$').strip()), '$'),
        (re.compile(base64.encodestring('.').strip()), '.'),
    ]

    @classmethod
    def to_readable_dict(cls, d):
        """
        Updates encoded attributes of a dict with human-readable attributes.
        For example:
        { "myLg==attribute": True } => { "my.attribute": True }

        :param d: dict
        :return: dict
        """

        for key, value in list(d.items()):
            if type(value) == list:
                value = [cls.to_readable_dict(e)
                         if type(e) == dict else e for e in value]
            elif type(value) == dict:
                value = cls.to_readable_dict(value)

            if cls._is_attribute_encoded(key):
                del d[key]
                d[cls.decode(key)] = value

        return d

    @classmethod
    def decode(cls, key):
        """
        Replace base64-encoded characters not allowed in Mongo keys with their
        original representations

        :param key: string
        :return: string
        """
        for pattern, repl in cls.DECODING_SUBSTITUTIONS:
            key = re.sub(pattern, repl, key)
        return key

    @classmethod
    def _is_attribute_encoded(cls, key):
        """
        Checks if an attribute has been encoded when saved in Mongo.

        :param key: string
        :return: string
        """
        return (
            key not in cls.KEY_WHITELIST and (
                key.startswith('JA==') or
                    key.count('Lg==') > 0
            )
        )
