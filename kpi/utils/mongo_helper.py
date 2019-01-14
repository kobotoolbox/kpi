# -*- coding: utf-8 -*-
import re
import base64


class MongoDecodingHelper(object):
    """
    Stripped-down version of KoBoCAT's
    onadata.apps.api.mongo_helper.MongoHelper for decoding only.
    """

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


class MongoHelper(object):

    KEY_WHITELIST = ["sort", "limit", "start", "query"]

    def parse(cls, dict_to_parse):
        pass

    # @classmethod
    # @apply_form_field_names
    # def query_mongo_minimal(
    #         cls, query, fields, sort, start=0, limit=DEFAULT_LIMIT,
    #         count=False, hide_deleted=True):
    #
    #     cursor = cls._get_mongo_cursor(query, fields, hide_deleted)
    #
    #     if count:
    #         return [{"count": cursor.count()}]
    #
    #     if isinstance(sort, basestring):
    #         sort = json.loads(sort, object_hook=json_util.object_hook)
    #     sort = sort if sort else {}
    #
    #     if start < 0 or limit < 0:
    #         raise ValueError(_("Invalid start/limit params"))
    #
    #     if limit > cls.DEFAULT_LIMIT:
    #         limit = cls.DEFAULT_LIMIT
    #
    #     return cls._get_paginated_and_sorted_cursor(cursor, start, limit, sort)
    #
    # @classmethod
    # @apply_form_field_names
    # def query_mongo_no_paging(cls, query, fields, count=False, hide_deleted=True):
    #
    #     cursor = cls._get_mongo_cursor(query, fields, hide_deleted)
    #
    #     if count:
    #         return [{"count": cursor.count()}]
    #     else:
    #         return cursor
    #
    # @classmethod
    # def _get_mongo_cursor(cls, query, fields, hide_deleted, username=None, id_string=None):
    #     """
    #     Returns a Mongo cursor based on the query.
    #
    #     :param query: JSON string
    #     :param fields: Array string
    #     :param hide_deleted: boolean
    #     :param username: string
    #     :param id_string: string
    #     :return: pymongo Cursor
    #     """
    #     fields_to_select = {cls.USERFORM_ID: 0}
    #     # TODO: give more detailed error messages to 3rd parties
    #     # using the API when json.loads fails
    #     if isinstance(query, basestring):
    #         query = json.loads(query, object_hook=json_util.object_hook)
    #     query = query if query else {}
    #     query = MongoHelper.to_safe_dict(query, reading=True)
    #
    #     if username and id_string:
    #         query[cls.USERFORM_ID] = u'%s_%s' % (username, id_string)
    #         # check if query contains and _id and if its a valid ObjectID
    #         if '_uuid' in query and ObjectId.is_valid(query['_uuid']):
    #             query['_uuid'] = ObjectId(query['_uuid'])
    #
    #     if hide_deleted:
    #         # display only active elements
    #         # join existing query with deleted_at_query on an $and
    #         query = {"$and": [query, {"_deleted_at": None}]}
    #
    #     # fields must be a string array i.e. '["name", "age"]'
    #     if isinstance(fields, basestring):
    #         fields = json.loads(fields, object_hook=json_util.object_hook)
    #     fields = fields if fields else []
    #
    #     # TODO: current mongo (2.0.4 of this writing)
    #     # cant mix including and excluding fields in a single query
    #     if type(fields) == list and len(fields) > 0:
    #         fields_to_select = dict(
    #             [(MongoHelper.encode(field), 1) for field in fields])
    #
    #     return xform_instances.find(query, fields_to_select)
    #
    # @classmethod
    # def _get_paginated_and_sorted_cursor(cls, cursor, start, limit, sort):
    #     """
    #     Applies pagination and sorting on mongo cursor.
    #
    #     :param mongo_cursor: pymongo.cursor.Cursor
    #     :param start: integer
    #     :param limit: integer
    #     :param sort: dict
    #     :return: pymongo.cursor.Cursor
    #     """
    #     cursor.skip(start).limit(limit)
    #
    #     if type(sort) == dict and len(sort) == 1:
    #         sort = MongoHelper.to_safe_dict(sort, reading=True)
    #         sort_key = sort.keys()[0]
    #         sort_dir = int(sort[sort_key])  # -1 for desc, 1 for asc
    #         cursor.sort(sort_key, sort_dir)
    #
    #     # set batch size
    #     cursor.batch_size = cls.DEFAULT_BATCHSIZE
    #     return cursor
