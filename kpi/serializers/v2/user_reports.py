from rest_framework import serializers
from kpi.models.user_reports import UserReports
from django.contrib.auth import get_user_model

from kpi.serializers.v2.service_usage import ServiceUsageSerializer
from kpi.utils.object_permission import get_database_user
from kpi.utils.permissions import is_user_anonymous
from kpi.utils.usage_calculator import ServiceUsageCalculator


class UserReportsSerializer(serializers.ModelSerializer):
    current_service_usage = serializers.SerializerMethodField()
    asset_count = serializers.SerializerMethodField()
    deployed_asset_count = serializers.SerializerMethodField()
    account_restricted = serializers.SerializerMethodField()
    organizations = serializers.SerializerMethodField()

    def get_asset_count(self, obj):
        User = get_user_model()
        try:
            user_instance = User.objects.get(username=obj.username)
            return user_instance.assets.count()
        except User.DoesNotExist:
            return None

    def get_account_restricted(self, obj):
        User = get_user_model()
        try:
            user_instance = User.objects.get(username=obj.username)
        except User.DoesNotExist:
            return None

        if is_user_anonymous(user_instance):
            return False

        calculator = ServiceUsageCalculator(user_instance)
        balances = calculator.get_usage_balances()

        return any(balance and balance.get('exceeded') for balance in balances.values())

    def get_current_service_usage(self, obj):
        User = get_user_model()
        try:
            user_instance = User.objects.get(username=obj.username)
            if is_user_anonymous(user_instance):
                return None
            serializer = ServiceUsageSerializer(
                instance=get_database_user(user_instance), context=self.context
            )
            return serializer.data
        except User.DoesNotExist:
            return None

    def get_deployed_asset_count(self, obj):
        User = get_user_model()
        try:
            user_instance = User.objects.get(username=obj.username)
            return user_instance.assets.filter(_deployment_status='deployed').count()
        except User.DoesNotExist:
            return None

    def get_organizations(self, obj):
        org_data = obj.organizations

        if not org_data:
            return None

        User = get_user_model()
        try:
            user_instance = User.objects.get(username=obj.username)
        except User.DoesNotExist:
            org_data['role'] = None
            return org_data

        org_data['role'] = user_instance.organization.get_user_role(user_instance)
        return org_data

    class Meta:
        model = UserReports
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
            'social_accounts',
            'organizations',
            'metadata',
            'subscriptions',
            'current_service_usage',
            'account_restricted',
            'asset_count',
            'deployed_asset_count',
        )
