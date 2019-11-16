# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.fields import RelativePrefixHyperlinkedRelatedField, \
    SerializerMethodFileField, WritableJSONField
from kpi.models import AssetFile


class AssetFileSerializer(serializers.ModelSerializer):
    uid = serializers.ReadOnlyField()
    url = serializers.SerializerMethodField()
    asset = RelativePrefixHyperlinkedRelatedField(
        view_name='asset-detail', lookup_field='uid', read_only=True)
    user = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail', lookup_field='username', read_only=True)
    user__username = serializers.ReadOnlyField(source='user.username')
    file_type = serializers.ChoiceField(choices=AssetFile.TYPE_CHOICES)
    name = serializers.CharField()
    date_created = serializers.ReadOnlyField()
    content = SerializerMethodFileField()
    metadata = WritableJSONField(required=False)

    def get_url(self, obj):
        return reverse('asset-file-detail',
                       args=(obj.asset.uid, obj.uid),
                       request=self.context.get('request', None))

    def get_content(self, obj, *args, **kwargs):
        return reverse('asset-file-content',
                       args=(obj.asset.uid, obj.uid),
                       request=self.context.get('request', None))

    class Meta:
        model = AssetFile
        fields = (
            'uid',
            'url',
            'asset',
            'user',
            'user__username',
            'file_type',
            'name',
            'date_created',
            'content',
            'metadata',
        )
