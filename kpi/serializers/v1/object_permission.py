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
        # TODO: Remove after kobotoolbox/kobocat#642
        # I'm looking forward to the merge conflict this creates, aren't you?
        if getattr(content_object, 'has_deployment', False):
            content_object.deployment.remove_from_kc_only_flag(
                specific_user=user
            )
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
