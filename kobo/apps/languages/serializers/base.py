# coding: utf-8
from collections import defaultdict, OrderedDict

from django.db import models
from rest_framework import serializers


class BaseServiceSerializer(serializers.ModelSerializer):

    class Meta:
        fields = [
            'name',
            'code',
        ]


class BaseServiceLanguageM2MSerializer(serializers.ModelSerializer):

    region = serializers.SerializerMethodField()
    service = serializers.SerializerMethodField()
    language = serializers.SerializerMethodField()

    class Meta:
        fields = '__all__'

    def get_list_serializer_class(self):
        pass

    def get_region(self, through_instance):
        if through_instance.region:
            return through_instance.region.code
        return None

    def get_service(self, through_instance):
        return through_instance.service.code

    def get_language(self, through_instance):
        return through_instance.language.code


class BaseServiceLanguageM2MListSerializer(serializers.ListSerializer):

    # Force `ListSerializer` to return a dict, not a list
    @property
    def data(self):
        ret = serializers.BaseSerializer.data.fget(self)
        return serializers.ReturnDict(ret, serializer=self)

    def to_representation(self, data):
        """
        Override `ListSerializer` behaviour to display services as a dictionary
        instead of a list
        """
        iterable = data.all() if isinstance(data, models.Manager) else data
        formatted_data = self._get_formatted_data(iterable)
        return formatted_data
