import datetime
import logging
from zoneinfo import ZoneInfo

import constance
from allauth.socialaccount.models import SocialAccount
from django.conf import settings
from django_request_cache import cache_for_request
from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField

from kobo.apps.accounts.serializers import SocialAccountSerializer
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import ASSET_TYPE_COLLECTION, PERM_DISCOVER_ASSET
from kpi.models.asset import Asset, UserAssetSubscription
from kpi.models.object_permission import ObjectPermission
from kpi.serializers.v2.service_usage import ServiceUsageSerializer
from kpi.utils.gravatar_url import gravatar_url
from kpi.utils.object_permission import get_database_user


class UserSerializer(serializers.HyperlinkedModelSerializer):

    url = HyperlinkedIdentityField(
        lookup_field='username', view_name='user-kpi-detail')
    date_joined = serializers.SerializerMethodField()
    public_collection_subscribers_count = serializers.SerializerMethodField()
    public_collections_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('url',
                  'username',
                  'date_joined',
                  'public_collection_subscribers_count',
                  'public_collections_count',
                  )

    def get_date_joined(self, obj):
        return obj.date_joined.astimezone(ZoneInfo('UTC')).strftime(
            '%Y-%m-%dT%H:%M:%SZ')

    def get_public_collection_subscribers_count(self, user):
        public_collection_ids = self.__get_public_collection_ids(user.pk)
        return UserAssetSubscription.objects.filter(
            asset_id__in=public_collection_ids).exclude(user_id=user.pk).count()

    def get_public_collections_count(self, user):
        public_collection_ids = self.__get_public_collection_ids(user.pk)
        return len(public_collection_ids)

    @staticmethod
    @cache_for_request
    def __get_public_collection_ids(user_id):
        collection_ids = Asset.objects.filter(
            owner_id=user_id, asset_type=ASSET_TYPE_COLLECTION). \
            values_list('id', flat=True)

        # A collection is considered as public when it's shared
        # with `AnonymousUser`.
        return ObjectPermission.objects.filter(
            asset_id__in=collection_ids,
            user_id=settings.ANONYMOUS_USER_ID,
            permission__codename=PERM_DISCOVER_ASSET).values_list('asset_id',
                                                                  flat=True)


class UserListSerializer(UserSerializer):
    extra_details_uid = serializers.SerializerMethodField()
    is_staff = serializers.BooleanField(read_only=True)
    last_login = serializers.SerializerMethodField()
    validated_email = serializers.SerializerMethodField()
    validated_password = serializers.SerializerMethodField()
    mfa_is_active = serializers.SerializerMethodField()
    sso_is_active = serializers.SerializerMethodField()
    accepted_tos = serializers.SerializerMethodField()
    projects_url = serializers.SerializerMethodField()
    gravatar = serializers.SerializerMethodField()
    social_accounts = SocialAccountSerializer(
        source='socialaccount_set', many=True, read_only=True
    )
    organizations = serializers.SerializerMethodField()
    metadata = serializers.SerializerMethodField()
    subscriptions = serializers.SerializerMethodField()
    current_service_usage = serializers.SerializerMethodField()
    asset_count = serializers.SerializerMethodField()
    deployed_asset_count = serializers.SerializerMethodField()
    server_time = serializers.SerializerMethodField()
    git_rev = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = (
            'extra_details_uid',
            'username',
            'first_name',
            'last_name',
            'email',
            'is_superuser',
            'is_staff',
            'is_active',
            'date_joined',
            'last_login',
            'validated_email',
            'validated_password',
            'mfa_is_active',
            'sso_is_active',
            'accepted_tos',
            'url',
            'projects_url',
            'gravatar',
            'social_accounts',
            'organizations',
            'metadata',
            'subscriptions',
            'current_service_usage',
            'asset_count',
            'deployed_asset_count',
            'public_collection_subscribers_count',
            'public_collections_count',
            'server_time',
            'git_rev',
        )

    def get_accepted_tos(self, obj) -> bool:
        """
        Verifies user acceptance of terms of service (tos) by checking that the tos
        endpoint was called and stored the current time in the `private_data` property
        """
        try:
            user_extra_details = obj.extra_details
        except obj.extra_details.RelatedObjectDoesNotExist:
            return False
        accepted_tos = 'last_tos_accept_time' in user_extra_details.private_data.keys()
        return accepted_tos

    def get_asset_count(self, user):
        return user.assets.count()

    def get_current_service_usage(self, user):
        # Cannot access service usage for anonymous users
        if user.username == 'AnonymousUser':
            return None

        serializer = ServiceUsageSerializer(
            instance=get_database_user(user), context=self.context
        )
        return serializer.data

    def get_deployed_asset_count(self, user) -> int:
        return user.assets.filter(_deployment_status='deployed').count()

    def get_extra_details_uid(self, user):
        if hasattr(user, 'extra_details'):
            return user.extra_details.uid
        return None

    def get_git_rev(self, obj):
        request = self.context.get('request', False)
        if constance.config.EXPOSE_GIT_REV or (request and request.user.is_superuser):
            return settings.GIT_REV
        else:
            return False

    def get_gravatar(self, obj):
        return gravatar_url(obj.email)

    def get_last_login(self, obj):
        if obj.last_login is not None:
            return obj.last_login.astimezone(ZoneInfo('UTC')).strftime(
                '%Y-%m-%dT%H:%M:%SZ'
            )
        return None

    def get_metadata(self, user):
        if not hasattr(user, 'extra_details'):
            return {}
        return user.extra_details.data

    def get_mfa_is_active(self, user):
        if hasattr(user, 'mfa_methods'):
            return user.mfa_methods.filter(is_active=True).exists()
        return False

    def get_organizations(self, user):
        if not user.organization:
            return None
        else:
            return {
                'organization_name': user.organization.name,
                'organization_uid': (
                    str(user.organization.id) if user.organization.id else None
                ),
                'role': user.organization.get_user_role(user),
            }

    def get_projects_url(self, obj):
        return '/'.join((settings.KOBOCAT_URL, obj.username))

    def get_server_time(self, obj):
        return datetime.datetime.now(tz=ZoneInfo('UTC')).strftime('%Y-%m-%dT%H:%M:%SZ')

    def get_sso_is_active(self, user):
        return SocialAccount.objects.filter(user=user).exists()

    def get_subscriptions(self, user):
        if not settings.STRIPE_ENABLED:
            return None
        try:
            subscriptions_queryset = (
                user.organizations_organizationuser.all()
                .select_related('organization')
                .prefetch_related('organization__djstripe_customers__subscriptions')
                .values_list(
                    'organization__djstripe_customers__subscriptions', flat=True
                )
            )
            all_subscriptions = {
                sub for sub in subscriptions_queryset if sub is not None
            }

        except Exception as e:
            logging.error(f"Error fetching subscriptions for user {user.id}: {e}")
            return []

        from djstripe.models import Subscription

        actual_subscriptions = Subscription.objects.filter(
            pk__in=list(all_subscriptions)
        )
        from kobo.apps.stripe.serializers import SubscriptionSerializer

        return SubscriptionSerializer(
            actual_subscriptions, many=True, context=self.context
        ).data

    def get_validated_email(self, obj):
        try:
            return obj.emailaddress_set.filter(primary=True, verified=True).exists()
        except Exception as e:
            logging.error(f"Error checking validated email for user {obj.id}: {e}")
        return False

    def get_validated_password(self, user):
        if hasattr(user, 'extra_details'):
            return user.extra_details.validated_password
        return None
