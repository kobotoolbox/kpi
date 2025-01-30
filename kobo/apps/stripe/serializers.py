from django.core.exceptions import ValidationError
from djstripe.models import (
    Price,
    Product,
    Subscription,
    SubscriptionItem,
    SubscriptionSchedule,
)
from rest_framework import serializers

from kobo.apps.stripe.models import PlanAddOn


class OneTimeAddOnSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanAddOn
        fields = (
            'id',
            'created',
            'is_available',
            'quantity',
            'usage_limits',
            'total_usage_limits',
            'limits_remaining',
            'organization',
            'product',
        )


class BaseProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ('id', 'name', 'description', 'type', 'metadata')


class BasePriceSerializer(serializers.ModelSerializer):
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

    class Meta:
        model = SubscriptionSchedule
        fields = ('phases', 'status')


class SubscriptionSerializer(serializers.ModelSerializer):
    items = SubscriptionItemSerializer(many=True)
    schedule = SubscriptionScheduleSerializer()

    class Meta:
        model = Subscription
        exclude = ('djstripe_id',)
