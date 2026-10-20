from decimal import Decimal
from typing import Any, Dict

from django.core.exceptions import ValidationError
from djstripe.models import (
    Price,
    Product,
    Subscription,
    SubscriptionItem,
    SubscriptionSchedule,
)
from drf_spectacular.utils import OpenApiTypes, extend_schema_field
from rest_framework import serializers

from kobo.apps.stripe.models import PlanAddOn
from kpi.schema_extensions.v2.stripe.schema import INTERVAL_ENUM, USAGE_TYPE_ENUM


class OneTimeAddOnSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanAddOn
        fields = (
            'id',
            'created',
            'is_available',
            'usage_limits',
            'total_usage_limits',
            'limits_remaining',
            'organization',
            'product',
        )


class BaseProductSerializer(serializers.ModelSerializer):
    metadata = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ('id', 'name', 'description', 'type', 'metadata')

    def get_metadata(self, obj) -> Dict[str, str]:
        return obj.metadata


class RecurringSerializer(serializers.Serializer):
    interval = serializers.ChoiceField(choices=INTERVAL_ENUM)
    interval_count = serializers.IntegerField()
    meter = serializers.CharField(required=False, allow_null=True)
    usage_type = serializers.ChoiceField(choices=USAGE_TYPE_ENUM)


class BasePriceSerializer(serializers.ModelSerializer):
    human_readable_price = serializers.SerializerMethodField()
    recurring = RecurringSerializer(required=True, allow_null=True)

    class Meta:
        model = Price
        fields = (
            'id',
            'nickname',
            'currency',
            'type',
            'recurring',
            'unit_amount',
            'human_readable_price',
            'active',
            'metadata',
        )

    @extend_schema_field(OpenApiTypes.STR)
    def get_human_readable_price(self, obj):
        return obj.human_readable_price


class PriceIdSerializer(serializers.Serializer):
    price_id = serializers.SlugRelatedField(
        'id',
        queryset=Price.objects.filter(active=True, product__active=True),
        required=True,
        allow_empty=False,
    )

    class Meta:
        model = Price
        fields = ('id',)


class ChangePlanSerializer(PriceIdSerializer):
    subscription_id = serializers.SlugRelatedField(
        'id',
        queryset=Subscription.objects.filter(
            status__in=['active'],
        ),
        required=True,
        allow_empty=False,
    )
    quantity = serializers.IntegerField(required=False, default=1, min_value=1)

    class Meta:
        model = Subscription
        fields = ('id',)


class CustomerPortalSerializer(serializers.Serializer):
    organization_id = serializers.CharField(required=True)
    price_id = serializers.SlugRelatedField(
        'id',
        queryset=Price.objects.all(),
        required=False,
        allow_empty=True,
    )
    quantity = serializers.IntegerField(required=False, default=1, min_value=1)

    def validate_organization_id(self, organization_id):
        if organization_id.startswith('org'):
            return organization_id
        raise ValidationError('Invalid organization ID')

    class Meta:
        model = Price
        fields = ('id',)


class CustomerPortalGetQuerySerializer(serializers.Serializer):
    organization_id = serializers.CharField(required=True)

    def validate_organization_id(self, organization_id):
        if organization_id.startswith('org'):
            return organization_id
        raise ValidationError('Invalid organization ID')


class CustomerAddressSerializer(serializers.Serializer):
    city = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    country = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    line1 = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    line2 = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    postal_code = serializers.CharField(
        allow_null=True, required=False, allow_blank=True
    )
    state = serializers.CharField(allow_null=True, required=False, allow_blank=True)


class BillingCycleInfoSerializer(serializers.Serializer):
    billing_cycle_anchor = serializers.DateTimeField(allow_null=True, required=False)
    current_period_start = serializers.DateTimeField(allow_null=True, required=False)
    current_period_end = serializers.DateTimeField(allow_null=True, required=False)
    interval = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    status = serializers.CharField(allow_null=True, required=False, allow_blank=True)


class CustomerBillingDetailsResponseSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    email = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    phone = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    address = CustomerAddressSerializer(allow_null=True, required=False)
    balance = serializers.IntegerField(allow_null=True, required=False)
    currency = serializers.CharField(allow_null=True, required=False, allow_blank=True)
    billing_cycle_info = BillingCycleInfoSerializer(allow_null=True, required=False)
    url = serializers.CharField(allow_null=True, required=False, allow_blank=True)


class CheckoutLinkSerializer(PriceIdSerializer):
    organization_id = serializers.CharField(required=False)
    quantity = serializers.IntegerField(required=False, default=1, min_value=1)


class PriceSerializer(BasePriceSerializer):
    class Meta(BasePriceSerializer.Meta):
        fields = (
            'id',
            'nickname',
            'currency',
            'type',
            'recurring',
            'unit_amount',
            'human_readable_price',
            'metadata',
            'active',
            'product',
            'transform_quantity',
        )


class PriceWithProductSerializer(PriceSerializer):
    product = BaseProductSerializer()


class ProductSerializer(BaseProductSerializer):
    prices = PriceSerializer(many=True)

    class Meta(BaseProductSerializer.Meta):
        fields = ('id', 'name', 'description', 'type', 'prices', 'metadata')


class SubscriptionItemSerializer(serializers.ModelSerializer):
    price = PriceWithProductSerializer()

    class Meta:
        model = SubscriptionItem
        fields = ('id', 'price', 'quantity')


class SubscriptionScheduleSerializer(serializers.ModelSerializer):
    phases = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionSchedule
        fields = ('phases', 'status')
        read_only_fields = ('phases', 'status')

    def get_phases(self, obj) -> Dict[str, Any]:
        return obj.phases


class SubscriptionSerializer(serializers.ModelSerializer):
    items = SubscriptionItemSerializer(many=True)
    schedule = SubscriptionScheduleSerializer()
    application_fee_percent = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal('0'),
        max_value=Decimal('100'),
        required=True,
        allow_null=True,
    )

    class Meta:
        model = Subscription
        exclude = ('djstripe_id',)
