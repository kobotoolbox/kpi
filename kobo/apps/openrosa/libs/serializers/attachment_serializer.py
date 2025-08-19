# coding: utf-8
import json

from rest_framework import serializers
from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.libs.utils.decorators import check_obj


def dict_key_for_value(_dict, value):
    """
    This function is used to get key by value in a dictionary
    """
    return list(_dict.keys())[list(_dict.values()).index(value)]


def get_path(data, question_name, path_list=None):
    if path_list is None:
        path_list = []

    name = data.get('name')
    if name == question_name:
        return '/'.join(path_list)
    elif data.get('children') is not None:
        for node in data.get('children'):
            path_list.append(node.get('name'))
            path = get_path(node, question_name, path_list)
            if path is not None:
                return path
            else:
                del path_list[len(path_list) - 1]
    return None


class AttachmentSerializer(serializers.ModelSerializer):

    url = serializers.HyperlinkedIdentityField(view_name='attachment-detail',
                                               lookup_field='pk')
    field_xpath = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    small_download_url = serializers.SerializerMethodField()
    medium_download_url = serializers.SerializerMethodField()
    large_download_url = serializers.SerializerMethodField()
    xform = serializers.ReadOnlyField(source='instance.xform.pk')
    instance = serializers.ReadOnlyField(source='instance.pk')
    filename = serializers.ReadOnlyField(source='media_file.name')

    class Meta:
        fields = ('url', 'filename', 'mimetype', 'field_xpath', 'id', 'xform',
                  'instance', 'download_url', 'small_download_url',
                  'medium_download_url', 'large_download_url')
        lookup_field = 'pk'
        model = Attachment

    @check_obj
    def get_download_url(self, obj):
        return obj.secure_url() if obj.media_file.url else None

    def get_small_download_url(self, obj):
        if obj.mimetype.startswith('image'):
            return obj.secure_url('small')

    def get_medium_download_url(self, obj):
        if obj.mimetype.startswith('image'):
            return obj.secure_url('medium')

    def get_large_download_url(self, obj):
        if obj.mimetype.startswith('image'):
            return obj.secure_url('large')

    def get_field_xpath(self, obj):
        qa_dict = obj.instance.get_dict()
        if obj.filename not in qa_dict.values():
            return None

        question_name = dict_key_for_value(qa_dict, obj.filename)
        data = json.loads(obj.instance.xform.json)

        return get_path(data, question_name)
