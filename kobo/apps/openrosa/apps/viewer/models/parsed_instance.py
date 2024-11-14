import json

from bson import json_util
from dateutil import parser
from django.conf import settings
from django.db import models
from django.utils.translation import gettext as t
from pymongo.errors import PyMongoError

from kobo.apps.hook.utils.services import call_services
from kobo.apps.openrosa.apps.logger.models import Instance, Note
from kobo.apps.openrosa.libs.utils.common_tags import (
    ATTACHMENTS,
    GEOLOCATION,
    ID,
    MONGO_STRFTIME,
    NOTES,
    SUBMISSION_TIME,
    SUBMITTED_BY,
    TAGS,
    UUID,
    VALIDATION_STATUS,
)
from kobo.apps.openrosa.libs.utils.decorators import apply_form_field_names
from kobo.apps.openrosa.libs.utils.model_tools import queryset_iterator
from kobo.celery import celery_app
from kpi.utils.log import logging
from kpi.utils.mongo_helper import MongoHelper

# this is Mongo Collection where we will store the parsed submissions
xform_instances = settings.MONGO_DB.instances
DATETIME_FORMAT = '%Y-%m-%dT%H:%M:%S'


class ParseError(Exception):
    pass


def datetime_from_str(text):
    # Assumes text looks like 2011-01-01T09:50:06.966
    if text is None:
        return None
    dt = None
    try:
        dt = parser.parse(text)
    except Exception:
        return None
    return dt


@celery_app.task
def update_mongo_instance(record):
    # since our dict always has an id, save will always result in an upsert op
    # - so we dont need to worry whether its an edit or not
    # https://api.mongodb.com/python/current/api/pymongo/collection.html#pymongo.collection.Collection.replace_one
    try:
        xform_instances.replace_one({'_id': record['_id']}, record, upsert=True)
    except PyMongoError as e:
        raise Exception('Submission could not be saved to Mongo') from e
    return True


class ParsedInstance(models.Model):
    USERFORM_ID = '_userform_id'
    STATUS = '_status'
    DEFAULT_LIMIT = 30000
    DEFAULT_BATCHSIZE = 1000

    instance = models.OneToOneField(
        Instance, related_name='parsed_instance', on_delete=models.CASCADE
    )
    start_time = models.DateTimeField(null=True)
    end_time = models.DateTimeField(null=True)
    # TODO: decide if decimal field is better than float field.
    lat = models.FloatField(null=True)
    lng = models.FloatField(null=True)

    class Meta:
        app_label = 'viewer'

    @classmethod
    def get_base_query(cls, username, id_string):
        userform_id = '{}_{}'.format(username, id_string)
        return {
            cls.USERFORM_ID: userform_id
        }

    @classmethod
    @apply_form_field_names
    def query_mongo(cls, username, id_string, query, fields, sort, start=0,
                    limit=DEFAULT_LIMIT, count=False):

        query = cls._get_mongo_cursor_query(query, username, id_string)

        if count:
            return [
                {
                    'count': xform_instances.count_documents(
                        query, maxTimeMS=MongoHelper.get_max_time_ms()
                    )
                }
            ]

        cursor = cls._get_mongo_cursor(query, fields)

        if isinstance(sort, str):
            sort = json.loads(sort, object_hook=json_util.object_hook)
        sort = sort if sort else {}

        if start < 0 or limit < 0:
            raise ValueError(t('Invalid start/limit params'))

        return cls._get_paginated_and_sorted_cursor(cursor, start, limit, sort)

    @classmethod
    @apply_form_field_names
    def mongo_aggregate(cls, query, pipeline):
        """Perform mongo aggregate queries
        query - is a dict which is to be passed to $match, a pipeline operator
        pipeline - list of dicts or dict of mongodb pipeline operators,
        http://docs.mongodb.org/manual/reference/operator/aggregation-pipeline
        """
        if isinstance(query, str):
            query = json.loads(
                query, object_hook=json_util.object_hook) if query else {}
        if not (isinstance(pipeline, dict) or isinstance(pipeline, list)):
            raise Exception(t('Invalid pipeline! %s' % pipeline))
        if not isinstance(query, dict):
            raise Exception(t('Invalid query! %s' % query))
        query = MongoHelper.to_safe_dict(query)
        k = [{'$match': query}]
        if isinstance(pipeline, list):
            k.extend(pipeline)
        else:
            k.append(pipeline)
        results = xform_instances.aggregate(k)
        return results['result']

    @classmethod
    @apply_form_field_names
    def query_mongo_minimal(
            cls, query, fields, sort, start=0, limit=DEFAULT_LIMIT,
            count=False):

        query = cls._get_mongo_cursor_query(query)

        if count:
            return [
                {
                    'count': xform_instances.count_documents(
                        query, maxTimeMS=MongoHelper.get_max_time_ms()
                    )
                }
            ]

        cursor = cls._get_mongo_cursor(query, fields)

        if isinstance(sort, str):
            sort = json.loads(sort, object_hook=json_util.object_hook)
        sort = sort if sort else {}

        if start < 0 or limit < 0:
            raise ValueError(t('Invalid start/limit params'))

        if limit > cls.DEFAULT_LIMIT:
            limit = cls.DEFAULT_LIMIT

        return cls._get_paginated_and_sorted_cursor(cursor, start, limit, sort)

    @classmethod
    @apply_form_field_names
    def query_mongo_no_paging(cls, query, fields, count=False):

        query = cls._get_mongo_cursor_query(query)

        if count:
            return [
                {
                    'count': xform_instances.count_documents(
                        query, maxTimeMS=MongoHelper.get_max_time_ms()
                    )
                }
            ]

        return cls._get_mongo_cursor(query, fields)

    @classmethod
    def _get_mongo_cursor(cls, query, fields):
        """
        Returns a Mongo cursor based on the query.

        :param query: JSON string
        :param fields: Array string
        :return: pymongo Cursor
        """
        fields_to_select = {cls.USERFORM_ID: 0}

        # fields must be a string array i.e. '["name", "age"]'
        if isinstance(fields, str):
            fields = json.loads(fields, object_hook=json_util.object_hook)
        fields = fields if fields else []

        # TODO: current mongo (3.4 of this writing)
        # cannot mix including and excluding fields in a single query
        if type(fields) == list and len(fields) > 0:
            fields_to_select = dict(
                [(MongoHelper.encode(field), 1) for field in fields])

        return xform_instances.find(
            query,
            fields_to_select,
            max_time_ms=MongoHelper.get_max_time_ms(),
        )

    @classmethod
    def _get_mongo_cursor_query(cls, query, username=None, id_string=None):
        """
        Returns the query to get a Mongo cursor.

        :param query: JSON string
        :param username: string
        :param id_string: string
        :return: dict
        """
        # TODO: give more detailed error messages to 3rd parties
        # using the API when json.loads fails
        if isinstance(query, str):
            query = json.loads(query, object_hook=json_util.object_hook)
        query = query if query else {}
        query = MongoHelper.to_safe_dict(query, reading=True)

        if username and id_string:
            query.update(cls.get_base_query(username, id_string))

        return query

    @classmethod
    def _get_paginated_and_sorted_cursor(cls, cursor, start, limit, sort):
        """
        Applies pagination and sorting on mongo cursor.

        :param cursor: pymongo.cursor.Cursor
        :param start: integer
        :param limit: integer
        :param sort: dict
        :return: pymongo.cursor.Cursor
        """
        cursor.skip(start).limit(limit)

        if type(sort) == dict and len(sort) == 1:
            sort = MongoHelper.to_safe_dict(sort, reading=True)
            sort_key = list(sort)[0]
            sort_dir = int(sort[sort_key])  # -1 for desc, 1 for asc
            cursor.sort(sort_key, sort_dir)

        # set batch size
        cursor.batch_size = cls.DEFAULT_BATCHSIZE
        return cursor

    def to_dict_for_mongo(self):
        d = self.to_dict()

        userform_id = (
            self.instance.xform.mongo_uuid
            if self.instance.xform.mongo_uuid
            else f'{self.instance.xform.user.username}_{self.instance.xform.id_string}'
        )

        data = {
            UUID: self.instance.uuid,
            ID: self.instance.id,
            self.USERFORM_ID: userform_id,
            ATTACHMENTS: _get_attachments_from_instance(self.instance),
            self.STATUS: self.instance.status,
            GEOLOCATION: [self.lat, self.lng],
            SUBMISSION_TIME: self.instance.date_created.strftime(
                MONGO_STRFTIME),
            TAGS: list(self.instance.tags.names()),
            NOTES: self.get_notes(),
            VALIDATION_STATUS: self.instance.get_validation_status(),
            SUBMITTED_BY: self.instance.user.username
            if self.instance.user else None
        }

        d.update(data)

        return MongoHelper.to_safe_dict(d)

    def update_mongo(self, asynchronous=True):
        d = self.to_dict_for_mongo()
        if d.get('_xform_id_string') is None:
            # if _xform_id_string, Instance could not be parsed.
            # so, we don't update mongo.
            return False
        else:
            if asynchronous:
                # TODO update self.instance after async save is made
                update_mongo_instance.apply_async((), {'record': d})
            else:
                success = update_mongo_instance(d)
                # Only update self.instance is `success` is different from
                # current_value (`self.instance.is_sync_with_mongo`)
                if success != self.instance.is_synced_with_mongo:
                    # Skip the labor-intensive stuff in Instance.save() to gain performance
                    # Use .update() instead of .save()
                    Instance.objects.filter(pk=self.instance.id).update(
                        is_synced_with_mongo=success
                    )

        return True

    @staticmethod
    def bulk_update_validation_statuses(query, validation_status):
        return xform_instances.update_many(
            query,
            {'$set': {VALIDATION_STATUS: validation_status}},
        )

    @staticmethod
    def bulk_delete(query):
        return xform_instances.delete_many(query)

    def to_dict(self):
        if not hasattr(self, '_dict_cache'):
            self._dict_cache = self.instance.get_dict()
        return self._dict_cache

    @classmethod
    def dicts(cls, xform):
        qs = cls.objects.filter(instance__xform=xform)
        for parsed_instance in queryset_iterator(qs):
            yield parsed_instance.to_dict()

    def _get_name_for_type(self, type_value):
        """
        We cannot assume that start time and end times always use the same
        XPath. This is causing problems for other peoples' forms.

        This is a quick fix to determine from the original XLSForm's JSON
        representation what the 'name' was for a given
        type_value ('start' or 'end')
        """
        datadict = json.loads(self.instance.xform.json)
        for item in datadict['children']:
            if type(item) == dict and item.get('type') == type_value:
                return item['name']

    def get_data_dictionary(self):
        # TODO: fix hack to get around a circular import
        from kobo.apps.openrosa.apps.viewer.models.data_dictionary import DataDictionary
        return DataDictionary.objects.get(
            user=self.instance.xform.user,
            id_string=self.instance.xform.id_string
        )

    data_dictionary = property(get_data_dictionary)

    # TODO: figure out how much of this code should be here versus
    # data_dictionary.py.
    def _set_geopoint(self):
        if self.instance.point:
            self.lat = self.instance.point.y
            self.lng = self.instance.point.x

    def save(self, asynchronous=False, *args, **kwargs):
        # start/end_time obsolete: originally used to approximate for
        # instanceID, before instanceIDs were implemented
        created = self.pk is None
        self.start_time = None
        self.end_time = None
        self._set_geopoint()
        super().save(*args, **kwargs)

        # insert into Mongo.
        # Signal has been removed because of a race condition.
        # Rest Services were called before data was saved in DB.
        success = self.update_mongo(asynchronous)
        if success and created:
            records = ParsedInstance.objects.filter(
                instance_id=self.instance_id
            ).values_list('instance__xform__kpi_asset_uid', flat=True)
            if not (asset_uid := records[0]):
                if not settings.TESTING:
                    logging.warning(
                        f'ParsedInstance #: {self.pk} - XForm is not linked with Asset'
                    )
            else:
                call_services(asset_uid, self.instance_id)

        return success

    def add_note(self, note):
        note = Note(instance=self.instance, note=note)
        note.save()

    def remove_note(self, pk):
        note = self.instance.notes.get(pk=pk)
        note.delete()

    def get_notes(self):
        notes = []
        note_qs = self.instance.notes.values(
            'id', 'note', 'date_created', 'date_modified')
        for note in note_qs:
            note['date_created'] = \
                note['date_created'].strftime(MONGO_STRFTIME)
            note['date_modified'] = \
                note['date_modified'].strftime(MONGO_STRFTIME)
            notes.append(note)
        return notes


def _get_attachments_from_instance(instance):
    attachments = []
    for a in instance.attachments.all():
        attachment = dict()
        attachment['download_url'] = a.secure_url()
        for suffix in settings.THUMB_CONF.keys():
            attachment['download_{}_url'.format(suffix)] = a.secure_url(suffix)
        attachment['mimetype'] = a.mimetype
        attachment['filename'] = a.media_file.name
        attachment['instance'] = a.instance.pk
        attachment['xform'] = instance.xform.id
        attachment['id'] = a.id
        attachments.append(attachment)

    return attachments
