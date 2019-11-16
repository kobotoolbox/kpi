# coding: utf-8
from django.contrib.auth.models import Permission, User
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.fields.relative_prefix_hyperlinked_related import \
    RelativePrefixHyperlinkedRelatedField
from kpi.models.collection import Collection
from kpi.models.object_permission import ObjectPermission


class CollectionPermissionAssignmentSerializer(serializers.ModelSerializer):

    url = serializers.SerializerMethodField()
    user = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail',
        lookup_field='username',
        queryset=User.objects.all(),
        style={'base_template': 'input.html'}  # Render as a simple text box
    )
    permission = RelativePrefixHyperlinkedRelatedField(
        view_name='permission-detail',
        lookup_field='codename',
        queryset=Permission.objects.all(),
        style={'base_template': 'input.html'}  # Render as a simple text box
    )

    class Meta:
        model = ObjectPermission
        fields = (
            'url',
            'user',
            'permission'
        )

        read_only_fields = ('uid', )

    def create(self, validated_data):
        user = validated_data['user']
        collection = validated_data['collection']
        if collection.owner_id == user.id:
            raise serializers.ValidationError({
                'user': "Owner's permissions cannot be assigned explicitly"})
        permission = validated_data['permission']
        return collection.assign_perm(user, permission.codename)

    def get_url(self, object_permission):
        collection_uid = self.context.get('collection_uid')
        return reverse('collection-permission-assignment-detail',
                       args=(collection_uid, object_permission.uid),
                       request=self.context.get('request', None))

    def validate_permission(self, permission):
        """
        Checks if permission can be assigned on asset.
        """
        if not self._validate_permission(permission.codename):
            raise serializers.ValidationError(
                '{} cannot be assigned explicitly to Asset objects.'.format(
                    permission.codename))
        return permission

    def _validate_permission(self, codename, suffix=None):
        """
        Validates if `codename` can be assigned on `Collection`s.
        Search can be restricted to assignable codenames which end with `prefix`

        :param codename: str. See `Collection.ASSIGNABLE_PERMISSIONS
        :param suffix: str.
        :return: bool.
        """
        return (codename in Collection.get_assignable_permissions(with_partial=True)
                and (suffix is None or codename.endswith(suffix)))

    def __get_permission_hyperlink(self, codename):
        """
        Builds permission hyperlink representation.
        :param codename: str
        :return: str. url
        """
        return reverse('permission-detail',
                       args=(codename,),
                       request=self.context.get('request', None))


class CollectionBulkInsertPermissionSerializer(CollectionPermissionAssignmentSerializer):

    class Meta:
        model = ObjectPermission
        fields = (
            'user',
            'permission',
        )
