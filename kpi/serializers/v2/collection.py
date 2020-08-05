# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.fields import RelativePrefixHyperlinkedRelatedField, PaginatedApiField
from kpi.models import Asset
from kpi.models import Collection
from kpi.models import CollectionChildrenQuerySet
from kpi.utils.object_permission_helper import ObjectPermissionHelper

from .asset import AssetListSerializer
from .ancestor_collections import AncestorCollectionsSerializer
from .collection_permission_assignment import CollectionPermissionAssignmentSerializer


class CollectionChildrenSerializer(serializers.Serializer):
    def to_representation(self, value):
        if isinstance(value, Collection):
            serializer = CollectionListSerializer
        elif isinstance(value, Asset):
            serializer = AssetListSerializer
        else:
            raise Exception('Unexpected child type {}'.format(type(value)))
        return serializer(value, context=self.context).data


class CollectionSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid', view_name='collection-detail')
    owner = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail',
        lookup_field='username',
        read_only=True
    )
    parent = RelativePrefixHyperlinkedRelatedField(
        lookup_field='uid',
        required=False,
        view_name='collection-detail',
        queryset=Collection.objects.all()
    )
    owner__username = serializers.ReadOnlyField(source='owner.username')
    # ancestors are ordered from farthest to nearest
    ancestors = AncestorCollectionsSerializer(
        many=True, read_only=True, source='get_ancestors_or_none')
    children = PaginatedApiField(
        serializer_class=CollectionChildrenSerializer,
        # "The value `source='*'` has a special meaning, and is used to indicate
        # that the entire object should be passed through to the field"
        # (http://www.django-rest-framework.org/api-guide/fields/#source).
        source='*',
        source_processor=lambda source: CollectionChildrenQuerySet(
            source
        ).optimize_for_list()
    )

    permissions = serializers.SerializerMethodField()
    downloads = serializers.SerializerMethodField()
    tag_string = serializers.CharField(required=False)
    access_type = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = ('name',
                  'uid',
                  'kind',
                  'url',
                  'parent',
                  'owner',
                  'owner__username',
                  'downloads',
                  'date_created',
                  'date_modified',
                  'ancestors',
                  'children',
                  'permissions',
                  'access_type',
                  'discoverable_when_public',
                  'tag_string',)
        lookup_field = 'uid'
        extra_kwargs = {
            'assets': {
                'lookup_field': 'uid',
            },
            'uid': {
                'read_only': True,
            },
        }

    def _get_tag_names(self, obj):
        return obj.tags.names()

    def get_downloads(self, obj):
        request = self.context.get('request', None)
        obj_url = reverse(
            'collection-detail', args=(obj.uid,), request=request)
        return [
            {'format': 'zip', 'url': '%s?format=zip' % obj_url},
        ]

    def get_access_type(self, obj):
        try:
            request = self.context['request']
        except KeyError:
            return None
        if request.user == obj.owner:
            return 'owned'
        # `obj.permissions.filter(...).exists()` would be cleaner, but it'd
        # cost a query. This ugly loop takes advantage of having already called
        # `prefetch_related()`
        for permission in obj.permissions.all():
            if not permission.deny and permission.user == request.user:
                return 'shared'
        for subscription in obj.usercollectionsubscription_set.all():
            # `usercollectionsubscription_set__user` is not prefetched
            if subscription.user_id == request.user.pk:
                return 'subscribed'
        if obj.discoverable_when_public:
            return 'public'
        if request.user.is_superuser:
            return 'superuser'
        raise Exception('{} has unexpected access to {}'.format(
            request.user.username, obj.uid))

    def get_permissions(self, obj):
        context = self.context
        request = self.context.get('request')
        queryset = ObjectPermissionHelper.get_user_permission_assignments_queryset(obj,
                                                                        request.user)
        # Need to pass `collection` and `collection_uid` to context of
        # `CollectionPermissionAssignmentSerializer` serializer to avoid extra queries to DB
        # within the serializer to retrieve the asset object.
        context.update({'collection': obj})
        context.update({'collection_uid': obj.uid})

        return CollectionPermissionAssignmentSerializer(queryset.all(),
                                                        many=True, read_only=True,
                                                        context=context).data


class CollectionListSerializer(CollectionSerializer):
    children_count = serializers.SerializerMethodField()
    assets_count = serializers.SerializerMethodField()

    def get_children_count(self, obj):
        return obj.children.count()

    def get_assets_count(self, obj):
        return Asset.objects.filter(parent=obj).only('pk').count()
        return obj.assets.count()

    class Meta(CollectionSerializer.Meta):
        fields = ('name',
                  'uid',
                  'kind',
                  'url',
                  'parent',
                  'owner',
                  'children_count',
                  'assets_count',
                  'owner__username',
                  'date_created',
                  'date_modified',
                  'permissions',
                  'access_type',
                  'discoverable_when_public',
                  'tag_string',)
