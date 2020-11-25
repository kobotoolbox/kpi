# coding: utf-8
import datetime
import pytz

import constance
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import User
from django.conf import settings
from django.utils.translation import ugettext as _
from rest_framework import serializers

from hub.models import ExtraUserDetail
from kpi.deployment_backends.kc_access.utils import get_kc_profile_data
from kpi.deployment_backends.kc_access.utils import set_kc_require_auth
from kpi.fields import WritableJSONField
from kpi.utils.gravatar_url import gravatar_url


class CurrentUserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()
    server_time = serializers.SerializerMethodField()
    date_joined = serializers.SerializerMethodField()
    projects_url = serializers.SerializerMethodField()
    gravatar = serializers.SerializerMethodField()
    extra_details = WritableJSONField(source='extra_details.data')
    current_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, required=False)
    git_rev = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'username',
            'first_name',
            'last_name',
            'email',
            'server_time',
            'date_joined',
            'projects_url',
            'is_superuser',
            'gravatar',
            'is_staff',
            'last_login',
            'extra_details',
            'current_password',
            'new_password',
            'git_rev',
        )

    def get_server_time(self, obj):
        # Currently unused on the front end
        return datetime.datetime.now(tz=pytz.UTC).strftime(
            '%Y-%m-%dT%H:%M:%SZ')

    def get_date_joined(self, obj):
        return obj.date_joined.astimezone(pytz.UTC).strftime(
            '%Y-%m-%dT%H:%M:%SZ')

    def get_projects_url(self, obj):
        return '/'.join((settings.KOBOCAT_URL, obj.username))

    def get_gravatar(self, obj):
        return gravatar_url(obj.email)

    def get_git_rev(self, obj):
        request = self.context.get('request', False)
        if constance.config.EXPOSE_GIT_REV or (
            request and request.user.is_superuser
        ):
            return settings.GIT_REV
        else:
            return False

    def to_representation(self, obj):
        if obj.is_anonymous:
            return {'message': 'user is not logged in'}
        rep = super().to_representation(obj)
        if not rep['extra_details']:
            rep['extra_details'] = {}
        # `require_auth` needs to be read from KC every time
        if settings.KOBOCAT_URL and settings.KOBOCAT_INTERNAL_URL:
            rep['extra_details']['require_auth'] = get_kc_profile_data(
                obj.pk).get('require_auth', False)

        return rep

    def validate(self, attrs):
        if self.instance:

            current_password = attrs.pop('current_password', False)
            new_password = attrs.get('new_password', False)

            if all((current_password, new_password)):
                if not self.instance.check_password(current_password):
                    raise serializers.ValidationError({
                        'current_password': _('Incorrect current password.')
                    })
            elif any((current_password, new_password)):
                not_empty_field_name = 'current_password' \
                    if current_password else 'new_password'
                empty_field_name = 'current_password' \
                    if new_password else 'new_password'
                raise serializers.ValidationError({
                    empty_field_name: _('`current_password` and `new_password` '
                                        'must both be sent together; '
                                        f'`{not_empty_field_name}` cannot be '
                                        'sent individually.')
                })

        return attrs

    def update(self, instance, validated_data):

        # "The `.update()` method does not support writable dotted-source
        # fields by default." --DRF
        extra_details = validated_data.pop('extra_details', False)
        if extra_details:
            extra_details_obj, created = ExtraUserDetail.objects.get_or_create(
                user=instance)
            # `require_auth` needs to be written back to KC
            if settings.KOBOCAT_URL and settings.KOBOCAT_INTERNAL_URL and \
                    'require_auth' in extra_details['data']:
                set_kc_require_auth(
                    instance.pk, extra_details['data']['require_auth'])
            extra_details_obj.data.update(extra_details['data'])
            extra_details_obj.save()

        new_password = validated_data.get('new_password', False)
        if new_password:
            instance.set_password(new_password)
            instance.save()
            request = self.context.get('request', False)
            if request:
                update_session_auth_hash(request, instance)

        return super().update(
            instance, validated_data)
