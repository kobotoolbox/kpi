from rest_framework import serializers
from taggit.models import Tag

from kpi.models import TagUid


class TagListSerializer(serializers.ModelSerializer):
    uid = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = ('name', 'uid')

    def get_uid(self, obj):
        # `OneToOneField` doesn't guarantee that one `TagUid` exists for every
        # `Tag`
        tag_uid, _ = TagUid.objects.get_or_create(tag=obj)
        return tag_uid.uid
