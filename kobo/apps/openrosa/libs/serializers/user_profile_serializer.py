# coding: utf-8
from rest_framework import serializers

from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.libs.constants import CAN_VIEW_PROFILE
from kobo.apps.openrosa.libs.serializers.fields.json_field import JsonField


class UserProfileSerializer(serializers.Serializer):
    id = serializers.ReadOnlyField(source='user.id')
    username = serializers.ReadOnlyField(source='user.username')
    name = serializers.ReadOnlyField()
    email = serializers.ReadOnlyField(source='user.email')
    city = serializers.ReadOnlyField()
    country = serializers.ReadOnlyField()
    organization = serializers.ReadOnlyField()
    website = serializers.ReadOnlyField(source='home_page')
    twitter = serializers.ReadOnlyField()
    gravatar = serializers.ReadOnlyField()
    require_auth = serializers.ReadOnlyField()

    class Meta:
        model = UserProfile

        fields = (
            'id',
            'username',
            'name',
            'email',
            'city',
            'country',
            'organization',
            'website',
            'twitter',
            'gravatar',
            'require_auth',
        )

    def to_representation(self, obj):
        """
        Serialize objects -> primitives.
        """
        ret = super().to_representation(obj)

        request = self.context['request'] \
            if 'request' in self.context else None

        if 'email' in ret and request is None or request.user \
                and not request.user.has_perm(CAN_VIEW_PROFILE, obj):
            del ret['email']

        return ret


class UserProfileWithTokenSerializer(UserProfileSerializer):
    api_token = serializers.SerializerMethodField()
    temp_token = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            'id',
            'username',
            'name',
            'email',
            'city',
            'country',
            'organization',
            'website',
            'twitter',
            'gravatar',
            'require_auth',
            'user',
            'api_token',
            'temp_token',
        )

    def get_api_token(self, object):
        return object.user.auth_token.key

    def get_temp_token(self, object):
        request = self.context['request']
        session_key = None
        if request:
            session = request.session
            session_key = session.session_key

        return session_key
