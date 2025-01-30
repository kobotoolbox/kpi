# coding: utf-8
import json

from django.utils.translation import gettext as t
from rest_framework import serializers
from rest_framework.exceptions import ParseError

from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kpi.utils.mongo_helper import MongoHelper


class DataSerializer(serializers.HyperlinkedModelSerializer):

    url = serializers.HyperlinkedIdentityField(
        view_name='data-list', lookup_field='pk')

    class Meta:
        model = XForm
        fields = ('id', 'id_string', 'title', 'description', 'url')
        lookup_field = 'pk'


class DataListSerializer(serializers.Serializer):

    class Meta:
        fields = '__all__'

    def to_representation(self, obj):
        request = self.context.get('request')

        if not isinstance(obj, XForm):
            return super().to_representation(obj)

        query_params = (request and request.query_params) or {}
        query = {
            ParsedInstance.USERFORM_ID:
            '%s_%s' % (obj.user.username, obj.id_string)
        }
        limit = query_params.get('limit', False)
        start = query_params.get('start', False)
        count = query_params.get('count', False)

        try:
            query.update(json.loads(query_params.get('query', '{}')))
        except ValueError:
            raise ParseError(t("Invalid query: %(query)s"
                             % {'query': query_params.get('query')}))

        query_kwargs = {
            'query': json.dumps(query),
            'fields': query_params.get('fields'),
            'sort': query_params.get('sort')
        }

        # if we want the count, we don't kwow to paginate the records.
        # start and limit are useless then.
        if count:
            query_kwargs['count'] = True
        else:
            if limit:
                query_kwargs['limit'] = int(limit)

            if start:
                query_kwargs['start'] = int(start)

        cursor = ParsedInstance.query_mongo_minimal(**query_kwargs)

        # if we want the count, we only need the first index of the list.
        if count:
            return cursor[0]
        else:
            return [MongoHelper.to_readable_dict(record) for record in cursor]


class DataInstanceSerializer(serializers.Serializer):

    class Meta:
        fields = '__all__'

    def to_representation(self, obj):
        if not hasattr(obj, 'xform'):
            return super().to_representation(obj)

        request = self.context.get('request')
        query_params = (request and request.query_params) or {}
        query = {
            ParsedInstance.USERFORM_ID:
            '%s_%s' % (obj.xform.user.username, obj.xform.id_string),
            '_id': obj.pk
        }
        query_kwargs = {
            'query': json.dumps(query),
            'fields': query_params.get('fields'),
            'sort': query_params.get('sort')
        }
        cursor = ParsedInstance.query_mongo_minimal(**query_kwargs)
        records = list(record for record in cursor)

        returned_dict = (len(records) and records[0]) or records
        return MongoHelper.to_readable_dict(returned_dict)


class SubmissionSerializer(serializers.Serializer):

    class Meta:
        fields = '__all__'

    def to_representation(self, obj):
        if not hasattr(obj, 'xform'):
            return super().to_representation(obj)

        message = self.context.get(
            'confirmation_message', t('Successful submission.')
        )
        return {
            'message': message,
            'formid': obj.xform.id_string,
            'encrypted': obj.xform.encrypted,
            'instanceID': 'uuid:%s' % obj.uuid,
            'submissionDate': obj.date_created.isoformat(),
            'markedAsCompleteDate': obj.date_modified.isoformat()
        }
