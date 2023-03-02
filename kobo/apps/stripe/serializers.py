from django.core.exceptions import SuspiciousOperation
from djstripe.models import (
    Customer,
    Price,
    Product,
    Subscription,
    SubscriptionItem,
)
from rest_framework import serializers


class BaseProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ('id', 'name', 'description', 'type', 'metadata')


class BasePriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Price
        fields = (
            "id",
            "nickname",
            "currency",
            "type",
            "unit_amount",
            "human_readable_price",
            "metadata",
        )


class PriceSerializer(BasePriceSerializer):
    product = BaseProductSerializer()

    class Meta(BasePriceSerializer.Meta):
        fields = (
            "id",
            "nickname",
            "currency",
            "unit_amount",
            "human_readable_price",
            "metadata",
            "product",
        )


class ProductSerializer(BaseProductSerializer):
    prices = BasePriceSerializer(many=True)

    class Meta(BaseProductSerializer.Meta):
        fields = ("id", "name", "description", "type", "prices", "metadata")


class SubscriptionItemSerializer(serializers.ModelSerializer):
    price = PriceSerializer()

    class Meta:
        model = SubscriptionItem
        fields = ("id", "price")


class SubscriptionSerializer(serializers.ModelSerializer):
    items = SubscriptionItemSerializer(many=True)

    class Meta:
        model = Subscription
        exclude = ('djstripe_id',)
