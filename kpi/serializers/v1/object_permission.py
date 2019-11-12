# coding: utf-8
from django.contrib.auth.models import Permission
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from rest_framework import serializers

from kpi.constants import PERM_FROM_KC_ONLY
from kpi.fields import GenericHyperlinkedRelatedField, \
    RelativePrefixHyperlinkedRelatedField
from kpi.models import ObjectPermission


class ObjectPermissionSerializer(serializers.ModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='objectpermission-detail'
    )
    user = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail',
        lookup_field='username',
        queryset=User.objects.all(),
        style={'base_template': 'input.html'}  # Render as a simple text box
    )
    permission = serializers.SlugRelatedField(
        slug_field='codename',
        queryset=Permission.objects.all()
    )
    content_object = GenericHyperlinkedRelatedField(
        lookup_field='uid',
        style={'base_template': 'input.html'}  # Render as a simple text box
    )
    inherited = serializers.ReadOnlyField()

    class Meta:
        model = ObjectPermission
        fields = (
            'uid',
            'kind',
            'url',
            'user',
            'permission',
            'content_object',
            'deny',
            'inherited',
        )
        extra_kwargs = {
            'uid': {
                'read_only': True,
            },
        }

    def create(self, validated_data):
        content_object = validated_data['content_object']
        user = validated_data['user']
        perm = validated_data['permission'].codename
        with transaction.atomic():
            # TEMPORARY Issue #1161: something other than KC is setting a
            # permission; clear the `from_kc_only` flag
            ObjectPermission.objects.filter(
                user=user,
                permission__codename=PERM_FROM_KC_ONLY,
                object_id=content_object.id,
                content_type=ContentType.objects.get_for_model(content_object)
            ).delete()
            return content_object.assign_perm(user, perm)


class ObjectPermissionNestedSerializer(ObjectPermissionSerializer):
    """
    When serializing a list of permissions inside the object to which they are
    assigned, omit `content_object` to improve performance significantly
    """
    class Meta(ObjectPermissionSerializer.Meta):
        fields = (
            'uid',
            'kind',
            'url',
            'user',
            'permission',
            'deny',
            'inherited',
        )
