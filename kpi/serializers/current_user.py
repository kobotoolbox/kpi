import datetime
from zoneinfo import ZoneInfo

import constance
from django.conf import settings
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as t
from rest_framework import serializers
from rest_framework.reverse import reverse

from hub.models import ExtraUserDetail
from kobo.apps.accounts.serializers import SocialAccountSerializer
from kobo.apps.constance_backends.utils import to_python_object
from kobo.apps.kobo_auth.shortcuts import User
from kpi.fields import WritableJSONField
from kpi.utils.gravatar_url import gravatar_url
from kpi.utils.object_permission import get_database_user


class CurrentUserSerializer(serializers.ModelSerializer):

    server_time = serializers.SerializerMethodField()
    date_joined = serializers.SerializerMethodField()
    projects_url = serializers.SerializerMethodField()
    gravatar = serializers.SerializerMethodField()
    extra_details = WritableJSONField(source='extra_details.data')
    current_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, required=False)
    git_rev = serializers.SerializerMethodField()
    social_accounts = SocialAccountSerializer(
        source='socialaccount_set', many=True, read_only=True
    )
    validated_password = serializers.SerializerMethodField()
    accepted_tos = serializers.SerializerMethodField()
    organization = serializers.SerializerMethodField()

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
            'social_accounts',
            'validated_password',
            'accepted_tos',
            'organization',
        )
        read_only_fields = (
            'email',
            'accepted_tos',
        )

    def get_accepted_tos(self, obj: User) -> bool:
        """
        Verifies user acceptance of terms of service (tos) by checking that the tos
        endpoint was called and stored the current time in the `private_data` property
        """
        try:
            user_extra_details = obj.extra_details
        except obj.extra_details.RelatedObjectDoesNotExist:
            return False
        accepted_tos = (
            'last_tos_accept_time' in user_extra_details.private_data.keys()
        )
        return accepted_tos

    def get_date_joined(self, obj):
        return obj.date_joined.astimezone(ZoneInfo('UTC')).strftime(
            '%Y-%m-%dT%H:%M:%SZ'
        )

    def get_git_rev(self, obj):
        request = self.context.get('request', False)
        if constance.config.EXPOSE_GIT_REV or (
            request and request.user.is_superuser
        ):
            return settings.GIT_REV
        else:
            return False

    def get_gravatar(self, obj):
        return gravatar_url(obj.email)

    def get_organization(self, obj):
        user = get_database_user(obj)
        request = self.context.get('request')

        if not user.organization:
            return {}
        return {
            'url': reverse(
                'organizations-detail',
                kwargs={'id': user.organization.id},
                request=request,
            ),
            'name': user.organization.name,
            'uid': user.organization.id,
        }

    def get_projects_url(self, obj):
        return '/'.join((settings.KOBOCAT_URL, obj.username))

    def get_server_time(self, obj):
        # Currently unused on the front end
        return datetime.datetime.now(tz=ZoneInfo('UTC')).strftime(
            '%Y-%m-%dT%H:%M:%SZ'
        )

    def get_validated_password(self, obj):
        try:
            extra_details = obj.extra_details
        except obj.extra_details.RelatedObjectDoesNotExist:
            # validated_password defaults to True and only becomes False if set
            # by an administrator. If extra_details does not exist, then
            # there's no way the administrator ever intended validated_password
            # to be False for this user
            return True

        return extra_details.validated_password

    def to_representation(self, obj):
        if obj.is_anonymous:
            return {'message': 'user is not logged in'}

        rep = super().to_representation(obj)
        if (
            not rep['extra_details']
            or not isinstance(rep['extra_details'], dict)
        ):
            rep['extra_details'] = {}
        extra_details = rep['extra_details']

        # the front end used to set `primarySector` but has since been changed
        # to `sector`, which matches the registration form
        if (
            extra_details.get('primarySector')
            and not extra_details.get('sector')
        ):
            extra_details['sector'] = extra_details['primarySector']

        # remove `primarySector` to avoid confusion
        try:
            del extra_details['primarySector']
        except KeyError:
            pass

        # TODO Remove `require_auth` when front end do not use it anymore.
        #   It is not used anymore by back end. Still there for retro-compatibility
        extra_details['require_auth'] = True

        return rep

    def validate(self, attrs):
        if not self.instance:
            return attrs

        current_password = attrs.pop('current_password', False)
        new_password = attrs.get('new_password', False)

        if all((current_password, new_password)):
            if not self.instance.check_password(current_password):
                raise serializers.ValidationError(
                    {'current_password': t('Incorrect current password.')}
                )
            try:
                validate_password(new_password, self.instance)
            except DjangoValidationError as e:
                errors = []
                for validation_errors in e.error_list:
                    for validation_error in validation_errors:
                        errors.append(validation_error)
                raise serializers.ValidationError({'new_password': errors})
        elif any((current_password, new_password)):
            not_empty_field_name = (
                'current_password' if current_password else 'new_password'
            )
            empty_field_name = (
                'current_password' if new_password else 'new_password'
            )
            raise serializers.ValidationError(
                {
                    empty_field_name: t(
                        '`current_password` and `new_password` must both be'
                        f' sent together; `{not_empty_field_name}` cannot be'
                        ' sent individually.'
                    )
                }
            )

        return attrs

    def validate_extra_details(self, value):
        desired_metadata_fields = to_python_object(
            constance.config.USER_METADATA_FIELDS
        )

        # If the organization type is the special string 'none', then ignore
        # the required-ness of other organization-related fields
        desired_metadata_dict = {r['name']: r for r in desired_metadata_fields}
        if (
            'organization_type' in desired_metadata_dict
            and value.get('organization_type') == 'none'
        ):
            for field in 'organization', 'organization_website':
                metadata_field = desired_metadata_dict.get(field)
                if not metadata_field:
                    continue
                metadata_field['required'] = False

        if not (errors := self._validate_organization(value)):
            for field in desired_metadata_fields:
                if not field['required']:
                    continue
                try:
                    field_value = value[field['name']]
                except KeyError:
                    # If the field is absent from the request, the old value will
                    # be retained, and no validation needs to take place
                    continue
                if not field_value:
                    # Use verbatim message from DRF to avoid giving translators
                    # more busy work
                    errors[field['name']] = t('This field may not be blank.')

        if errors:
            raise serializers.ValidationError(errors)

        return value

    def update(self, instance, validated_data):

        # "The `.update()` method does not support writable dotted-source
        # fields by default." --DRF
        extra_details = validated_data.pop('extra_details', False)
        new_password = validated_data.get('new_password', False)

        extra_details_obj = None
        with transaction.atomic():
            if extra_details:
                extra_details_obj, _ = ExtraUserDetail.objects.get_or_create(
                    user=instance
                )

                # This is a PATCH, so retain existing values for keys that were
                # not included in the request
                extra_details_obj.data.update(extra_details['data'])

            if new_password:
                instance.set_password(new_password)
                instance.save()
                request = self.context.get('request', False)
                if request:
                    update_session_auth_hash(request, instance)

                # If `extra_details_obj` does not already exist, let's retrieve
                # (or create) it to track password changes
                if not extra_details_obj:
                    extra_details_obj, _ = ExtraUserDetail.objects.get_or_create(
                        user=instance
                    )
                extra_details_obj.password_date_changed = timezone.now()
                extra_details_obj.validated_password = True

            # if `extra_details_obj` exists, it needs to be saved to persist
            # user's extra details changes.
            if extra_details_obj:
                extra_details_obj.save()

            return super().update(instance, validated_data)

    def _validate_organization(self, extra_details: dict):
        user = self.instance
        if not user.organization.is_mmo:
            return {}

        errors = {}
        for field_name in ['organization', 'organization_website', 'organization_type']:
            if extra_details.get(field_name, False) is not False:
                errors[field_name] = t('This action is not allowed.')

        return errors
